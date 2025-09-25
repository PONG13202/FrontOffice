"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { config } from "@/app/config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { socket } from "@/app/socket";
import { readBookingSafe, clearBooking, writeBookingSafe } from "@/lib/bookingStore";

/* ==== Types ==== */
type MenuImage = { menu_image_id: number; menu_id: number; menu_image: string; menu_status: number };
type FoodMenuTypeJoin = { typefood?: { id?: number; name?: string; typefood_id?: number; typefood_name?: string }; typefoodId?: number };
type MenuItem = {
  menu_id: number;
  menu_name: string;
  menu_price: number;
  menu_description?: string | null;
  menu_status: number;
  MenuImages?: MenuImage[];
  Typefoods?: FoodMenuTypeJoin[];
};
type FoodType = { id?: number; name?: string; typefood_id?: number; typefood_name?: string };
type CartItem = { id: number; name: string; price: number; qty: number; img?: string | null; note?: string };

const THB = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const money = (n: number) => THB.format(n);
const imgAbsUrl = (p?: string | null) => (!p ? "" : p.startsWith("http") ? p : `${config.apiUrl}${p}`);
const coverOf = (m: MenuItem): string | null => {
  const main = m.MenuImages?.find((im) => im.menu_status === 1);
  const first = m.MenuImages?.[0];
  return main?.menu_image ?? first?.menu_image ?? null;
};
const getTypefoodName = (t: any): string | undefined =>
  t?.typefood?.typefood_name ?? t?.typefood?.name ?? t?.typefood_name ?? t?.name;
const getTypefoodId = (t: any): number | undefined =>
  t?.typefood?.typefood_id ?? t?.typefood?.id ?? t?.typefoodId ?? t?.id;
const typeNamesOf = (m?: MenuItem | null): string[] => {
  const names = (m?.Typefoods ?? [])
    .map((t: any) => getTypefoodName(t))
    .filter((s): s is string => !!s && s.trim().length > 0);
  return Array.from(new Set(names));
};
const normalizeFoodTypes = (arr: any[]): { id: number; name: string }[] =>
  (arr ?? [])
    .map((t) => ({ id: t?.id ?? t?.typefood_id, name: t?.name ?? t?.typefood_name }))
    .filter((t) => typeof t.id === "number" && !!t.name);

