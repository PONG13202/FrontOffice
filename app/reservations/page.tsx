// app/reservations/page.tsx
"use client";

import React, { useEffect, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import Swal from "sweetalert2";
import TopNav from "../components/TopNav";
import { clearIfCommitted } from "@/lib/bookingStore";
import { socket } from "@/app/socket";
import { config } from "@/app/config";

type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELED";
type PaymentStatus = "PENDING" | "SUBMITTED" | "PAID" | "CANCELED" | "EXPIRED";
type ReservationStatus =
  | "PENDING_OTP"
  | "OTP_VERIFIED"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "CANCELED"
  | "EXPIRED";

type OrderItemView = {
  id: number;
  menuId: number | null;
  name: string;
  price: number;
  qty: number;
  note?: string | null;
  image?: string | null;
};

type MyReservation = {
  id: number;
  tableLabel: string | null;
  dateStart: string;
  dateEnd: string | null;
  people: number | null;
  status: ReservationStatus;
  depositAmount: number;
  order: {
    id: number;
    status: OrderStatus;
    total: number;
    items: OrderItemView[];
  } | null;
  payment:
    | {
        id: number;
        status: PaymentStatus;
        amount: number;
        expiresAt: string | null;
        confirmedAt: string | null;
        slipImage: string | null;
      }
    | null;
};

// ---------- helpers ----------
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
};

const within = (now: Date, startISO: string, endISO?: string | null) => {
  const s = new Date(startISO);
  const e = endISO ? new Date(endISO) : new Date(s.getTime() + 30 * 60 * 1000);
  return now >= s && now <= e;
};

function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "blue" | "amber" | "green" | "red" | "slate" | "purple" | "zinc";
}) {
  const toneMap: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    green: "bg-green-100 text-green-700 border-green-200",
    red: "bg-rose-100 text-rose-700 border-rose-200",
    slate: "bg-slate-100 text-slate-800 border-slate-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs border ${toneMap[tone]} whitespace-nowrap`}>
      {label}
    </span>
  );
}

const mapReservationTone = (s: ReservationStatus) =>
  s === "CONFIRMED"
    ? "green"
    : s === "CANCELED" || s === "EXPIRED"
    ? "red"
    : s === "AWAITING_PAYMENT"
    ? "purple"
    : "amber";

const mapPaymentTone = (s?: PaymentStatus | null) =>
  s === "PAID"
    ? "green"
    : s === "EXPIRED"
    ? "red"
    : s === "CANCELED"
    ? "zinc"
    : s === "PENDING" || s === "SUBMITTED"
    ? "amber"
    : "neutral";

const mapOrderTone = (s?: OrderStatus | null) =>
  s === "CONFIRMED" ? "green" : s === "CANCELED" ? "zinc" : s === "PENDING" ? "amber" : "neutral";

