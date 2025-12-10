"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { config } from "@/app/config";
import { socket } from "@/app/socket";
import TopNav from "@/app/components/TopNav";
import SiteFooter from "@/app/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GRID_SIZE = 80;
const PADDING = 80;
const LS_BOOKING_KEY = "booking:v1";

type GridSize = { id: number; rows: number; cols: number };
interface TableVM {
  id: number | string;
  x: number;
  y: number;
  active: boolean;
  name: string;
  seats: number;
  tableTypeId: number | string;
  tableTypeName?: string;
  additionalInfo?: string;
  _booked?: boolean;
  _notEnough?: boolean;
}

const toNum = (v: any) =>
  typeof v === "number" ? v : parseInt(String(v), 10) || 0;
const overlap = (a1: number, a2: number, b1: number, b2: number) =>
  a1 < b2 && b1 < a2;

function PublicTableCard({
  table,
  onClick,
}: {
  table: TableVM;
  onClick: (t: TableVM) => void;
}) {
  const disabled = !table.active || table._booked || table._notEnough;
  const reason = table._booked
    ? "ช่วงเวลานี้ถูกจอง"
    : table._notEnough
    ? "ที่นั่งไม่พอ"
    : "ปิด";

  return (
    <div className="absolute" style={{ left: table.x, top: table.y }}>
      <Card
        onClick={() => !disabled && onClick(table)}
        role="button"
        tabIndex={0}
        className={cn(
          "w-[80px] h-[80px] p-1.5 shadow-md flex flex-col justify-start gap-0 relative overflow-hidden",
          disabled
            ? "bg-gray-200 opacity-60 cursor-not-allowed"
            : "bg-white cursor-pointer hover:shadow-lg transition"
        )}
        title={disabled ? reason : `โต๊ะ ${table.name}`}
      >
        <div className="flex items-center justify-between w-full">
          <div
            className="text-[10px] font-medium text-gray-700 truncate"
            title={table.name}
          >
            {table.name}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-[9px]",
              disabled ? "text-gray-500" : "text-emerald-600"
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                disabled ? "bg-gray-400" : "bg-emerald-500"
              )}
            />
            {disabled ? "ไม่ว่าง" : "พร้อม"}
          </div>
        </div>

        <div className="mt-0.5 w-full truncate text-[10px] leading-none text-gray-700">
          {table.seats} ที่ · {table.tableTypeName || "-"}
        </div>

        <div className="flex-1" />

        <div className="pt-1">
          <Button
            className="h-7 w-full rounded-lg text-[11px] leading-[1] tracking-wide px-2 active:translate-y-px"
            disabled={disabled}
          >
            จอง
          </Button>
        </div>

        {disabled && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-medium text-slate-600">
            {reason}
          </div>
        )}
      </Card>
    </div>
  );
}