/* ==== MenuCard ==== */
function MenuCard({
  item,
  count,
  onInc,
  onDec,
  onOpenDetail,
}: {
  item: MenuItem;
  count: number;
  onInc: () => void;
  onDec: () => void;
  onOpenDetail: () => void;
}) {
  const cover = coverOf(item);
  const types = typeNamesOf(item);
  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onOpenDetail}
        className="cursor-pointer relative aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        {cover ? (
          <Image
            src={imgAbsUrl(cover)}
            alt={item.menu_name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            unoptimized
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-slate-400">
            ไม่มีรูปภาพ
          </div>
        )}
      </button>

      <div className="flex flex-col gap-1 px-3 pt-2">
        <button type="button" onClick={onOpenDetail} className="text-left cursor-pointer">
          <div className="text-sm font-semibold text-slate-900">{money(item.menu_price)}</div>
        </button>

        {types.length > 0 && (
          <div className="relative -mx-0.5 flex flex-wrap items-center gap-1.5 overflow-hidden pr-6">
            {types.slice(0, 3).map((name) => (
              <span
                key={`card-type-${item.menu_id}-${name}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] leading-4 text-slate-600"
              >
                {name}
              </span>
            ))}
            {types.length > 3 && <span className="text-[10px] text-slate-500">+{types.length - 3}</span>}
            <span className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
          </div>
        )}

        <button type="button" onClick={onOpenDetail} className="text-left cursor-pointer">
          <div className="line-clamp-2 text-sm text-slate-700">{item.menu_name}</div>
        </button>
      </div>

      <div className="mt-auto border-t px-3 py-3">
        <div className="flex items-center justify-center gap-3">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full cursor-pointer"
            onClick={onDec}
            disabled={count <= 0}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-5 text-center text-sm tabular-nums">{count}</span>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-full cursor-pointer"
            onClick={onInc}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ==== Cart / Booking ==== */
const LS_CART_KEY = "cart:v1";
type BookingDraft = {
  tableId?: string;
  tableName?: string;
  date?: string;
  time?: string;
  people?: number;
  duration?: number;
  savedAt?: number;
};

export default function MenuPage() {
  const router = useRouter();

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [catId, setCatId] = useState<number | null>(null);

  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [ready, setReady] = useState(false);
  const lastSavedRef = useRef<string>("");
  const [cartOpen, setCartOpen] = useState(false);

  // ===== CART: init + sync =====
  useEffect(() => {
    const readCart = (): Record<number, CartItem> => {
      try {
        const raw = localStorage.getItem(LS_CART_KEY);
        if (!raw) return {};
        const obj = JSON.parse(raw) as Record<string, CartItem>;
        const out: Record<number, CartItem> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof (v as any).id === "number" && typeof (v as any).qty === "number")
            out[Number(k)] = v as CartItem;
        }
        return out;
      } catch {
        return {};
      }
    };
    const data = readCart();
    setCart(data);
    lastSavedRef.current = JSON.stringify(data);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      const json = JSON.stringify(cart);
      if (json === lastSavedRef.current) return;
      lastSavedRef.current = json;
      localStorage.setItem(LS_CART_KEY, json);
      window.dispatchEvent(new CustomEvent("cart:changed"));
    } catch {}
  }, [cart, ready]);

  useEffect(() => {
    if (!ready) return;

    const equal = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
    const read = () => {
      try {
        const raw = localStorage.getItem(LS_CART_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    };
    const sync = () => {
      const next = read();
      setCart((prev) => (equal(prev, next) ? prev : next));
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_CART_KEY) sync();
    };
    const onFocus = () => sync();
    const onPageshow = (e: PageTransitionEvent) => {
      if ((e as any).persisted) sync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageshow as any);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageshow as any);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready]);

  // ===== BOOKING: read & subscribe =====
  const [booking, setBooking] = useState<BookingDraft | null>(null);
  useEffect(() => {
    const read = () => setBooking(readBookingSafe());
    read();
    const onVisible = () => {
      if (document.visibilityState === "visible") read();
    };
    window.addEventListener("booking:changed", read as any);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("booking:changed", read as any);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // ===== MENUS & realtime =====
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [mRes, fRes] = await Promise.all([
          axios.get<MenuItem[]>(`${config.apiUrl}/menu`, { headers: { "Cache-Control": "no-store" } }),
          axios.get<FoodType[]>(`${config.apiUrl}/foodType`, { headers: { "Cache-Control": "no-store" } }),
        ]);
        if (!mounted) return;
        setMenus(mRes.data || []);
        setFoodTypes(fRes.data || []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    if (!socket.connected) socket.connect();

const upsertMenus = (payload: any) => {
  const items: MenuItem[] = Array.isArray(payload) ? payload : [payload];
  setMenus((prev) => {
    const map = new Map<number, MenuItem>(prev.map((m) => [m.menu_id, m]));
    for (const it of items) {
      if (!it || typeof it.menu_id !== "number") continue;

      // ✅ ถ้าอัปเดตมาเป็น Inactive ให้ลบทิ้งจาก state
      if ((it.menu_status ?? 1) !== 1) {
        map.delete(it.menu_id);
        continue;
      }

      const existed = map.get(it.menu_id) ?? ({} as MenuItem);
      map.set(it.menu_id, { ...existed, ...it });
    }
    // กันเหนียว: คืนเฉพาะที่ status=1
    return Array.from(map.values()).filter((m) => (m.menu_status ?? 1) === 1);
  });
};

    const removeMenus = (payload: any) => {
      const ids = Array.isArray(payload)
        ? payload.map((x) => (typeof x === "number" ? x : x?.menu_id)).filter((n) => typeof n === "number")
        : [typeof payload === "number" ? payload : payload?.menu_id].filter((n) => typeof n === "number");
      if (ids.length === 0) return;
      setMenus((prev) => prev.filter((m) => !ids.includes(m.menu_id)));
    };

    const onMenuAll = (payload: any) => {
      if (Array.isArray(payload)) setMenus(payload as MenuItem[]);
      else upsertMenus(payload);
    };
    const onFoodTypeAll = (payload: any[]) => {
      setFoodTypes(normalizeFoodTypes(payload) as any);
    };
    const onMenuAdded = (payload: any) => upsertMenus(payload);
    const onMenuUpdated = (payload: any) => upsertMenus(payload);
    const onMenuDeleted = (payload: any) => removeMenus(payload);

    socket.on("menu", onMenuAll);
    socket.on("foodType", onFoodTypeAll);
  socket.on("menu:created", onMenuAdded);
  socket.on("menu:updated", onMenuUpdated);
  socket.on("menu:deleted", onMenuDeleted);

    return () => {
    socket.off("menu", onMenuAll);
    socket.off("foodType", onFoodTypeAll);
    socket.off("menu:created", onMenuAdded);
    socket.off("menu:updated", onMenuUpdated);
    socket.off("menu:deleted", onMenuDeleted);
    };
  }, []);

  // ===== Filters =====
const filtered = useMemo(() => {
  const kw = q.trim().toLowerCase();
  return menus
    .filter((m) => (m.menu_status ?? 1) === 1) // ✅ เพิ่มบรรทัดนี้
    .filter((m) => {
      const matchQ = !kw || m.menu_name.toLowerCase().includes(kw) || String(m.menu_price).includes(kw);
      const matchCat = !catId || (m.Typefoods ?? []).some((t) => getTypefoodId(t) === catId);
      return matchQ && matchCat;
    });
}, [menus, q, catId]);


  // ===== Cart helpers =====
  const NOTE_MAX = 160;
  const bump = (item: MenuItem, delta: number) => {
    setCart((prev) => {
      const existed = prev[item.menu_id];
      const nextQty = (existed?.qty || 0) + delta;
      if (nextQty <= 0) {
        const { [item.menu_id]: _omit, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [item.menu_id]: {
          id: item.menu_id,
          name: item.menu_name,
          price: item.menu_price,
          qty: Math.min(99, nextQty),
          img: coverOf(item) ?? undefined,
          note: existed?.note ?? "",
        },
      };
    });
  };
  const setNote = (id: number, val: string) =>
    setCart((p) => (p[id] ? { ...p, [id]: { ...p[id], note: val.slice(0, NOTE_MAX) } } : p));
  const incCart = (id: number) => setCart((p) => ({ ...p, [id]: { ...p[id], qty: Math.min(99, (p[id]?.qty ?? 0) + 1) } }));
  const decCart = (id: number) =>
    setCart((p) =>
      (p[id]?.qty ?? 0) > 1 ? { ...p, [id]: { ...p[id], qty: (p[id].qty ?? 1) - 1 } } : (() => {
        const { [id]: _, ...rest } = p;
        return rest;
      })(),
    );
  const remove = (id: number) => setCart((p) => {
    const { [id]: _, ...rest } = p;
    return rest;
  });
  const clear = () => setCart({});
  const itemCount = useMemo(() => Object.values(cart).reduce((a, c) => a + c.qty, 0), [cart]);
  const total = useMemo(() => Object.values(cart).reduce((a, c) => a + c.qty * c.price, 0), [cart]);

  // ===== Results URL + ensure booking saved =====
  const buildResultsUrl = (openCart: boolean = true) => {
    const bk = readBookingSafe() || booking;
    const sp = new URLSearchParams();
    if (bk?.date) sp.set("date", bk.date);
    if (bk?.time) sp.set("time", bk.time);
    if (typeof bk?.people === "number" && bk.people > 0) sp.set("people", String(bk.people));
    if (typeof bk?.duration === "number" && bk.duration > 0) sp.set("duration", String(bk.duration));
    if (bk?.tableId) sp.set("tableId", String(bk.tableId));
    if (bk?.tableName) sp.set("tableName", String(bk.tableName));
    if (openCart) sp.set("openCart", "1");
    const qs = sp.toString();
    return `/results${qs ? `?${qs}` : ""}`;
  };

  const goToResults = () => {
    // บันทึก snapshot ล่าสุดของ booking ลง LS อีกรอบกันหาย
    const prev = readBookingSafe() || {};
    writeBookingSafe({
      ...prev,
      tableId: booking?.tableId ?? prev.tableId,
      tableName: booking?.tableName ?? prev.tableName,
      date: booking?.date ?? prev.date,
      time: booking?.time ?? prev.time,
      people: booking?.people ?? prev.people,
      // ไม่แตะ reservationId ที่อาจจะเคยมี
    });
    router.push(buildResultsUrl(true));
  };

  // ===== UI =====
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [detailActiveSrc, setDetailActiveSrc] = useState<string | null>(null);
  const openDetail = (item: MenuItem) => {
    setDetailItem(item);
    setDetailOpen(true);
    setDetailActiveSrc(imgAbsUrl(coverOf(item)));
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      

      <section className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">เมนูอาหาร</h1>
            <p className="text-sm text-slate-600">
              กด + เพื่อเพิ่มเข้าตะกร้า หรือคลิกรูป/ชื่อเมนูเพื่อดูรายละเอียด
            </p>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="cursor-pointer relative inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-white shadow-sm hover:bg-violet-700"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm" suppressHydrationWarning>{ready ? itemCount : 0} รายการ</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs" suppressHydrationWarning>
              {ready ? money(total) : money(0)}
            </span>
          </button>
        </div>

        {/* แถบแจ้งโต๊ะที่เลือก */}
        {booking?.tableId && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <div>
              มีการเลือกโต๊ะไว้: <b>{booking.tableId}</b>
              {booking.tableName ? <> ({booking.tableName})</> : null}
              {booking.date || booking.time ? <> — {booking.date ?? ""} {booking.time ?? ""}</> : null}
              {typeof booking.people === "number" ? <> · {booking.people} คน</> : null}
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={goToResults}>
                ไปหน้าสรุปการจอง
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  clearBooking();
                  setBooking(null);
                }}
              >
                ล้างค่าโต๊ะ
              </Button>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเมนูหรือราคา…" className="h-10" />
          {useMemo(() => {
            const seen = new Set<number>();
            const unique: { id: number; name: string }[] = [];
            for (const t of foodTypes) {
              const id = (t.typefood_id ?? t.id) as number | undefined;
              const name = (t.typefood_name ?? t.name) as string | undefined;
              if (typeof id !== "number" || !name) continue;
              if (seen.has(id)) continue;
              seen.add(id);
              unique.push({ id, name });
            }
            if (unique.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-2">
                <button
                  key="cat--1"
                  onClick={() => setCatId(null)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm cursor-pointer",
                    catId === null ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50",
                  )}
                >
                  ทั้งหมด
                </button>
                {unique.map((t) => (
                  <button
                    key={`cat-${t.id}`}
                    onClick={() => setCatId(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm cursor-pointer",
                      catId === t.id ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            );
          }, [foodTypes, catId])}
        </div>

        <div className="relative w-full rounded-2xl border border-dashed border-violet-300 bg-white/60 p-4 shadow-sm">
          {loading ? (
            <div className="grid min-h-[300px] place-items-center text-slate-500">กำลังโหลดเมนู…</div>
          ) : filtered.length === 0 ? (
            <div className="grid min-h-[300px] place-items-center text-slate-500">ไม่พบเมนูที่ตรงกับเงื่อนไข</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((m) => {
                const count = ready ? (cart[m.menu_id]?.qty ?? 0) : 0;
                return (
                  <MenuCard
                    key={`menu-${m.menu_id}`}
                    item={m}
                    count={count}
                    onInc={() => bump(m, +1)}
                    onDec={() => count > 0 && bump(m, -1)}
                    onOpenDetail={() => openDetail(m)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="sm:max-w-lg bg-white p-0 overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
          <div className="border-b px-4 py-3">
            <DialogHeader className="p-0">
              <DialogTitle className="text-base font-semibold">ตะกร้าสินค้า</DialogTitle>
            </DialogHeader>
          </div>

          {Object.values(cart).length === 0 ? (
            <div className="grid h-48 place-items-center text-slate-500">ยังไม่มีสินค้าในตะกร้า</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
              {Object.values(cart).map((ci) => (
                <div key={`cart-${ci.id}`} className="space-y-2 rounded-lg border p-2 bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        {ci.img ? (
                          <Image src={imgAbsUrl(ci.img)} alt={ci.name} fill sizes="56px" className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{ci.name}</div>
                        <div className="text-xs text-slate-600">{money(ci.price)}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 rounded-full cursor-pointer"
                        onClick={() => decCart(ci.id)}
                        aria-label="ลดจำนวน"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-5 text-center text-sm tabular-nums">{ci.qty}</span>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 rounded-full cursor-pointer"
                        onClick={() => incCart(ci.id)}
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 cursor-pointer"
                        onClick={() => remove(ci.id)}
                        aria-label="ลบออก"
                      >
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <textarea
                      value={ci.note ?? ""}
                      onChange={(e) => setNote(ci.id, e.target.value)}
                      placeholder="โน้ตเมนูนี้ (เช่น ไม่เผ็ด, แยกพริก) — ไม่เกิน 160 ตัวอักษร"
                      maxLength={NOTE_MAX}
                      className="w-full h-16 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <div className="mt-1 text-[10px] text-slate-500 text-right">
                      {(ci.note?.length ?? 0)}/{NOTE_MAX}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between bg-slate-50 border-t px-4 py-3">
            <div className="text-sm text-slate-600" suppressHydrationWarning>
              รวม {ready ? itemCount : 0} รายการ
            </div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold text-slate-900" suppressHydrationWarning>
                {ready ? money(total) : money(0)}
              </div>
              <Button className="cursor-pointer" variant="ghost" onClick={clear} disabled={Object.values(cart).length === 0}>
                ล้างตะกร้า
              </Button>
              <Button
                className="cursor-pointer"
                onClick={() => {
                  setCartOpen(false);
                  goToResults();
                }}
                disabled={Object.values(cart).length === 0}
              >
                ไปหน้าสรุปการจอง
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* รายละเอียดเมนู */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-2xl">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">รายละเอียดเมนู</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="relative w-full overflow-hidden rounded-lg bg-slate-100" style={{ aspectRatio: "4/3" }}>
                    {detailActiveSrc ? (
                      <Image
                        src={detailActiveSrc}
                        alt={detailItem.menu_name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs text-slate-400">ไม่มีรูปภาพ</div>
                    )}
                  </div>
                  {(detailItem.MenuImages?.length ?? 0) > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {detailItem.MenuImages!.map((im) => {
                        const src = imgAbsUrl(im.menu_image);
                        const active = src === detailActiveSrc;
                        return (
                          <button
                            key={`thumb-${im.menu_image_id}`}
                            type="button"
                            onClick={() => setDetailActiveSrc(src)}
                            className={cn(
                              "relative h-16 w-20 shrink-0 overflow-hidden rounded-md border cursor-pointer",
                              active ? "ring-2 ring-violet-500 border-violet-500" : "border-slate-200",
                            )}
                            aria-label="เปลี่ยนรูปตัวอย่าง"
                          >
                            <Image src={src} alt="" fill sizes="80px" className="object-cover" unoptimized />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <div className="text-xl font-semibold text-slate-900">{detailItem.menu_name}</div>
                  {typeNamesOf(detailItem).length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">ประเภท:</span>
                      {typeNamesOf(detailItem).map((name) => (
                        <span
                          key={`detail-type-${detailItem.menu_id}-${name}`}
                          className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-lg font-bold text-violet-700">{money(detailItem.menu_price)}</div>
                  {detailItem.menu_description ? (
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{detailItem.menu_description}</p>
                  ) : null}

                  <div className="mt-auto pt-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 rounded-full cursor-pointer"
                        onClick={() => bump(detailItem, -1)}
                        disabled={(cart[detailItem.menu_id]?.qty ?? 0) <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="min-w-6 text-center text-base tabular-nums">
                        {cart[detailItem.menu_id]?.qty ?? 0}
                      </span>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 rounded-full cursor-pointer"
                        onClick={() => bump(detailItem, +1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button className="cursor-pointer" onClick={() => bump(detailItem, +1)}>
                      เพิ่มลงตะกร้า
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    
    </main>
  );
}
