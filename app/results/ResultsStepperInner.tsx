"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { config } from "@/app/config";
import { motion } from "framer-motion";
import {
  User2,
  CalendarClock,
  ClipboardList,
  FilePlus2,
  KeyRound,
  Wallet,
  CheckCircle2,
  Mail,
  Phone,
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";
import { readBookingSafe, writeBookingSafe, type PaymentRow, LS_CART_KEY } from "@/lib/bookingStore";

/* ============== Keys/Types ============== */
const LS_USER_KEY = "user:v1";

export type CreateResResp = { reservationId: number; depositAmount: number; orderTotal: number; };
type CartLine = { id: number; name: string; price: number; qty: number; note?: string | null; options?: any; };
type UserInfo = { user_id: number; user_name?: string | null; user_fname?: string | null; user_lname?: string | null; user_email?: string | null; user_phone?: string | null; user_img?: string | null; };

/** สถานะฝั่ง UI ของ Stepper */
type StatusT = "INIT" | "CREATED" | "OTP_SENT" | "CONFIRMED" | "AWAITING_PAYMENT";
/** สถานะที่เราเก็บใน bookingStore (ตามฝั่ง backend) */
type BackendStatus = "PENDING_OTP" | "OTP_VERIFIED" | "AWAITING_PAYMENT" | "CONFIRMED" | "CANCELED" | "EXPIRED";
function formatThaiDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatThaiTime(timeStr: string) {
  if (!timeStr) return "-";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function backendToUiStatus(s?: BackendStatus): StatusT | "INIT" {
  switch (s) {
    case "PENDING_OTP":
      return "CREATED";
    case "OTP_VERIFIED":
      return "AWAITING_PAYMENT";
    case "AWAITING_PAYMENT":
      return "AWAITING_PAYMENT";
    case "CONFIRMED":
      return "CONFIRMED";
    default:
      return "INIT";
  }
}

function authHeader() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : ({} as Record<string, string>);
}
const money = (n: number) => Number(n || 0).toLocaleString("th-TH");
function showAxiosError(err: any, fallback = "เกิดข้อผิดพลาด") {
  const msg = err?.response?.data?.message || err?.message || fallback;
  Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: msg });
}
function fileUrl(p?: string | null): string | null {
  if (!p) return null;
  if (p.startsWith("data:")) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return `${config.apiUrl}/${p.replace(/^\/+/, "")}`;
}

/* ============== Minor UI helpers ============== */
type AccentCardProps = { colors?: string; className?: string; children: React.ReactNode; };
const AccentCard = ({ colors = "from-indigo-300 via-fuchsia-300 to-emerald-300", className, children }: AccentCardProps) => (
  <div className={cn("rounded-2xl p-[1px] bg-gradient-to-r", colors, className)}>
    <Card className="rounded-[1rem] border bg-white/90 shadow-md">{children}</Card>
  </div>
);
const SectionHeading = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 font-semibold text-slate-800">{icon}<span>{children}</span></div>
);
const inputClass =
  "w-full border-2 border-indigo-100 rounded-md px-3 py-2 text-sm bg-white/90 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300";

/* ============== Stepper helpers ============== */
const STEP_KEYS = ["DETAILS","REVIEW","CREATED","OTP_SENT","AWAITING_PAYMENT","CONFIRMED"] as const;
type StepKey = typeof STEP_KEYS[number];
function statusToStep(status: StatusT): StepKey {
  switch (status) {
    case "INIT": return "REVIEW";
    case "CREATED": return "CREATED";
    case "OTP_SENT": return "OTP_SENT";
    case "AWAITING_PAYMENT": return "AWAITING_PAYMENT";
    case "CONFIRMED": return "CONFIRMED";
  }
}
const StepIcons: Record<StepKey, any> = { DETAILS: User2, REVIEW: ClipboardList, CREATED: FilePlus2, OTP_SENT: KeyRound, AWAITING_PAYMENT: Wallet, CONFIRMED: CheckCircle2 };
const StepLabels: Record<StepKey, string> = {
  DETAILS: "ข้อมูลลูกค้า & เวลา", REVIEW: "ตรวจสอบ & สร้างใบจอง", CREATED: "ขอรหัส OTP",
  OTP_SENT: "ยืนยันรหัส OTP", AWAITING_PAYMENT: "ชำระเงิน", CONFIRMED: "เสร็จสิ้น",
};

