// app/(site)/results/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import TopNav from "@/app/components/TopNav";
import SiteFooter from "@/app/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { config } from "@/app/config";

const LS_CART_KEY = "cart:v1";
const LS_BOOKING_KEY = "booking:v1";

type PaymentRow = {
  id: number;
  amount: number;
  status: "PENDING" | "SUBMITTED" | "PAID";
  qrDataUrl?: string | null;
  expiresAt?: string | null;
  slipImage?: string | null;
};

type CreateResResp = { reservationId: number; depositAmount: number; orderTotal: number };

function authHeader() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const money = (n: number) => Number(n || 0).toLocaleString("th-TH");

function showAxiosError(err: any, fallback = "เกิดข้อผิดพลาด") {
  const msg = err?.response?.data?.message || err?.message || fallback;
  Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: msg });
}

type CartLine = {
  id: number;
  name: string;
  price: number;
  qty: number;
  note?: string | null;
  options?: any;
};

type BookingDraft = {
  date?: string;
  time?: string;
  people?: number;
  duration?: number;
  tableId?: string | number;
  tableName?: string;
  reservationId?: number;
  savedAt?: number;
};

export default function ResultsPage() {
  const router = useRouter();
  const q = useSearchParams();

  // --- รับค่าจาก query (อย่าใช้ new Date() ตอน SSR) ---
  const qDate = q.get("date") || "";
  const qTime = q.get("time") || "";
  const qDuration = parseInt(q.get("duration") || "90", 10);
  const qPeople = parseInt(q.get("people") || "0", 10);
  const tableId = q.get("tableId");
  const qTableName = q.get("tableName") || "";
  const openCart = q.get("openCart") === "1";

  // --- ค่าแก้ไขได้ในหน้า Result ---
  const [date, setDate] = useState<string>(qDate);
  const [time, setTime] = useState<string>(qTime);
  const [duration, setDuration] = useState<number>(Number.isFinite(qDuration) ? qDuration : 90);
  const [people, setPeople] = useState<number>(Number.isFinite(qPeople) ? qPeople : 0);

  // ตั้ง default date หลัง mount ถ้าไม่ถูกส่งมาจาก query
  useEffect(() => {
    if (!date) {
      try {
        const today = new Date();
        const iso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
          .toISOString()
          .slice(0, 10);
        setDate(iso);
      } catch {}
    }
  }, [date]);

  // ----------------- หาชื่อโต๊ะ -----------------
  const [tableName, setTableName] = useState<string>(qTableName || "");

  // อัปเดต booking ใน LS ให้มี tableName ด้วย (ถ้าได้ชื่อใหม่มา)
  const persistTableNameToBooking = (name: string) => {
    if (!tableId || !name) return;
    try {
      const raw = localStorage.getItem(LS_BOOKING_KEY);
      const old: BookingDraft = raw ? JSON.parse(raw) : {};
      const updated: BookingDraft = {
        ...old,
        tableId: old?.tableId ?? tableId,
        tableName: name,
        savedAt: Date.now(),
      };
      localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("booking:changed"));
    } catch {}
  };

  useEffect(() => {
    // ลำดับความสำคัญ: query → booking LS → ดึงจาก API
    if (qTableName) {
      setTableName(qTableName);
      persistTableNameToBooking(qTableName);
      return;
    }

    // ลองอ่านจาก booking ใน LS
    try {
      const raw = localStorage.getItem(LS_BOOKING_KEY);
      if (raw) {
        const bk: BookingDraft = JSON.parse(raw);
        if (!tableName && bk?.tableName) {
          setTableName(bk.tableName);
          return;
        }
      }
    } catch {}

    // หากยังไม่มี และมี tableId → ลองยิง API หา
    const fetchName = async () => {
      if (!tableId) return;
      try {
        // 1) แบบระบุตัวเดียว
        const one = await axios
          .get(`${config.apiUrl}/tables/${tableId}`, { headers: { "Cache-Control": "no-store" } })
          .then((r) => r.data)
          .catch(() => null);

        let name: string | undefined =
          one?.name || one?.table?.name || one?.data?.name || undefined;

        // 2) ถ้ายังไม่เจอ ลองโหลดทั้งหมดแล้วค้นหา
        if (!name) {
          const all = await axios
            .get(`${config.apiUrl}/tables`, { headers: { "Cache-Control": "no-store" } })
            .then((r) => r.data)
            .catch(() => null);
          if (Array.isArray(all)) {
            const t = all.find(
              (x: any) => String(x?.id ?? x?.table_id) === String(tableId)
            );
            name = t?.name ?? t?.table_name;
          }
        }

        if (name) {
          setTableName(name);
          persistTableNameToBooking(name);
        }
      } catch {
        /* ignore */
      }
    };

    fetchName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, qTableName]);

  const itemsRef = useRef<HTMLDivElement | null>(null);

  const [creating, setCreating] = useState(false);
  const [reservationId, setReservationId] = useState<number | null>(null);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] =
    useState<"INIT" | "CREATED" | "OTP_SENT" | "CONFIRMED" | "AWAITING_PAYMENT">("INIT");

  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [slip, setSlip] = useState<File | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [polling, setPolling] = useState<boolean>(false);

  // ---------- guard: ต้องล็อกอิน + มี tableId ----------
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      Swal.fire({
        icon: "info",
        title: "กรุณาเข้าสู่ระบบก่อน",
        showCancelButton: true,
        confirmButtonText: "ไปหน้าเข้าสู่ระบบ",
        cancelButtonText: "อยู่หน้านี้",
      }).then((r) => {
        if (r.isConfirmed) {
          const redirect =
            typeof window !== "undefined" ? window.location.pathname + "?" + q.toString() : "/results";
          router.push(`/signIn?redirect=${encodeURIComponent(redirect)}`);
        }
      });
    }
    if (!tableId) {
      Swal.fire({
        icon: "warning",
        title: "ไม่พบโต๊ะที่เลือก",
        text: "กรุณาเลือกโต๊ะใหม่อีกครั้ง",
      }).then(() => router.replace("/table"));
    }
  }, [q, router, tableId]);

  // ---------- โหลดตะกร้าอาหาร (หลัง mount เท่านั้น) ----------
  const [items, setItems] = useState<CartLine[]>([]);
  const readCart = () => {
    try {
      const raw = localStorage.getItem(LS_CART_KEY);
      const obj = raw ? (JSON.parse(raw) as Record<string, any>) : {};
      return Object.values(obj).map((it: any) => ({
        id: Number(it.id),
        name: it.name,
        price: Number(it.price),
        qty: Number(it.qty),
        note: it.note ?? null,
        options: it.options ?? null,
      })) as CartLine[];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    setItems(readCart());
  }, []);

  // sync เมื่อมีการแก้ไขตะกร้าจากแท็บอื่น/หน้าอื่น
  useEffect(() => {
    const sync = () => setItems(readCart());

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_CART_KEY) sync();
    };
    const onCustom = () => sync();
    const onFocus = () => sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("cart:changed", onCustom as any);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cart:changed", onCustom as any);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // เปิด section รายการอาหารอัตโนมัติ (ถ้า ?openCart=1)
  useEffect(() => {
    if (openCart && itemsRef.current) {
      itemsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [openCart]);

  // ---------- สรุปยอด ----------
  const estimate = useMemo(() => {
    const itemsTotal = items.reduce((a, c) => a + Number(c.price) * Number(c.qty), 0);
    const deposit = itemsTotal > 0 ? 0 : 100; // มีอาหาร → ไม่เก็บมัดจำ
    return { itemsTotal, deposit, grand: itemsTotal > 0 ? itemsTotal : deposit };
  }, [items]);

  // ---------- บันทึกการแก้ไขเวลา/จำนวนคน/ระยะเวลา ลง draft ----------
  const saveDraft = () => {
    try {
      const prevRaw = localStorage.getItem(LS_BOOKING_KEY);
      const prev: BookingDraft = prevRaw ? JSON.parse(prevRaw) : {};
      const draft: BookingDraft = {
        ...prev,
        date,
        time,
        people,
        duration,
        tableId,
        tableName: tableName || prev?.tableName, // ถ้าเพิ่งหามาได้ก็เขียนทับ
        savedAt: Date.now(),
        reservationId,
      };
      localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(draft));
      window.dispatchEvent(new Event("booking:changed"));
      Swal.fire({ icon: "success", title: "บันทึกเวลา/จำนวนแล้ว", timer: 1000, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ" });
    }
  };

  // ---------- สร้างใบจอง ----------
  const createReservation = async () => {
    if (!tableId) return Swal.fire({ icon: "error", title: "ไม่พบรหัสโต๊ะ" });
    setCreating(true);
    try {
      const body: any = {
        tableId: Number(tableId),
        date,
        time,
        durationMin: duration,
        people,
      };
      if (items.length > 0) body.items = items;

      const { data } = await axios.post<CreateResResp>(`${config.apiUrl}/reservations`, body, {
        headers: { ...authHeader(), "Content-Type": "application/json" },
      });
      setReservationId(data.reservationId);
      setStatus("CREATED");

      // เก็บ booking ไว้
      try {
        const prevRaw = localStorage.getItem(LS_BOOKING_KEY);
        const prev: BookingDraft = prevRaw ? JSON.parse(prevRaw) : {};
        localStorage.setItem(
          LS_BOOKING_KEY,
          JSON.stringify({
            ...prev,
            date,
            time,
            people,
            duration,
            tableId,
            tableName: tableName || prev?.tableName || "",
            reservationId: data.reservationId,
            savedAt: Date.now(),
          })
        );
        window.dispatchEvent(new Event("booking:changed"));
        window.dispatchEvent(new Event("cart:changed"));
      } catch {}

      Swal.fire({ icon: "success", title: "สร้างใบจองสำเร็จ", timer: 1200, showConfirmButton: false });
    } catch (e: any) {
      showAxiosError(e, "สร้างใบจองไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  };

  // ---------- ขอ OTP ----------
  const requestOtp = async () => {
    if (!reservationId) return;
    setSendingOtp(true);
    try {
      const { data } = await axios.post(
        `${config.apiUrl}/reservations/${reservationId}/request-otp`,
        {},
        { headers: { ...authHeader() } }
      );
      setPreviewUrl(data?.previewUrl ?? null);
      setStatus("OTP_SENT");
      Swal.fire({
        icon: "success",
        title: "ส่ง OTP แล้ว",
        text: "กรุณาตรวจสอบอีเมลของคุณ",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e: any) {
      showAxiosError(e, "ขอ OTP ไม่สำเร็จ");
    } finally {
      setSendingOtp(false);
    }
  };

  // ---------- ยืนยัน OTP ----------
  const verifyOtp = async () => {
    if (!reservationId || !otp) return;
    setVerifying(true);
    try {
      const { data } = await axios.post(
        `${config.apiUrl}/reservations/${reservationId}/verify-otp`,
        { code: otp },
        { headers: { ...authHeader() } }
      );
      if (data?.status === "CONFIRMED") {
        setStatus("CONFIRMED");
        Swal.fire({ icon: "success", title: "ยืนยันการจองแล้ว", timer: 1500, showConfirmButton: false });
        return;
      }
      if (data?.status === "AWAITING_PAYMENT") {
        setPayment(data.payment as PaymentRow);
        setStatus("AWAITING_PAYMENT");
        Swal.fire({
          icon: "info",
          title: "กรุณาชำระเงิน",
          text: "สแกน QR เพื่อชำระ หรืออัปโหลดสลิป",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (e: any) {
      showAxiosError(e, "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setVerifying(false);
    }
  };

  // ---------- นับถอยหลังหมดอายุ QR ----------
  useEffect(() => {
    if (!payment?.expiresAt) {
      setExpiresIn(0);
      return;
    }
    const end = new Date(payment.expiresAt).getTime();
    const tick = () => setExpiresIn(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [payment?.expiresAt]);

  // ---------- โพลสถานะการชำระ ----------
  useEffect(() => {
    if (status !== "AWAITING_PAYMENT" || !payment?.id) return;
    setPolling(true);
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get<PaymentRow>(`${config.apiUrl}/payment/${payment.id}`, {
          headers: { ...authHeader(), "Cache-Control": "no-store" },
        });
        if (data.status === "PAID") {
          setPayment(data);
          setStatus("CONFIRMED");
          Swal.fire({ icon: "success", title: "ชำระเงินสำเร็จ", timer: 1500, showConfirmButton: false });
        }
      } catch {}
    }, 4000);
    return () => {
      clearInterval(t);
      setPolling(false);
    };
  }, [status, payment?.id]);

  // ---------- อัปโหลดสลิป ----------
  const uploadSlip = async () => {
    if (!payment?.id || !slip) return;
    setUploadingSlip(true);
    try {
      const fd = new FormData();
      fd.append("slip", slip);
      await axios.post(`${config.apiUrl}/payment/${payment.id}/slip`, fd, { headers: { ...authHeader() } });
      Swal.fire({ icon: "success", title: "ส่งสลิปแล้ว", text: "รอแอดมินตรวจสอบ", timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      showAxiosError(e, "อัปโหลดสลิปไม่สำเร็จ");
    } finally {
      setUploadingSlip(false);
    }
  };

  // ---------- เคลียร์ตะกร้า/บุ๊กกิ้งเมื่อ CONFIRMED ----------
  useEffect(() => {
    if (status === "CONFIRMED") {
      try {
        localStorage.removeItem(LS_CART_KEY);
        localStorage.removeItem(LS_BOOKING_KEY);
        window.dispatchEvent(new Event("cart:changed"));
        window.dispatchEvent(new Event("booking:changed"));
      } catch {}
    }
  }, [status]);

  return (
    <main className="min-h-screen bg-neutral-50">
      <TopNav />

      <section className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">สรุปรายการจอง</h1>

        {/* ปรับเวลา/จำนวนได้ที่นี่ */}
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="text-slate-600 mb-1">วันที่</div>
              <input
                type="date"
                className="w-full border rounded px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1">เวลา</div>
              <input
                type="time"
                className="w-full border rounded px-3 py-2 text-sm"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1">จำนวนคน</div>
              <input
                type="number"
                min={1}
                className="w-full border rounded px-3 py-2 text-sm"
                value={people}
                onChange={(e) => setPeople(Math.max(1, Number(e.target.value || 1)))}
              />
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1">ระยะเวลา (นาที)</div>
              <input
                type="number"
                min={30}
                step={15}
                className="w-full border rounded px-3 py-2 text-sm"
                value={duration}
                onChange={(e) => setDuration(Math.max(30, Number(e.target.value || 30)))}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveDraft}>บันทึกเวลา/จำนวน</Button>
            <Button variant="outline" onClick={() => router.push("/menu")}>
              ไปเลือกอาหาร
            </Button>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-sm text-slate-700">
            วันที่: <b>{date}</b>
          </div>
          <div className="text-sm text-slate-700">
            เวลา: <b>{time || "-"}</b>
          </div>
          <div className="text-sm text-slate-700">
            ระยะเวลา: <b>{duration} นาที</b>
          </div>
          <div className="text-sm text-slate-700">
            จำนวนคน: <b>{people || "-"}</b>
          </div>
          <div className="text-sm text-slate-700">
            โต๊ะ: <b>{tableName || tableId || "-"}</b>
          </div>

          {items.length > 0 && (
            <div className="pt-2" ref={itemsRef}>
              <div className="font-semibold mb-1">รายการอาหาร</div>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {items.map((it, idx) => (
                  <li key={idx}>
                    {it.name} × {it.qty} — {money(Number(it.price) * Number(it.qty))} บาท
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 text-sm">
            {items.length > 0 ? (
              <>ยอดชำระเมื่อยืนยัน OTP: <b>{money(estimate.grand)} บาท</b></>
            ) : (
              <>มัดจำ: <b>{money(estimate.deposit)} บาท</b></>
            )}
          </div>
        </Card>

        {status === "INIT" && (
          <Button className="w-full" disabled={creating} onClick={createReservation}>
            {creating ? "กำลังสร้างใบจอง..." : "ยืนยันสร้างใบจอง"}
          </Button>
        )}

        {status === "CREATED" && (
          <Card className="p-4 space-y-3">
            <div className="font-semibold">ส่ง OTP</div>
            <p className="text-sm text-slate-600">เราจะส่งรหัส OTP ไปยังอีเมลในระบบของคุณ เพื่อยืนยันการจอง</p>
            <Button onClick={requestOtp} disabled={sendingOtp} className="w-full">
              {sendingOtp ? "กำลังส่ง..." : "ส่ง OTP"}
            </Button>
          </Card>
        )}

        {status === "OTP_SENT" && (
          <Card className="p-4 space-y-3">
            <div className="font-semibold">ยืนยัน OTP</div>
            {previewUrl && (
              <a className="text-xs text-indigo-600 underline" href={previewUrl} target="_blank" rel="noreferrer">
                (ทดสอบ) เปิดจดหมายตัวอย่างใน Ethereal
              </a>
            )}
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="กรอกรหัส 6 หลัก"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
            />
            <Button onClick={verifyOtp} disabled={verifying || otp.length < 4} className="w-full">
              {verifying ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
            </Button>
          </Card>
        )}

        {status === "AWAITING_PAYMENT" && payment && (
          <Card className="p-4 space-y-4">
            <div className="font-semibold">ชำระเงิน ({money(payment.amount)} บาท)</div>
            {payment.qrDataUrl ? (
              <>
                <div className="mx-auto w-60 h-60 border rounded overflow-hidden">
                  <Image
                    src={payment.qrDataUrl}
                    alt="PromptPay QR"
                    width={240}
                    height={240}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                </div>
                <div className="text-center text-sm text-slate-600">
                  {expiresIn > 0
                    ? `QR จะหมดอายุใน ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")} นาที`
                    : "QR หมดอายุแล้ว (ขอ OTP ใหม่เพื่อออก QR ใหม่)"}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-600">ไม่พบ QR</div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="text-sm font-medium">หรืออัปโหลดสลิป:</div>
              <input type="file" accept="image/*" onChange={(e) => setSlip(e.target.files?.[0] || null)} />
              <Button onClick={uploadSlip} disabled={!slip || uploadingSlip} className="w-full">
                {uploadingSlip ? "กำลังอัปโหลด..." : "ส่งสลิปชำระเงิน"}
              </Button>
              <div className="text-xs text-slate-500">
                สถานะปัจจุบัน: <b>{payment.status}</b> {polling ? "(กำลังตรวจสอบอัตโนมัติ…)" : ""}
              </div>
            </div>
          </Card>
        )}

        {status === "CONFIRMED" && (
          <Card className="p-6 text-center space-y-3">
            <div className="text-2xl font-bold text-emerald-600">ยืนยันการจองแล้ว 🎉</div>
            <div className="text-sm text-slate-600">ขอบคุณที่ใช้บริการ</div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.push("/")}>กลับหน้าแรก</Button>
              <Button variant="outline" onClick={() => router.push("/table")}>
                ดูโต๊ะอื่น
              </Button>
            </div>
          </Card>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
