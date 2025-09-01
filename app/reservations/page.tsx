// C:\Users\pong1\OneDrive\เอกสาร\End-Pro\service\app\reservations\page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import TopNav from "@/app/components/TopNav";
import SiteFooter from "@/app/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { config } from "@/app/config";

type RawReservation = any;

type Reservation = {
  id: number;
  tableId?: string | number | null;
  tableName?: string | null;
  date?: string | null;       // yyyy-mm-dd
  time?: string | null;       // HH:mm
  people?: number | null;
  status?: string | null;     // CREATED | OTP_SENT | AWAITING_PAYMENT | CONFIRMED | CANCELLED ...
  amount?: number | null;     // รวมที่ต้องชำระหรือยอดสรุป
  createdAt?: string | null;
  paymentStatus?: string | null;
};

const money = (n?: number | null) =>
  Number(n || 0).toLocaleString("th-TH");

function authHeader() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const tabs = [
  { key: "ALL", label: "ทั้งหมด" },
  { key: "CREATED", label: "รอยืนยัน" },          // รวม CREATED/OTP_SENT
  { key: "AWAITING_PAYMENT", label: "รอชำระ" },
  { key: "CONFIRMED", label: "ยืนยันแล้ว" },
  { key: "CANCELLED", label: "ยกเลิก" },
];

function normalizeReservation(x: RawReservation): Reservation {
  // ปรับ mapping ให้เข้ากับ backend ของคุณได้ตามจริง
  const id = x?.id ?? x?.reservationId ?? x?.res_id ?? 0;
  const tableId = x?.tableId ?? x?.table_id ?? null;
  const tableName = x?.tableName ?? x?.table_name ?? x?.table?.name ?? null;

  // วันที่/เวลาอาจเก็บแบบ start datetime
  let date = x?.date ?? null;
  let time = x?.time ?? null;
  const start = x?.start ?? x?.startAt ?? x?.start_time ?? x?.startTime;
  if ((!date || !time) && start) {
    try {
      const dt = new Date(start);
      const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()))
        .toISOString()
        .slice(0, 10);
      const t = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
      date = date || d;
      time = time || t;
    } catch {}
  }

  const people = x?.people ?? x?.guest ?? x?.pax ?? x?.num_people ?? null;
  const status = x?.status ?? x?.reservationStatus ?? null;
  const amount = x?.amount ?? x?.total ?? x?.grand_total ?? null;
  const createdAt = x?.createdAt ?? x?.created_at ?? null;
  const paymentStatus = x?.paymentStatus ?? x?.payment_status ?? null;

  return {
    id: Number(id),
    tableId,
    tableName,
    date,
    time,
    people: people ? Number(people) : null,
    status,
    amount: amount ? Number(amount) : null,
    createdAt,
    paymentStatus,
  };
}