/* ============== Page ============== */
export default function ResultsStepperPage() {
  const router = useRouter();
  const q = useSearchParams();

  const qDate = q.get("date") || "";
  const qTime = q.get("time") || "";
  const qPeople = parseInt(q.get("people") || "0", 10);
  const tableIdFromUrl = q.get("tableId");
  const qTableName = q.get("tableName") || "";
  const openCart = q.get("openCart") === "1";

  const [date, setDate] = useState<string>(qDate);
  const [time, setTime] = useState<string>(qTime);
  const [people, setPeople] = useState<number>(Number.isFinite(qPeople) ? qPeople : 0);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ---------- hydrate ผู้ใช้ ----------
  useEffect(() => {
    let ignore = false;
    const readUserFromLS = () => {
      try { const raw = localStorage.getItem(LS_USER_KEY); return raw ? (JSON.parse(raw) as UserInfo) : null; } catch { return null; }
    };
    const syncFromTopNav = () => { if (ignore) return; const u = readUserFromLS(); setUser(u); setLoadingUser(false); };
    const first = readUserFromLS();
    if (first) { setUser(first); setLoadingUser(false); } else {
      (async () => {
        try {
          const token = localStorage.getItem("token") || localStorage.getItem("authToken");
          if (!token) { setUser(null); } else {
            const { data } = await axios.get(`${config.apiUrl}/user_info`, { headers: { Authorization: `Bearer ${token}` } });
            if (!ignore) setUser(data?.user ?? null);
          }
        } catch { if (!ignore) setUser(null); } finally { if (!ignore) setLoadingUser(false); }
      })();
    }
    const onUserUpdated = (e: Event) => {
      try {
        const anyEv = e as CustomEvent<UserInfo | null>;
        if (anyEv?.detail !== undefined) { if (!ignore) setUser(anyEv.detail); } else { syncFromTopNav(); }
      } catch { syncFromTopNav(); }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === LS_USER_KEY) syncFromTopNav(); };
    window.addEventListener("user:updated", onUserUpdated as any);
    window.addEventListener("storage", onStorage);
    return () => {
      ignore = true;
      window.removeEventListener("user:updated", onUserUpdated as any);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // default date วันนี้
  useEffect(() => {
    if (!date) {
      try {
        const today = new Date();
        const iso = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);
        setDate(iso);
      } catch {}
    }
  }, [date]);

  // ---------- hydrate จาก bookingStore ----------
  const [tableName, setTableName] = useState<string>(qTableName || "");
  const [status, setStatus] = useState<StatusT>("INIT");
  const [reservationId, setReservationId] = useState<number | null>(null);

useEffect(() => {
  try {
    const bk = readBookingSafe();
    console.log("DEBUG booking draft:", bk);
    if (!bk) return;

    if (!qDate && bk.date) setDate(bk.date);
    if (!qTime && bk.time) setTime(bk.time || "");
    if ((!qPeople || qPeople <= 0) && typeof bk.people === "number") setPeople(bk.people);
    if (!tableName && bk.tableName) setTableName(bk.tableName);

    if (typeof bk.reservationId === "number") setReservationId(bk.reservationId);

    // 🔥 restore payment ด้วย
    if (bk.payment) setPayment(bk.payment as PaymentRow);

    const restored = backendToUiStatus(bk.status as BackendStatus | undefined);
    if (restored !== "INIT") setStatus(restored as StatusT);
  } catch {}
}, []);


  // ถ้ามี reservationId แล้ว ลองรีโหลดสถานะล่าสุด
  // useEffect(() => {
  //   (async () => {
  //     try {
  //       if (!reservationId) return;
  //       const { data } = await axios.get(`${config.apiUrl}/reservations/${reservationId}`, {
  //         headers: { ...authHeader(), "Cache-Control": "no-store" },
  //       }).catch(() => ({ data: null as any }));
  //       if (!data) return;
  //       if (data.status) {
  //         const s = backendToUiStatus(data.status as BackendStatus);
  //         if (s !== "INIT") setStatus(s as StatusT);
  //       }
  //       if (data.payment) {
  //         setPayment(data.payment as PaymentRow);
  //       }
  //     } catch {}
  //   })();
  // }, [reservationId]);

  // ---------- ดึงชื่อโต๊ะ ----------
  const persistTableNameToBooking = (name: string) => {
    const urlTid = tableIdFromUrl || "";
    const tid = urlTid || (readBookingSafe()?.tableId as any) || "";
    if (!tid || !name) return;
    try {
      const prev = readBookingSafe() || {};
      writeBookingSafe({
        ...prev,
        tableId: prev?.tableId ?? (tid || ""),
        tableName: name,
      });
    } catch {}
  };

  useEffect(() => {
    if (qTableName) { setTableName(qTableName); persistTableNameToBooking(qTableName); return; }
    try {
      const bk = readBookingSafe();
      if (!tableName && bk?.tableName) setTableName(bk.tableName);
    } catch {}

    const fetchName = async () => {
      const tid = tableIdFromUrl || (readBookingSafe()?.tableId as any);
      if (!tid) return;
      try {
        const one = await axios.get(`${config.apiUrl}/tables/${tid}`, { headers: { "Cache-Control": "no-store" } }).then((r) => r.data).catch(() => null);
        let name: string | undefined = one?.name || one?.table?.name || one?.data?.name || undefined;
        if (!name) {
          const all = await axios.get(`${config.apiUrl}/tables`, { headers: { "Cache-Control": "no-store" } }).then((r) => r.data).catch(() => null);
          if (Array.isArray(all)) {
            const t = all.find((x: any) => String(x?.id ?? x?.table_id) === String(tid));
            name = t?.name ?? t?.table_name;
          }
        }
        if (name) { setTableName(name); persistTableNameToBooking(name); }
      } catch {}
    };
    fetchName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableIdFromUrl, qTableName]);

  const itemsRef = useRef<HTMLDivElement | null>(null);

  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [slip, setSlip] = useState<File | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [polling, setPolling] = useState<boolean>(false);
  const [creating, setCreating] = useState(false);

// ต้องล็อกอิน + ต้องมี tableId
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
        const redirect = typeof window !== "undefined"
          ? window.location.pathname + "?" + q.toString()
          : "/results";
        router.push(`/signIn?redirect=${encodeURIComponent(redirect)}`);
      }
    });
  }
  const effectiveTid = tableIdFromUrl || (readBookingSafe()?.tableId as any);
  if (!effectiveTid) {
    Swal.fire({
      icon: "warning",
      title: "ไม่พบโต๊ะที่เลือก",
      text: "กรุณาเลือกโต๊ะใหม่อีกครั้ง"
      
    }).then(() => router.replace("/table"));
  }
}, [q, router, tableIdFromUrl]);

  // ---------- โหลดตะกร้า ----------
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
  useEffect(() => setItems(readCart()), []);
  useEffect(() => {
    const sync = () => setItems(readCart());
    const onStorage = (e: StorageEvent) => { if (e.key === LS_CART_KEY) sync(); };
    const onCustom = () => sync();
    const onFocus = () => sync();
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };
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
  useEffect(() => { if (openCart && itemsRef.current) itemsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, [openCart]);

  const estimate = useMemo(() => {
    const itemsTotal = items.reduce((a, c) => a + Number(c.price) * Number(c.qty), 0);
    const deposit = itemsTotal > 0 ? 0 : 100;
    return { itemsTotal, deposit, grand: itemsTotal > 0 ? itemsTotal : deposit };
  }, [items]);

  // ---------- บันทึกดราฟต์ ----------
  const saveDraft = () => {
    try {
      const prev = readBookingSafe() || {};
      writeBookingSafe({
        ...prev,
        date,
        time,
        people,
        tableId: prev?.tableId ?? (tableIdFromUrl ?? ""),
        tableName: tableName || prev?.tableName,
        reservationId,
      });
      Swal.fire({ icon: "success", title: "บันทึกเวลา/จำนวนแล้ว", timer: 1000, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ" });
    }
  };

  // ---------- สร้างใบจอง ----------
  const createReservation = async () => {
    const effectiveTid = Number(tableIdFromUrl ?? (readBookingSafe()?.tableId as any) ?? 0);
    if (!effectiveTid) return Swal.fire({ icon: "error", title: "ไม่พบรหัสโต๊ะ" });
    setCreating(true);
    try {
      const body: any = { tableId: effectiveTid, date, time, people };
      if (items.length > 0) body.items = items;

      const { data } = await axios.post<CreateResResp>(`${config.apiUrl}/reservations`, body, {
        headers: { ...authHeader(), "Content-Type": "application/json" },
      });

      setReservationId(data.reservationId);
      setStatus("CREATED");

      // เก็บ progress
      try {
        const prev = readBookingSafe() || {};
        writeBookingSafe({
          ...prev,
          date, time, people,
          tableId: prev?.tableId ?? effectiveTid,
          tableName: tableName || prev?.tableName || "",
          reservationId: data.reservationId,
          status: "PENDING_OTP",
        });
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
        `${config.apiUrl}/reservations/${reservationId}/request-otp`, {}, { headers: { ...authHeader() } }
      );
      setPreviewUrl(data?.previewUrl ?? null);
      if (data?.payment) setPayment(data.payment);
      console.log("DEBUG payment:", data.payment);
      setStatus("OTP_SENT");

      // เก็บ progress (ต้องพก tableId/tableName)
      try {
        const prev = readBookingSafe() || {};
        writeBookingSafe({
          ...prev,
          reservationId,
          status: "PENDING_OTP",
          payment: data.payment,
          tableId: prev?.tableId ?? (tableIdFromUrl ?? ""),
          tableName: prev?.tableName ?? (tableName || ""),
        });
      } catch {}

      Swal.fire({ icon: "success", title: "ส่ง OTP แล้ว", text: "กรุณาตรวจสอบอีเมลของคุณ", timer: 1500, showConfirmButton: false });
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
        `${config.apiUrl}/reservations/${reservationId}/verify-otp`, { code: otp }, { headers: { ...authHeader() } }
      );

      if (data?.status === "CONFIRMED") {
        setStatus("CONFIRMED");
        try {
          const prev = readBookingSafe() || {};
          writeBookingSafe({
            ...prev,
            reservationId,
            status: "CONFIRMED",
            tableId: prev?.tableId ?? (tableIdFromUrl ?? ""),
            tableName: prev?.tableName ?? (tableName || ""),
          });
        } catch {}
        Swal.fire({ icon: "success", title: "ยืนยันการจองแล้ว", timer: 1500, showConfirmButton: false });
        return;
      }

      if (data?.status === "AWAITING_PAYMENT") {
        setPayment(data.payment as PaymentRow);
        setStatus("AWAITING_PAYMENT");
        try {
          const prev = readBookingSafe() || {};
          writeBookingSafe({
            ...prev,
            reservationId,
            status: "AWAITING_PAYMENT",
            payment: data.payment,
            tableId: prev?.tableId ?? (tableIdFromUrl ?? ""),
            tableName: prev?.tableName ?? (tableName || ""),
          });
        } catch {}
        Swal.fire({ icon: "info", title: "กรุณาชำระเงิน", text: "สแกน QR เพื่อชำระ หรืออัปโหลดสลิป", timer: 1500, showConfirmButton: false });
      }
    } catch (e: any) {
      showAxiosError(e, "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setVerifying(false);
    }
  };

  // นับถอยหลัง QR
  useEffect(() => {
    if (!payment?.expiresAt) { setExpiresIn(0); return; }
    const end = new Date(payment.expiresAt).getTime();
    const tick = () => setExpiresIn(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [payment?.expiresAt]);

  // โพลสถานะการจ่าย
  useEffect(() => {
    if (status !== "AWAITING_PAYMENT" || !payment?.id) return;
    setPolling(true);
    const t = setInterval(async () => {
      try {
        const { data } = await axios.get<PaymentRow>(`${config.apiUrl}/payment/${payment.id}`, {
          headers: { ...authHeader(), "Cache-Control": "no-store" },
        });
        setPayment((prev) => ({ ...(prev as any), ...data }));
        if (data.status === "PAID") {
          setStatus("CONFIRMED");
          try {
            const prev = readBookingSafe() || {};
            writeBookingSafe({
              ...prev,
              reservationId,
              status: "CONFIRMED",
              tableId: prev?.tableId ?? (tableIdFromUrl ?? ""),
              tableName: prev?.tableName ?? (tableName || ""),
            });
          } catch {}
          Swal.fire({ icon: "success", title: "ชำระเงินสำเร็จ", timer: 1500, showConfirmButton: false });
        }
      } catch {}
    }, 4000);
    return () => { clearInterval(t); setPolling(false); };
  }, [status, payment?.id, reservationId, tableIdFromUrl, tableName]);

  // เมื่อจบ (CONFIRMED) ให้เคลียร์ตะกร้า
  useEffect(() => {
    if (status === "CONFIRMED") {
      try {
        localStorage.removeItem(LS_CART_KEY);
        window.dispatchEvent(new Event("cart:changed"));
        window.dispatchEvent(new Event("booking:changed"));
      } catch {}
    }
  }, [status]);

  const fullName = useMemo(() => {
    if (!user) return "";
    const name = [user.user_fname, user.user_lname].filter(Boolean).join(" ").trim();
    return name || (user.user_name ?? "");
  }, [user]);

  const [uiInitStep, setUiInitStep] = useState<0 | 1>(0);
  const activeStepKey: StepKey = (() => {
    if (status === "INIT") return uiInitStep === 0 ? "DETAILS" : "REVIEW";
    return statusToStep(status);
  })();

  const StepBar = () => {
    const keys: StepKey[] = ["DETAILS","REVIEW","CREATED","OTP_SENT","AWAITING_PAYMENT","CONFIRMED"];
    const activeIdx = keys.indexOf(activeStepKey);
    return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-6 top-6 h-1 bg-neutral-200 rounded-full" />
        <div className="pointer-events-none absolute left-6 top-6 h-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" style={{ width: `calc(${(activeIdx / (keys.length - 1)) * 100}% - 40px)` }} />
        <div className="grid grid-cols-6 gap-2">
          {keys.map((k, i) => {
            const Icon = StepIcons[k]; const isDone = i < activeIdx; const isActive = i === activeIdx; const canClick = status === "INIT" && (k === "DETAILS" || k === "REVIEW");
            return (
              <button key={k} type="button" disabled={!canClick}
                onClick={() => { if (canClick) setUiInitStep(k === "DETAILS" ? 0 : 1); }}
                className={cn("group flex flex-col items-center gap-2 pt-2 select-none", canClick ? "cursor-pointer" : "cursor-default")}
              >
                <div className={cn("relative z-10 w-10 h-10 rounded-full grid place-items-center shadow-md border", "ring-2 ring-white outline outline-0 outline-offset-2 transition-all duration-200", "hover:outline-2 hover:outline-indigo-300", isActive && "bg-indigo-600 text-white border-indigo-600", isDone && "bg-emerald-600 text-white border-emerald-600", !isActive && !isDone && "bg-white text-slate-600 hover:shadow-lg")}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className={cn("text-[11px] leading-tight text-center max-w-[8rem]", isActive ? "text-indigo-700" : "text-slate-600")}>
                  {StepLabels[k]}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* --------------------------- Panels --------------------------- */
  const DetailsPanel = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
      <AccentCard colors="from-indigo-300 via-sky-300 to-cyan-300">
        <div className="p-5 space-y-3">
          <SectionHeading icon={<User2 className="w-4 h-4" />}>ข้อมูลลูกค้า</SectionHeading>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => router.push("/profile")} className="cursor-pointer">แก้ไขโปรไฟล์</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-slate-50 border p-3 flex items-center gap-2">
              <User2 className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500">ชื่อ-สกุล</div>
                <div className="font-semibold">{loadingUser ? "…" : fullName || "-"}</div>
              </div>
            </div>
            <div className="rounded-md bg-slate-50 border p-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500">อีเมล</div>
                <div className="font-semibold break-all">{loadingUser ? "…" : user?.user_email || "-"}</div>
              </div>
            </div>
            <div className="rounded-md bg-slate-50 border p-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-slate-500">โทรศัพท์</div>
                <div className="font-semibold">{loadingUser ? "…" : user?.user_phone || "-"}</div>
              </div>
            </div>
          </div>
        </div>
      </AccentCard>

      <AccentCard colors="from-emerald-300 via-teal-300 to-lime-300">
        <div className="p-5 space-y-4">
          <SectionHeading icon={<CalendarClock className="w-4 h-4" />}>รายละเอียดการจอง</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <div className="text-slate-600 mb-1 flex items-center gap-1"><CalendarDays className="w-4 h-4" />วันที่</div>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" className={cn(inputClass, "pl-9")} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1 flex items-center gap-1"><Clock className="w-4 h-4" />เวลา</div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="time" className={cn(inputClass, "pl-9")} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1 flex items-center gap-1"><Users className="w-4 h-4" />จำนวนคน</div>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" min={1} className={cn(inputClass, "pl-9")} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value || 1)))} />
              </div>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveDraft} className="cursor-pointer">บันทึกเวลา/จำนวน</Button>
            <Button variant="outline" onClick={() => router.push("/menu")} className="cursor-pointer">ไปเลือกอาหาร</Button>
            <Button variant="ghost" onClick={() => setUiInitStep(1)} className="ml-auto cursor-pointer">ต่อไป</Button>
          </div>
        </div>
      </AccentCard>
    </motion.div>
  );

  const ReviewPanel = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
      <AccentCard colors="from-violet-300 via-purple-300 to-pink-300">
        <div className="p-5 space-y-3">
          <SectionHeading icon={<ClipboardList className="w-4 h-4" />}>ตรวจสอบข้อมูล</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-md bg-slate-50 border p-3"><div className="text-slate-500">วันที่</div><div className="font-semibold">{formatThaiDate(date)}</div></div>
            <div className="rounded-md bg-slate-50 border p-3"><div className="text-slate-500">เวลา</div><div className="font-semibold">{formatThaiTime(time)}</div></div>
            <div className="rounded-md bg-slate-50 border p-3"><div className="text-slate-500">จำนวนคน</div><div className="font-semibold">{people || "-"}</div></div>
            <div className="rounded-md bg-slate-50 border p-3 col-span-2 sm:col-span-3"><div className="text-slate-500">โต๊ะ</div><div className="font-semibold">{tableName || tableIdFromUrl || readBookingSafe()?.tableId || "-"}</div></div>
          </div>
          {items.length > 0 && (
            <div className="pt-2" ref={itemsRef}>
              <div className="font-semibold mb-2">รายการอาหาร</div>
              <ul className="text-sm list-disc pl-5 space-y-1">
                {items.map((it, idx) => (
                  <li key={idx}>
                    {it.name} × {it.qty} — {money(Number(it.price) * Number(it.qty))} บาท
                    {it.note ? <div className="text-xs text-slate-500 mt-0.5">โน้ต: {it.note}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 text-sm">
            {items.length > 0 ? <>ยอดชำระเมื่อยืนยัน OTP: <b>{money(estimate.grand)} บาท</b></> : <>มัดจำ: <b>{money(estimate.deposit)} บาท</b></>}
          </div>
        </div>
      </AccentCard>

      {status === "INIT" && (
        <Button className="w-full cursor-pointer" disabled={creating} onClick={createReservation}>
          {creating ? "กำลังสร้างใบจอง..." : "ยืนยันสร้างใบจอง"}
        </Button>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setUiInitStep(0)} className="cursor-pointer">ย้อนกลับ</Button>
        <div />
      </div>
    </motion.div>
  );

  const CreatedPanel = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <AccentCard colors="from-indigo-300 via-sky-300 to-cyan-300">
        <div className="p-5 space-y-3">
          <SectionHeading icon={<FilePlus2 className="w-4 h-4" />}>ส่ง OTP</SectionHeading>
          <p className="text-sm text-slate-600">เราจะส่งรหัส OTP ไปยังอีเมลในระบบของคุณ เพื่อยืนยันการจอง</p>
          <Button onClick={requestOtp} disabled={sendingOtp || !reservationId} className="w-full cursor-pointer">{sendingOtp ? "กำลังส่ง..." : "ส่ง OTP"}</Button>
        </div>
      </AccentCard>
    </motion.div>
  );

  const OtpPanel = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <AccentCard colors="from-fuchsia-300 via-purple-300 to-indigo-300">
        <div className="p-5 space-y-3">
          <SectionHeading icon={<KeyRound className="w-4 h-4" />}>ยืนยัน OTP</SectionHeading>
          {previewUrl && <a className="text-xs text-indigo-600 underline" href={previewUrl} target="_blank" rel="noreferrer">(ทดสอบ) เปิดจดหมายตัวอย่างใน Ethereal</a>}
          <input className={cn(inputClass, "tracking-widest text-center")} placeholder="กรอกรหัส 6 หลัก" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} maxLength={6} />
          <Button onClick={verifyOtp} disabled={verifying || otp.length < 4} className="w-full cursor-pointer">{verifying ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}</Button>
        </div>
      </AccentCard>
    </motion.div>
  );

  const PaymentPanel = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {payment && (
        <AccentCard colors="from-teal-300 via-emerald-300 to-lime-300">
          <div className="p-5 space-y-4">
            <SectionHeading icon={<Wallet className="w-4 h-4" />}>ชำระเงิน ({money(payment.amount)} บาท)</SectionHeading>

            {payment.qrDataUrl && expiresIn > 0 && payment.status !== "EXPIRED" ? (
              <>
                <div className="mx-auto w-60 h-60 border rounded-xl overflow-hidden bg-white shadow">
                  <Image
                    src={fileUrl(payment.qrDataUrl) ?? ""}
                    alt="PromptPay QR"
                    width={240}
                    height={240}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                </div>
                <div className="text-center text-sm text-slate-600">
                  {`QR จะหมดอายุใน ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")} นาที`}
                </div>
              </>
            ) : (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                QR หมดอายุแล้ว — กรุณาขอ OTP ใหม่เพื่อออก QR ใหม่
                <div className="mt-2">
                  <Button
                    size="sm"
                    className="cursor-pointer"
                    onClick={async () => {
                      if (!reservationId) return;
                      try {
                        const { data } =
                          await axios.post(`${config.apiUrl}/reservations/${reservationId}/request-otp`, {}, { headers: { ...authHeader() } });
                        if (data?.payment) setPayment(data.payment);
                        console.log("DEBUG payment:", data.payment);
                        setStatus("OTP_SENT");
                        setOtp("");
                        try {
                          const prev = readBookingSafe() || {};
                          writeBookingSafe({
                            ...prev,
                            reservationId,
                            status: "PENDING_OTP",
                            payment: data.payment,
                            tableId: prev?.tableId ?? (tableIdFromUrl ?? ""),
                            tableName: prev?.tableName ?? (tableName || ""),
                          });
                        } catch {}
                        setOtp("");
                        Swal.fire({ icon: "success", title: "ส่ง OTP ใหม่แล้ว", timer: 1500, showConfirmButton: false });
                      } catch (e: any) {
                        showAxiosError(e, "ขอ OTP ใหม่ไม่สำเร็จ");
                      }
                    }}
                  >
                    ขอ OTP ใหม่
                  </Button>
                </div>
              </div>
            )}

            {/* สลิป */}
            <div className="border-t pt-3 space-y-3">
              <div className="text-sm font-medium">สลิปชำระเงิน</div>
              {payment.slipImage ? (
                <div className="flex items-center gap-3">
                  <div className="relative w-24 h-24 rounded border overflow-hidden bg-white">
                    <Image src={fileUrl(payment.slipImage) ?? ""} alt="slip" fill className="object-cover" unoptimized />
                  </div>
                  <div className="text-xs text-slate-600">อัปโหลดแล้ว — สถานะ: <b>{payment.status}</b> {polling ? "(กำลังตรวจสอบอัตโนมัติ…)" : ""}</div>
                </div>
              ) : (
                <>
                  <input type="file" accept="image/*" onChange={(e) => setSlip(e.target.files?.[0] || null)} disabled={expiresIn <= 0 || uploadingSlip || payment.status === "EXPIRED"} className="text-sm" />
                  <Button onClick={async () => {
                    if (!payment?.id || !slip) return;
                    setUploadingSlip(true);
                    try {
                      const fd = new FormData();
                      fd.append("slip", slip);
                      const { data } = await axios.post(`${config.apiUrl}/payment/${payment.id}/slip`, fd, { headers: { ...authHeader() } });
                      setPayment((prev) => ({ ...(prev as any), ...data.payment }));
                      Swal.fire({ icon: "success", title: "ส่งสลิปแล้ว", text: "รอแอดมินตรวจสอบ", timer: 1500, showConfirmButton: false });
                    } catch (e: any) {
                      showAxiosError(e, "อัปโหลดสลิปไม่สำเร็จ");
                    } finally {
                      setUploadingSlip(false);
                    }
                  }} disabled={!slip || uploadingSlip || expiresIn <= 0 || payment.status === "EXPIRED"} className="w-full cursor-pointer">
                    {uploadingSlip ? "กำลังอัปโหลด..." : "ส่งสลิปชำระเงิน"}
                  </Button>
                  <div className="text-xs text-slate-500">สถานะปัจจุบัน: <b>{payment.status}</b> {polling ? "(กำลังตรวจสอบอัตโนมัติ…)" : ""}</div>
                </>
              )}
            </div>
          </div>
        </AccentCard>
      )}
    </motion.div>
  );

  const DonePanel = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <AccentCard colors="from-emerald-300 via-green-300 to-teal-300">
        <div className="p-6 text-center space-y-3">
          <div className="text-2xl font-bold text-emerald-600 flex items-center justify-center gap-2"><CheckCircle2 className="w-6 h-6" /> ยืนยันการจองแล้ว</div>
          <div className="text-sm text-slate-600">ขอบคุณที่ใช้บริการ</div>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => router.push("/")} className="cursor-pointer">กลับหน้าแรก</Button>
            <Button variant="outline" onClick={() => router.push("/table")} className="cursor-pointer">ดูโต๊ะอื่น</Button>
          </div>
        </div>
      </AccentCard>
    </motion.div>
  );

  return (
    <main className="relative min-h-screen bg-neutral-50 overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-indigo-100/70 to-transparent blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute right-[-10%] top-32 h-60 w-60 rounded-full bg-emerald-200/40 blur-3xl" />
      

      <section className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
            สรุปรายการจอง
          </h1>
          <div className="text-xs text-slate-500">SaiLom • {new Date().getFullYear()}</div>
        </div>

        {/* Stepper */}
        <div className="rounded-2xl p-[1px] bg-gradient-to-r from-indigo-300/70 via-purple-300/70 to-emerald-300/70">
          <Card className="rounded-[1rem] border-0 shadow-sm bg-gradient-to-br from-white to-indigo-50/40">
            <div className="p-4"><StepBar /></div>
          </Card>
        </div>

        {activeStepKey === "DETAILS" && DetailsPanel}
        {activeStepKey === "REVIEW" && ReviewPanel}
        {activeStepKey === "CREATED" && CreatedPanel}
        {activeStepKey === "OTP_SENT" && OtpPanel}
        {activeStepKey === "AWAITING_PAYMENT" && PaymentPanel}
        {activeStepKey === "CONFIRMED" && DonePanel}
      </section>

    </main>
  );
}