// คืน URL ไฟล์จาก backend
const fileUrl = (p?: string | null) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${config.apiUrl}/${p.replace(/^\/+/, "")}`;
};

// ใช้ใน axios
const authHeader = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ดึง userId จาก JWT (ฝั่ง client แค่ decode base64 เฉย ๆ) — ยังไม่ได้ใช้แต่เก็บไว้เผื่อ
const getUserIdFromJWT = (): number | null => {
  try {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) return null;
    const base64 = token.split(".")[1];
    const json = JSON.parse(atob(base64.replace(/-/g, "+").replace(/_/g, "/")));
    const id = Number(json?.id || json?.user_id);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
};

// ---------- page ----------
export default function MyReservationsPage() {
  const [data, setData] = useState<MyReservation[]>([]);
  const [serverNow, setServerNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [uploading, setUploading] = useState<number | null>(null);

  // pagination (ฝั่งหน้าเว็บ)
  const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10);

  const applyIncoming = (payload: { data?: MyReservation[]; now?: string }) => {
    if (payload?.data) setData(payload.data);
    if (payload?.now) setServerNow(new Date(payload.now));
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${config.apiUrl}/my_reservations`, {
        headers: { ...authHeader() },
      });
      applyIncoming(res.data || {});
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "โหลดข้อมูลไม่สำเร็จ";
      Swal.fire({ icon: "error", title: "ไม่สามารถโหลดรายการได้", text: msg });
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch + socket realtime
  useEffect(() => {
    fetchData();
    try { clearIfCommitted(); } catch {}

    const token = localStorage.getItem("token") || localStorage.getItem("authToken") || undefined;
    if (!socket.connected) {
      if (token) (socket as any).auth = { token };
      socket.connect();
    }

    const onEvent = (payload: any) => {
      console.log("Reservation event:", payload);
      fetchData(); // refresh ทันทีเมื่อมี event
    };

    socket.on("reservation:created", onEvent);
    socket.on("reservation:updated", onEvent);
    socket.on("reservation:confirmed", onEvent);
    socket.on("reservation:expired", onEvent);
    socket.on("reservation:canceled", onEvent);
    socket.on("payment:succeeded", onEvent);

    return () => {
      socket.off("reservation:created", onEvent);
      socket.off("reservation:updated", onEvent);
      socket.off("reservation:confirmed", onEvent);
      socket.off("reservation:expired", onEvent);
      socket.off("reservation:canceled", onEvent);
      socket.off("payment:succeeded", onEvent);
    };
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize]);

  const now = serverNow || new Date();

  const filtered = useMemo(() => {
    if (filter === "all") return data;
    if (filter === "upcoming") {
      return data.filter((r) => {
        const start = new Date(r.dateStart);
        return start >= now || within(now, r.dateStart, r.dateEnd);
      });
    }
    // past
    return data.filter((r) => {
      const end = r.dateEnd ? new Date(r.dateEnd) : new Date(new Date(r.dateStart).getTime() + 30 * 60 * 1000);
      return end < now;
    });
  }, [data, filter, now]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginated = filtered.slice(startIdx, endIdx);

  // ===== เลือก "รายการล่าสุด" ตาม enum ชัดเจน =====

  // ให้คะแนนความ "ใหม่" (เพื่อจัดอันดับ)
  const stamp = (r: MyReservation) => {
    const t = new Date(r.dateStart).getTime();
    const oid = r.order?.id ?? 0;
    const pid = r.payment?.id ?? 0;
    return Math.max(t, oid, pid);
  };

  /**
   * รอแอดมินอนุมัติ:
   * - ลูกค้า "ส่งสลิปแล้ว" => payment.status === "SUBMITTED"
   * - งานยังไม่จบ => reservation.status ไม่ใช่ EXPIRED/CANCELED
   * *ไม่* นับเคสที่แค่ ORDER.PENDING แต่ยังไม่ได้ส่งสลิป
   */
  const isAwaitingAdmin = useCallback((r: MyReservation) => {
    if (!r.payment) return false;
    if (r.status === "EXPIRED" || r.status === "CANCELED") return false;
    return r.payment.status === "SUBMITTED";
  }, []);

  // ออเดอร์ล่าสุดที่สั่งมา (ต้องมี order)
  const latestOrder = useMemo(() => {
    const arr = data.filter((r) => r.order);
    arr.sort((a, b) => {
      const s = stamp(b) - stamp(a);
      return s !== 0 ? s : b.id - a.id; // กันกรณีค่าเท่ากัน
    });
    return arr[0] ?? null;
  }, [data]);

  // ออเดอร์ที่รอแอดมินอนุมัติ "ล่าสุด"
  const latestAwaiting = useMemo(() => {
    const arr = data.filter(isAwaitingAdmin);
    arr.sort((a, b) => {
      const s = stamp(b) - stamp(a);
      return s !== 0 ? s : b.id - a.id;
    });
    return arr[0] ?? null;
  }, [data, isAwaitingAdmin]);

  // อัปโหลดสลิปได้เมื่อยังไม่ได้ส่งสลิป/หมดเวลาแล้ว (และยังไม่มีรูป)
  const canUploadSlip = (r: MyReservation) => {
    const p = r.payment;
    if (!p) return false;
    // ถ้า SUBMITTED มักจะมี slipImage แล้ว จึงไม่ผ่านเงื่อนไข !p.slipImage
    return (p.status === "PENDING" || p.status === "EXPIRED") && !p.slipImage;
  };

  const handleUploadSlip = async (paymentId: number, file: File) => {
    const fd = new FormData();
    fd.append("slip", file);
    try {
      setUploading(paymentId);
      await axios.post(`${config.apiUrl}/payment/${paymentId}/slip`, fd, {
        headers: { ...authHeader() },
      });
      Swal.fire({ icon: "success", title: "อัปโหลดสลิปสำเร็จ", timer: 1300, showConfirmButton: false });
      await fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "อัปโหลดสลิปไม่สำเร็จ";
      Swal.fire({ icon: "error", title: "ไม่สำเร็จ", text: msg });
    } finally {
      setUploading(null);
    }
  };

  // ปุ่มเลขหน้าแบบหน้าต่าง 5 ปุ่ม
  const pageNumbers = useMemo(() => {
    const arr: number[] = [];
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [currentPage, pages]);

  // ===== การ์ดสรุป (ใช้เฉพาะส่วนบน)
  const OrderSummaryCard = ({ title, r }: { title: string; r: MyReservation }) => {
    return (
      <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-medium">{title}</h3>
          <StatusBadge label={r.status} tone={mapReservationTone(r.status)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* กล่องข้อมูลจอง + รายการอาหาร */}
          <div className="rounded-xl border p-4">
            <div className="mb-2 font-medium">
              โต๊ะ: {r.tableLabel || "-"} • {fmtDateTime(r.dateStart)}
            </div>
            <div className="text-sm text-slate-600">
              คน: {r.people ?? 0}
              {r.dateEnd ? ` • ถึง ${fmtDateTime(r.dateEnd)}` : ""}
            </div>

            {r.order?.items?.length ? (
              <div className="mt-3">
                <div className="mb-2 text-sm font-medium">รายการอาหาร</div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {r.order.items.map((it) => {
                    const src = fileUrl(it.image) || "/placeholder.png";
                    return (
                      <li key={it.id} className="flex items-center gap-3 rounded-lg border p-2">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-white">
                          <Image
                            src={src}
                            alt={it.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 text-sm">
                          <div className="truncate font-medium">{it.name}</div>
                          <div className="text-slate-600">
                            × {it.qty} • {(Number(it.price) * Number(it.qty)).toLocaleString()} ฿
                          </div>
                          {it.note ? <div className="text-xs text-slate-500">โน้ต: {it.note}</div> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">ไม่มีรายการอาหาร (อาจเป็นการมัดจำโต๊ะ)</div>
            )}
          </div>

          {/* กล่องสถานะบิล/ชำระเงิน + สลิป */}
          <div className="rounded-xl border p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">สถานะบิล</div>
                <StatusBadge label={r.order?.status ?? "-"} tone={mapOrderTone(r.order?.status ?? null)} />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">สถานะชำระเงิน</div>
                <StatusBadge label={r.payment?.status ?? "-"} tone={mapPaymentTone(r.payment?.status ?? null)} />
              </div>
              {r.payment?.amount ? (
                <div className="text-sm">
                  ยอดชำระ: <span className="font-medium">{r.payment.amount.toLocaleString()} ฿</span>
                  {r.payment.expiresAt ? (
                    <span className="text-slate-500"> • หมดเวลา {fmtDateTime(r.payment.expiresAt)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* อนุญาตอัปโหลดสลิปเฉพาะออเดอร์ที่ยังไม่ได้ส่งสลิป */}
            {r.payment && canUploadSlip(r) ? (
              <div className="mt-3">
                <label className="text-sm text-slate-600">อัปโหลดสลิป:</label>
                <div className="mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading === r.payment.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadSlip(r.payment!.id, f);
                    }}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                  />
                  {uploading === r.payment.id ? (
                    <div className="mt-1 text-xs text-slate-500">กำลังอัปโหลด...</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {r.payment?.slipImage ? (
              <div className="mt-3">
                <div className="mb-1 text-sm text-slate-600">สลิปที่อัปโหลด:</div>
                <div className="relative h-40 w-full overflow-hidden rounded-lg border bg-white">
                  <Image
                    src={fileUrl(r.payment.slipImage) || "/placeholder.png"}
                    alt="Slip"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      

      <section className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-transparent">
            ประวัติการจองของฉัน
          </h1>

        <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border bg-white p-1">
              {(["all", "upcoming", "past"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1 text-sm rounded-md transition ${
                    filter === k ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {k === "all" ? "ทั้งหมด" : k === "upcoming" ? "กำลังจะถึง" : "ที่ผ่านมา"}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-1">
              <span className="text-sm text-slate-600">แสดง</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as any)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}/หน้า
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchData}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 active:scale-[0.98] transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ===== ส่วนบน: ออเดอร์ล่าสุด & รออนุมัติล่าสุด ===== */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-medium">ออเดอร์ล่าสุด & รออนุมัติล่าสุด</h2>

          {!latestOrder && !latestAwaiting ? (
            <p className="text-sm text-slate-600">ยังไม่มีออเดอร์</p>
          ) : (
            <>
              {latestAwaiting ? (
                <OrderSummaryCard title="ออเดอร์ที่รอแอดมินอนุมัติล่าสุด" r={latestAwaiting} />
              ) : null}

              {latestOrder && (!latestAwaiting || latestOrder.id !== latestAwaiting.id) ? (
                <OrderSummaryCard title="ออเดอร์ล่าสุดที่สั่งมา" r={latestOrder} />
              ) : null}
            </>
          )}
        </section>

        {/* ===== รายการทั้งหมด + pagination (ประวัติ) ===== */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-medium">รายการการจอง</h2>
            <div className="text-xs text-slate-500">
              ทั้งหมด {total.toLocaleString()} รายการ • หน้า {currentPage}/{pages}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-sm text-slate-600">ไม่พบรายการ</div>
          ) : (
            <>
              <div className="grid gap-3">
                {paginated.map((r) => (
                  <div key={r.id} className="rounded-xl border p-4 hover:shadow-sm transition-shadow">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        #{r.id} • โต๊ะ {r.tableLabel || "-"} • {fmtDateTime(r.dateStart)}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge label={r.status} tone={mapReservationTone(r.status)} />
                        <StatusBadge label={`ORDER: ${r.order?.status ?? "-"}`} tone={mapOrderTone(r.order?.status ?? null)} />
                        <StatusBadge
                          label={`PAYMENT: ${r.payment?.status ?? "-"}`}
                          tone={mapPaymentTone(r.payment?.status ?? null)}
                        />
                      </div>
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      คน: {r.people ?? 0}
                      {r.order?.total ? <> • ยอดอาหาร {r.order.total.toLocaleString()} ฿</> : null}
                      {r.payment?.amount ? <> • ยอดชำระ {r.payment.amount.toLocaleString()} ฿</> : null}
                    </div>

                    {/* รายการอาหาร (พร้อมรูป) */}
                    {r.order?.items?.length ? (
                      <div className="mt-3">
                        <div className="mb-2 text-sm font-medium">รายการอาหาร</div>
                        <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {r.order.items.map((it) => {
                            const src = fileUrl(it.image) || "/placeholder.png";
                            return (
                              <li key={it.id} className="flex items-center gap-3 rounded-lg border p-2">
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-white">
                                  <Image
                                    src={src}
                                    alt={it.name}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <div className="min-w-0 text-sm">
                                  <div className="truncate font-medium">{it.name}</div>
                                  <div className="text-slate-600">
                                    × {it.qty} • {(Number(it.price) * Number(it.qty)).toLocaleString()} ฿
                                  </div>
                                  {it.note ? <div className="text-xs text-slate-500">โน้ต: {it.note}</div> : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : null}

                    {/* สลิป (ประวัติ: แสดงอย่างเดียว ไม่ให้อัปโหลด) */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {r.payment?.slipImage ? (
                        <Link
                          href={fileUrl(r.payment.slipImage) || "#"}
                          target="_blank"
                          className="text-sm text-slate-700 underline"
                        >
                          ดูสลิป
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* pagination controls */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  แสดง {startIdx + 1}–{Math.min(endIdx, total)} จาก {total.toLocaleString()} รายการ
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={currentPage === 1}
                    className={`rounded-md border px-2 py-1 text-sm ${
                      currentPage === 1 ? "text-slate-300" : "hover:bg-slate-50"
                    }`}
                  >
                    « หน้าแรก
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`rounded-md border px-2 py-1 text-sm ${
                      currentPage === 1 ? "text-slate-300" : "hover:bg-slate-50"
                    }`}
                  >
                    ‹ ก่อนหน้า
                  </button>

                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`rounded-md border px-3 py-1 text-sm ${
                        n === currentPage ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={currentPage === pages}
                    className={`rounded-md border px-2 py-1 text-sm ${
                      currentPage === pages ? "text-slate-300" : "hover:bg-slate-50"
                    }`}
                  >
                    ถัดไป ›
                  </button>
                  <button
                    onClick={() => setPage(pages)}
                    disabled={currentPage === pages}
                    className={`rounded-md border px-2 py-1 text-sm ${
                      currentPage === pages ? "text-slate-300" : "hover:bg-slate-50"
                    }`}
                  >
                    หน้าสุดท้าย »
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </section>


    </main>
  );
}