export default function MyReservationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [list, setList] = useState<Reservation[]>([]);

  const fetchList = async () => {
    setLoading(true);
    try {
      // เรียงลำดับการลอง endpoint
      let data: any = null;

      // 1) /reservations/my
      try {
        const r = await axios.get(`${config.apiUrl}/reservations/my`, {
          headers: { ...authHeader(), "Cache-Control": "no-store" },
        });
        data = r.data;
      } catch {}

      // 2) สำรอง /reservations?mine=1
      if (!data) {
        try {
          const r = await axios.get(`${config.apiUrl}/reservations`, {
            headers: { ...authHeader(), "Cache-Control": "no-store" },
            params: { mine: 1 },
          });
          data = r.data;
        } catch {}
      }

      // 3) สำรอง /reservations/user/me
      if (!data) {
        try {
          const r = await axios.get(`${config.apiUrl}/reservations/user/me`, {
            headers: { ...authHeader(), "Cache-Control": "no-store" },
          });
          data = r.data;
        } catch {}
      }

      const arr: any[] = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
      const normalized = (arr || []).map(normalizeReservation).filter((x) => x.id);
      setList(normalized);
    } catch (e: any) {
      Swal.fire({ icon: "error", title: "ดึงข้อมูลไม่สำเร็จ", text: e?.message || "กรุณาลองใหม่" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ตรวจ token ก่อน
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      Swal.fire({
        icon: "info",
        title: "กรุณาเข้าสู่ระบบก่อน",
        confirmButtonText: "ไปหน้าเข้าสู่ระบบ",
      }).then(() => {
        router.push("/signIn?redirect=" + encodeURIComponent("/my-reservations"));
      });
      return;
    }
    fetchList();
  }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    let arr = list;

    // filter tab
    if (activeTab !== "ALL") {
      if (activeTab === "CREATED") {
        // รวม CREATED/OTP_SENT
        arr = arr.filter((x) => ["CREATED", "OTP_SENT"].includes(String(x.status || "")));
      } else {
        arr = arr.filter((x) => String(x.status || "") === activeTab);
      }
    }

    // filter date range (ถ้าเลือก)
    if (dateFrom) {
      arr = arr.filter((x) => !x.date || x.date >= dateFrom);
    }
    if (dateTo) {
      arr = arr.filter((x) => !x.date || x.date <= dateTo);
    }

    // เรียงใหม่: ล่าสุดก่อน
    arr = [...arr].sort((a, b) => {
      const aKey = `${a.date ?? ""} ${a.time ?? ""}`;
      const bKey = `${b.date ?? ""} ${b.time ?? ""}`;
      return aKey < bKey ? 1 : aKey > bKey ? -1 : 0;
    });

    return arr;
  }, [list, activeTab, dateFrom, dateTo]);

  const goDetails = (r: Reservation) => {
    // ส่งต่อไปหน้า results (อย่างน้อยก็มี tableId; ถ้ามี date/time/people จะติดไปด้วย)
    const sp = new URLSearchParams();
    if (r.date) sp.set("date", r.date);
    if (r.time) sp.set("time", r.time);
    if (typeof r.people === "number" && r.people > 0) sp.set("people", String(r.people));
    if (r.tableId) sp.set("tableId", String(r.tableId));
    if (r.tableName) sp.set("tableName", String(r.tableName));
    router.push(`/results?${sp.toString()}`);
  };

  const statusPill = (s?: string | null) => {
    const v = String(s || "").toUpperCase();
    const map: Record<string, string> = {
      CREATED: "bg-yellow-100 text-yellow-800 border-yellow-200",
      OTP_SENT: "bg-yellow-100 text-yellow-800 border-yellow-200",
      AWAITING_PAYMENT: "bg-amber-100 text-amber-800 border-amber-200",
      CONFIRMED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
      DEFAULT: "bg-slate-100 text-slate-700 border-slate-200",
    };
    const cls = map[v] || map.DEFAULT;
    const labelMap: Record<string, string> = {
      CREATED: "รอยืนยัน",
      OTP_SENT: "รอ OTP",
      AWAITING_PAYMENT: "รอชำระ",
      CONFIRMED: "ยืนยันแล้ว",
      CANCELLED: "ยกเลิก",
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
        {labelMap[v] || v || "ไม่ทราบสถานะ"}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <TopNav />

      <section className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">การจองของฉัน</h1>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  activeTab === t.key
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
            <label className="text-sm">
              <div className="text-slate-600 mb-1">ตั้งแต่วันที่</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <div className="text-slate-600 mb-1">ถึงวันที่</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </label>
          </div>
        </Card>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            <Card className="p-6 text-slate-500">กำลังโหลดประวัติการจอง…</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-6 text-slate-500">ยังไม่พบรายการ</Card>
          ) : (
            filtered.map((r) => (
              <Card key={`res-${r.id}`} className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold">#{r.id}</div>
                    {statusPill(r.status)}
                  </div>
                  <div className="text-sm text-slate-700">
                    วันที่: <b>{r.date || "-"}</b> เวลา: <b>{r.time || "-"}</b>
                  </div>
                  <div className="text-sm text-slate-700">
                    โต๊ะ: <b>{r.tableName || r.tableId || "-"}</b> — จำนวนคน: <b>{r.people || "-"}</b>
                  </div>
                  <div className="text-sm text-slate-700">
                    ยอดรวม: <b>{money(r.amount)} บาท</b>
                    {r.paymentStatus ? <span className="ml-2 text-xs text-slate-500">({r.paymentStatus})</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => goDetails(r)}>ดูรายละเอียด</Button>
                  {/* ปุ่มเสริมเช่น ยกเลิก/ชำระเงิน เพิ่มได้ภายหลัง */}
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