function PublicTableCanvas({
  tables,
  numRows,
  numCols,
  onSelect,
}: {
  tables: TableVM[];
  numRows: number;
  numCols: number;
  onSelect: (t: TableVM) => void;
}) {
  const {
    minWidth,
    minHeight,
    backgroundImage,
    backgroundPosition,
    backgroundSize,
  } = useMemo(() => {
    const gridBasedWidth = numCols * GRID_SIZE + PADDING;
    const gridBasedHeight = numRows * GRID_SIZE + PADDING;
    let tableBasedWidth = GRID_SIZE * 4;
    let tableBasedHeight = GRID_SIZE * 4;

    if (tables.length > 0) {
      const maxX = Math.max(...tables.map((t) => t.x));
      const maxY = Math.max(...tables.map((t) => t.y));
      tableBasedWidth = maxX + GRID_SIZE + PADDING;
      tableBasedHeight = maxY + GRID_SIZE + PADDING;
    }

    const calculatedWidth = Math.max(gridBasedWidth, tableBasedWidth);
    const calculatedHeight = Math.max(gridBasedHeight, tableBasedHeight);

    const verticalLines = Array.from({ length: numCols + 1 })
      .map(() => "linear-gradient(#e0e0e0, #e0e0e0)")
      .join(", ");
    const verticalPositions = Array.from({ length: numCols + 1 })
      .map((_, i) => `${i * GRID_SIZE}px 0`)
      .join(", ");
    const verticalSizes = Array.from({ length: numCols + 1 })
      .map(() => "1px 100%")
      .join(", ");

    const horizontalLines = Array.from({ length: numRows + 1 })
      .map(() => "linear-gradient(90deg, #e0e0e0, #e0e0e0)")
      .join(", ");
    const horizontalPositions = Array.from({ length: numRows + 1 })
      .map((_, i) => `0 ${i * GRID_SIZE}px`)
      .join(", ");
    const horizontalSizes = Array.from({ length: numRows + 1 })
      .map(() => "100% 1px")
      .join(", ");

    return {
      minWidth: calculatedWidth,
      minHeight: calculatedHeight,
      backgroundImage: `${verticalLines}, ${horizontalLines}`,
      backgroundPosition: `${verticalPositions}, ${horizontalPositions}`,
      backgroundSize: `${verticalSizes}, ${horizontalSizes}`,
    } as const;
  }, [tables, numRows, numCols]);

  return (
    <div
      id="map-zone"
      className="relative rounded-lg bg-violet-50 border border-dashed"
      style={{
        backgroundImage,
        backgroundPosition,
        backgroundSize,
        backgroundRepeat: "no-repeat",
        width: `${minWidth}px`,
        height: `${minHeight}px`,
      }}
    >
      {tables.map((table) => (
        <PublicTableCard
          key={String(table.id)}
          table={table}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// 1. เปลี่ยนชื่อ Component หลักเดิมเป็น TableContent (ไม่ต้อง export default)
// ----------------------------------------------------------------------
function TableContent() {
  const router = useRouter();
  const search = useSearchParams();

  // อ่านพารามิเตอร์จาก Home
  const date = search.get("date") ?? new Date().toISOString().slice(0, 10);
  const time = search.get("time") ?? "";
  const people = toNum(search.get("people"));
  // const durationMin = toNum(search.get("duration")) || 90;
  const DEFAULT_DURATION_MIN = 60;
  const start = useMemo(
    () => (time ? new Date(`${date}T${time}:00`) : null),
    [date, time]
  );
  const end = useMemo(
    () =>
      start ? new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000) : null,
    [start]
  );

  const [tables, setTables] = useState<TableVM[]>([]);
  const [grid, setGrid] = useState<GridSize | null>(null);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // โหลดโต๊ะ + กริด
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [tRes, gRes] = await Promise.all([
          axios.get<TableVM[]>(`${config.apiUrl}/table`, {
            headers: { "Cache-Control": "no-store" },
          }),
          axios.get<GridSize>(`${config.apiUrl}/grid`, {
            headers: { "Cache-Control": "no-store" },
          }),
        ]);
        if (!mounted) return;
        setTables((tRes.data || []).filter((x: any) => x.active));
        setGrid(gRes.data);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    // realtime table-only
    if (!socket.connected) socket.connect();
    const refreshTables = async () => {
      try {
        const { data } = await axios.get<TableVM[]>(
          `${config.apiUrl}/tables`,
          { headers: { "Cache-Control": "no-store" } }
        );
        setTables((data || []).filter((x: any) => x.active));
      } catch {}
    };
    const onAnyChange = () => refreshTables();
    socket.on("table:created", onAnyChange);
    socket.on("table:updated", onAnyChange);
    socket.on("table:deleted", onAnyChange);
    socket.on("table:status_updated", onAnyChange);
    socket.on("table:positions_saved", onAnyChange);

    return () => {
      mounted = false;
      socket.off("table:created", onAnyChange);
      socket.off("table:updated", onAnyChange);
      socket.off("table:deleted", onAnyChange);
      socket.off("table:status_updated", onAnyChange);
      socket.off("table:positions_saved", onAnyChange);
    };
  }, []);

  // โหลดการจองของวันนั้น ๆ เพื่อคำนวณโต๊ะที่ชนเวลา
  const fetchBusy = useCallback(async () => {
    if (!start || !end) {
      setBusy(new Set());
      return;
    }
    try {
      const { data } = await axios.get(`${config.apiUrl}/reservation`, {
        params: { date, includeCanceled: 0 },
        headers: { "Cache-Control": "no-store" },
      });
      const rows: Array<{ tableId: number; start: string; end: string }> =
        data?.data ?? [];
      const s = start.getTime(),
        e = end.getTime();
      const set = new Set<number>();
      for (const r of rows) {
        if (!r.tableId) continue;
        const rs = new Date(r.start).getTime();
        const re = new Date(r.end).getTime();
        if (overlap(rs, re, s, e)) set.add(r.tableId);
      }
      setBusy(set);
    } catch {
      setBusy(new Set());
    }
  }, [date, start, end]);

  useEffect(() => {
    fetchBusy();
  }, [fetchBusy]);

  // realtime reservation → รีเฟรช busy
  useEffect(() => {
    if (!socket.connected) socket.connect();
    const refresh = () => fetchBusy();
    socket.on("reservation:created", refresh);
    socket.on("reservation:updated", refresh);
    socket.on("reservation:confirmed", refresh);
    socket.on("reservation:expired", refresh);
    socket.on("reservation:canceled", refresh);
    socket.on("payment:succeeded", refresh);
    return () => {
      socket.off("reservation:created", refresh);
      socket.off("reservation:updated", refresh);
      socket.off("reservation:confirmed", refresh);
      socket.off("reservation:expired", refresh);
      socket.off("reservation:canceled", refresh);
      socket.off("payment:succeeded", refresh);
    };
  }, [fetchBusy]);

  // ผูก flags ให้โต๊ะตามพารามิเตอร์
  const decorated = useMemo<TableVM[]>(() => {
    return tables.map((t) => {
      const idNum = toNum(t.id);
      const notEnough = people > 0 && t.seats < people;
      const booked = busy.has(idNum);
      return {
        ...t,
        _notEnough: notEnough,
        _booked: booked,
        active: t.active && !notEnough && !booked,
      };
    });
  }, [tables, busy, people]);

  const numRows = grid?.rows ?? 10;
  const numCols = grid?.cols ?? 10;

  // คลิกเลือกโต๊ะ → เซฟลง localStorage + เลือกว่าจะไป "เมนู" หรือ "สรุปการจอง"
  // goNext: ตัด duration ออก และไม่ setItem ซ้ำ
  const goNext = async (t: TableVM) => {
    const draft = {
      date,
      time,
      people: Number(people || t.seats),
      tableId: String(t.id),
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(draft));
      window.dispatchEvent(new Event("booking:changed"));
      window.dispatchEvent(new Event("cart:changed"));
    } catch {}

    const query = new URLSearchParams({
      date: draft.date,
      ...(draft.time ? { time: draft.time } : {}),
      people: String(draft.people),
      tableId: draft.tableId,
    }).toString();

    const r = await Swal.fire({
      icon: "question",
      title: "เลือกโต๊ะแล้ว",
      text: "ต้องการไปเลือกอาหารเลยไหม?",
      showCancelButton: true,
      confirmButtonText: "ไปเลือกอาหาร",
      cancelButtonText: "ไปหน้าสรุปการจอง",
    });

    if (r.isConfirmed) {
      // ใช้ router.push ก็ได้ จะลื่นกว่า
      window.location.href = "/menu";
    } else {
      window.location.href = `/results?${query}`;
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <TopNav />

      <section className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">เลือกโต๊ะนั่ง</h1>
          <p className="text-sm text-slate-600">
            {time
              ? `วันที่ ${date} เวลา ${time} — แตะโต๊ะเพื่อจอง`
              : "ผังหน้าบ้าน (ตาราง 80px) — แตะโต๊ะเพื่อจอง"}
          </p>
        </div>

        <div className="relative w-full overflow-auto rounded-2xl border border-dashed border-violet-300 bg-white/60 p-3 shadow-sm">
          {loading ? (
            <div className="grid min-h-[480px] place-items-center text-slate-500">
              กำลังโหลดแผนผังโต๊ะ…
            </div>
          ) : decorated.length === 0 ? (
            <div className="grid min-h-[480px] place-items-center text-slate-500">
              ยังไม่มีโต๊ะที่เปิดให้บริการ
            </div>
          ) : (
            <PublicTableCanvas
              tables={decorated}
              numRows={numRows}
              numCols={numCols}
              onSelect={goNext}
            />
          )}
        </div>

        <div className="mt-2 text-xs text-slate-500">
          * สีเทา/จาง หมายถึง ไม่ว่างช่วงเวลานี้ หรือที่นั่งไม่พอ
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

// ----------------------------------------------------------------------
// 2. สร้าง Wrapper Component สำหรับ export default ที่มี Suspense
// ----------------------------------------------------------------------
export default function PublicTablePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          กำลังโหลด...
        </div>
      }
    >
      <TableContent />
    </Suspense>
  );
}