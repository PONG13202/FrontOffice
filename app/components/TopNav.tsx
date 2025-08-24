"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { config } from "@/app/config";

const LS_CART_KEY = "cart:v1";       // เมนู
const LS_BOOKING_KEY = "booking:v1"; // โต๊ะ

type User = {
  user_id: number;
  user_name: string;
  user_fname?: string | null;
  user_lname?: string | null;
  user_email: string;
  user_phone?: string | null;
  user_img?: string | null;
  user_status?: number | null;
  google_id?: string | null;
};

type BookingDraft = {
  tableId?: string;
  date?: string;
  time?: string;
  people?: number;
  duration?: number;
  savedAt?: number;
};

export default function TopNav() {
  const router = useRouter();

  const [count, setCount] = useState(0);
  const [hasBooking, setHasBooking] = useState(false);
  const [foodItemsCount, setFoodItemsCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // user auth state
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ---------- อ่าน Cart + Booking รวมกัน ----------
  useEffect(() => {
    setMounted(true);

    const readSnapshot = () => {
      let total = 0;
      let itemsCount = 0;
      let hasBk = false;

      // 1) จำนวนเมนูในตะกร้า
      try {
        const raw = localStorage.getItem(LS_CART_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, { qty: number }>) : {};
        itemsCount = Object.values(obj).reduce((a, c: any) => a + (c?.qty || 0), 0);
        total += itemsCount;
      } catch {}

      // 2) ถ้าเลือกโต๊ะอยู่ให้ +1
      try {
        const braw = localStorage.getItem(LS_BOOKING_KEY);
        if (braw) {
          const b = JSON.parse(braw);
          if (b && b.tableId) {
            hasBk = true;
            total += 1;
          }
        }
      } catch {}

      return { total, hasBk, itemsCount };
    };

    const sync = () => {
      const s = readSnapshot();
      setCount(s.total);
      setHasBooking(s.hasBk);
      setFoodItemsCount(s.itemsCount);
    };

    sync(); // แรกเข้า
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_CART_KEY || e.key === LS_BOOKING_KEY) sync();
    };
    const onCart = () => sync();
    const onBooking = () => sync();
    const onFocus = () => sync();
    const onPageshow = () => sync();
    const onVisible = () => { if (document.visibilityState === "visible") sync(); };

    window.addEventListener("storage", onStorage);
    window.addEventListener("cart:changed", onCart as any);
    window.addEventListener("booking:changed", onBooking as any);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageshow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cart:changed", onCart as any);
      window.removeEventListener("booking:changed", onBooking as any);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageshow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // ---------- โหลดข้อมูลผู้ใช้จาก token ----------
  useEffect(() => {
    let ignore = false;

    const fetchMe = async () => {
      setLoadingUser(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setUser(null);
          return;
        }
        const { data } = await axios.get(`${config.apiUrl}/user_info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ignore) setUser(data?.user ?? null);
      } catch {
        // token เสีย/หมดอายุ → ลบออก
        localStorage.removeItem("token");
        if (!ignore) setUser(null);
      } finally {
        if (!ignore) setLoadingUser(false);
      }
    };

    fetchMe();

    // กรณีข้ามแท็บ: ถ้า token เปลี่ยนจากแท็บอื่น ให้รีเฟรช state
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token") fetchMe();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      ignore = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // ---------- utils ----------
  const displayName = user
    ? ([user.user_fname, user.user_lname].filter(Boolean).join(" ").trim() || user.user_name)
    : "";

  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("");

  const imageUrl = (p?: string | null) => {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    // เสิร์ฟ static ผ่าน /uploads; ป้องกัน // ซ้อนกัน
    return `${config.apiUrl}/${p.replace(/^\/+/, "")}`;
  };

  const handleSignOut = async () => {
    const res = await Swal.fire({
      title: "ออกจากระบบ?",
      text: "คุณต้องการออกจากระบบตอนนี้หรือไม่",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
    });

    if (res.isConfirmed) {
      localStorage.removeItem("token");
      localStorage.removeItem("tempToken");
      localStorage.removeItem("booking:v1");
      localStorage.removeItem("cart:v1");

      setUser(null);
      await Swal.fire({
        icon: "success",
        title: "ออกจากระบบสำเร็จ",
        showConfirmButton: false,
        timer: 1100,
      });
      router.push("/");
    }
  };

  // ---------- helpers สำหรับ Cart ----------
  const readBooking = (): BookingDraft | null => {
    try {
      const raw = localStorage.getItem(LS_BOOKING_KEY);
      return raw ? (JSON.parse(raw) as BookingDraft) : null;
    } catch {
      return null;
    }
  };

  const buildResultsUrl = (openCart: boolean) => {
    const bk = readBooking();
    const sp = new URLSearchParams();
    if (bk?.date) sp.set("date", bk.date);
    if (bk?.time) sp.set("time", bk.time);
    if (typeof bk?.people === "number" && bk.people > 0) sp.set("people", String(bk.people));
    if (typeof bk?.duration === "number" && bk.duration > 0) sp.set("duration", String(bk.duration));
    if (bk?.tableId) sp.set("tableId", String(bk.tableId));
    if (openCart) sp.set("openCart", "1");
    const qs = sp.toString();
    return `/results${qs ? `?${qs}` : ""}`;
  };

  // ---- คลิกปุ่ม Cart: ตัดสินใจเส้นทางตามสถานะ ----
  const handleCartClick = async () => {
    const bk = readBooking();

    // 1) ถ้ามี booking แล้ว → ไปหน้า results พร้อมแนบพารามิเตอร์ครบ (รวม tableId)
    if (bk?.tableId) {
      // ถ้ามีอาหารด้วย ให้เปิดตะกร้า
      router.push(buildResultsUrl(foodItemsCount > 0));
      return;
    }

    // 2) ยังไม่มี booking แต่มีอาหารในตะกร้า → ให้ไปเลือกโต๊ะก่อน
    if (foodItemsCount > 0) {
      const r = await Swal.fire({
        icon: "info",
        title: "ยังไม่ได้เลือกโต๊ะ",
        text: "กรุณาเลือกโต๊ะก่อนดูสรุปคำสั่งซื้อ",
        confirmButtonText: "ไปเลือกโต๊ะ",
      });
      if (r.isConfirmed) {
        router.push("/table");
      }
      return;
    }

    // 3) ไม่มีทั้งโต๊ะและอาหาร → ไปหน้าเมนูเพื่อเริ่มสั่ง
    router.push("/menu");
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
      <nav className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        {/* left */}
        <div className="flex items-center gap-3">
          <button aria-label="menu" className="lg:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <Link href="/" className="text-lg font-semibold">
            <span className="text-gray-900">Welcome to </span>
            <span className="text-indigo-600">SaiLom</span>
          </Link>
        </div>

        {/* center */}
        <ul className="hidden lg:flex items-center gap-6 text-sm">
          <li><Link href="/" className="text-gray-700 hover:text-indigo-600">Home</Link></li>
          <li><Link href="/table" className="text-gray-700 hover:text-indigo-600">Table</Link></li>
          <li><Link href="/menu" className="text-gray-700 hover:text-indigo-600">Menu</Link></li>
          <li><Link href="/about" className="text-gray-700 hover:text-indigo-600">About</Link></li>
          <li><Link href="http://localhost:3000/backoffice/dashboard" className="text-gray-700 hover:text-indigo-600" target="_blank" rel="noopener noreferrer">Dashboard</Link></li>
        </ul>

        {/* right */}
        <div className="flex items-center gap-2">
          {/* Cart: ใช้ button เพื่อควบคุมเส้นทางด้วย JS */}
          <button
            onClick={handleCartClick}
            className="cursor-pointer relative inline-flex items-center rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50 transition"
            title="Cart"
            type="button"
          >
            <span>Cart</span>
            <span
              className="ml-2 inline-flex min-w-[22px] items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs font-semibold text-white"
              suppressHydrationWarning
            >
              {mounted ? count : 0}
            </span>
          </button>

          {/* Auth area */}
          {mounted && !loadingUser && user ? (
            <>
              <Link
                href="/profile"
                className="hidden sm:inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 hover:bg-slate-50 transition"
                title={displayName}
              >
                {imageUrl(user.user_img) ? (
                  <Image
                    src={imageUrl(user.user_img)!}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-xs font-semibold">
                    {initials(displayName || user.user_name)}
                  </div>
                )}
                <span className="text-sm text-gray-700 max-w-[140px] truncate">{displayName}</span>
              </Link>

              <Button
                onClick={handleSignOut}
                className="cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition"
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                asChild
                className="hidden sm:inline-flex border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition shadow-sm hover:shadow-md"
              >
                <Link href="/signIn">Sign in</Link>
              </Button>
              <Button
                asChild
                className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition"
              >
                <Link href="/signUp">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
