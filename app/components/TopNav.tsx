"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { config } from "@/app/config";
import { readBookingSafe, clearBooking } from "@/lib/bookingStore";

const LS_CART_KEY = "cart:v1";
const LS_BOOKING_KEY = "booking:v1"; // legacy (ยังลบตอน sign out)
const LS_USER_KEY = "user:v1";

type Role = "user" | "staff" | "admin";
type User = {
  user_id: number;
  user_name?: string | null;
  user_fname?: string | null;
  user_lname?: string | null;
  user_email: string;
  user_phone?: string | null;
  user_img?: string | null;
  user_status?: number | null;
  google_id?: string | null;
  isAdmin?: boolean;
  isStaff?: boolean;
  roles?: Role[];
  role?: Role;
};
type BookingDraft = { tableId?: string; date?: string; time?: string; people?: number; savedAt?: number };

export default function TopNav() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [foodItemsCount, setFoodItemsCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    setMounted(true);

    const readSnapshot = () => {
      let total = 0;
      let itemsCount = 0;
      try {
        const raw = localStorage.getItem(LS_CART_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, { qty: number }>) : {};
        itemsCount = Object.values(obj).reduce((a, c: any) => a + (c?.qty || 0), 0);
        total += itemsCount;
      } catch {}
      try {
        const bk = readBookingSafe();
        if (bk?.tableId) total += 1;
      } catch {}
      return { total, itemsCount };
    };

    const sync = () => {
      const s = readSnapshot();
      setCount(s.total);
      setFoodItemsCount(s.itemsCount);
    };

    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_CART_KEY) sync();
      if (e.key === LS_USER_KEY) {
        try {
          const raw = e.newValue;
          setUser(raw ? (JSON.parse(raw) as User) : null);
        } catch {}
      }
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

  useEffect(() => {
    let ignore = false;

    const publishUser = (u: User | null) => {
      try {
        if (u) {
          localStorage.setItem(LS_USER_KEY, JSON.stringify(u));
          (window as any).__USER__ = u;
        } else {
          localStorage.removeItem(LS_USER_KEY);
          (window as any).__USER__ = null;
        }
        window.dispatchEvent(new CustomEvent("user:updated", { detail: u }));
      } catch {}
    };

    const normalizeUser = (raw: any): User | null => {
      if (!raw) return null;
      const u = raw.user ?? raw;
      const roles: Role[] | undefined = u.roles;
      const role: Role =
        u.role ??
        (roles?.includes("admin") ? "admin" :
         roles?.includes("staff") ? "staff" : "user");
      const ensuredUserName =
        u.user_name ?? (typeof u.user_email === "string" ? u.user_email.split("@")[0] : null);
      return {
        user_id: u.user_id,
        user_name: ensuredUserName,
        user_fname: u.user_fname ?? null,
        user_lname: u.user_lname ?? null,
        user_email: u.user_email,
        user_phone: u.user_phone ?? null,
        user_img: u.user_img ?? null,
        user_status: u.user_status ?? null,
        google_id: u.google_id ?? null,
        isAdmin: !!u.isAdmin,
        isStaff: !!u.isStaff,
        roles: Array.isArray(roles) ? roles : undefined,
        role,
      };
    };

    const fetchMe = async () => {
      setLoadingUser(true);
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token) {
          if (!ignore) {
            setUser(null);
            publishUser(null);
          }
          return;
        }
        const { data } = await axios.get(`${config.apiUrl}/user_info`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const u = normalizeUser(data);
        if (!ignore) {
          setUser(u);
          publishUser(u);
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        if (!ignore) {
          setUser(null);
          publishUser(null);
        }
      } finally {
        if (!ignore) setLoadingUser(false);
      }
    };

    fetchMe();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" || e.key === "authToken") fetchMe();
      if (e.key === LS_USER_KEY) {
        try {
          const raw = e.newValue;
          setUser(raw ? (JSON.parse(raw) as User) : null);
        } catch {}
      }
    };
    const onRefresh = () => fetchMe();

    window.addEventListener("storage", onStorage);
    window.addEventListener("user:refresh", onRefresh as any);
    return () => {
      ignore = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("user:refresh", onRefresh as any);
    };
  }, []);

  const displayName =
    user ? ([user.user_fname, user.user_lname].filter(Boolean).join(" ").trim() || user.user_name || "") : "";
  const initials = (name: string) =>
    name.split(" ").filter(Boolean).map((s) => s[0]?.toUpperCase()).slice(0, 2).join("");
  const imageUrl = (p?: string | null) => (/^https?:\/\//i.test(String(p)) ? String(p) : (p ? `${config.apiUrl}/${String(p).replace(/^\/+/, "")}` : null));

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
      localStorage.removeItem("authToken");
      localStorage.removeItem("tempToken");
      localStorage.removeItem(LS_CART_KEY);
      localStorage.removeItem(LS_BOOKING_KEY); // legacy
      localStorage.removeItem("booking:v2");   // ใหม่
      localStorage.removeItem(LS_USER_KEY);
      clearBooking();

      try {
        (window as any).__USER__ = null;
        window.dispatchEvent(new CustomEvent("user:updated", { detail: null }));
      } catch {}

      setUser(null);
      await Swal.fire({ icon: "success", title: "ออกจากระบบสำเร็จ", showConfirmButton: false, timer: 1100 });
      router.push("/");
    }
  };

  const readBooking = (): BookingDraft | null => {
    try { return readBookingSafe(); } catch { return null; }
  };

  const buildResultsUrl = (openCart: boolean) => {
    const bk = readBooking();
    const sp = new URLSearchParams();
    if (bk?.date) sp.set("date", bk.date);
    if (bk?.time) sp.set("time", bk.time);
    if (typeof bk?.people === "number" && bk.people > 0) sp.set("people", String(bk.people));
    if (bk?.tableId) sp.set("tableId", String(bk.tableId));
    if (openCart) sp.set("openCart", "1");
    const qs = sp.toString();
    return `/results${qs ? `?${qs}` : ""}`;
  };

  const handleCartClick = async () => {
    const bk = readBooking();
    if (bk?.tableId) {
      router.push(buildResultsUrl(foodItemsCount > 0));
      return;
    }
    if (foodItemsCount > 0) {
      const r = await Swal.fire({
        icon: "info",
        title: "ยังไม่ได้เลือกโต๊ะ",
        text: "กรุณาเลือกโต๊ะก่อนดูสรุปคำสั่งซื้อ",
        confirmButtonText: "ไปเลือกโต๊ะ",
      });
      if (r.isConfirmed) router.push("/table");
      return;
    }
    router.push("/table");
  };

  const isStaffOrAdmin = useMemo(() => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "staff") return true;
    if (user.isAdmin === true || user.isStaff === true) return true;
    if (Array.isArray(user.roles) && user.roles.some((r) => r === "admin" || r === "staff")) return true;
    return false;
  }, [user]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b">
      <nav className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button aria-label="menu" className="lg:hidden cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <Link href="/" className="text-lg font-semibold">
            <span className="text-gray-900">Welcome to </span>
            <span className="text-indigo-600">SaiLom</span>
          </Link>
        </div>

        <ul className="hidden lg:flex items-center gap-6 text-sm">
          <li><Link href="/" className="text-gray-700 hover:text-indigo-600">Home</Link></li>
          <li><Link href="/table" className="text-gray-700 hover:text-indigo-600">Table</Link></li>
          <li><Link href="/menu" className="text-gray-700 hover:text-indigo-600">Menu</Link></li>
          <li><Link href="/reservations" className="text-gray-700 hover:text-indigo-600">Reservations</Link></li>
          <li><Link href="/about" className="text-gray-700 hover:text-indigo-600">About</Link></li>
          {isStaffOrAdmin && (
            <li>
              <Link
                href="http://localhost:3000/backoffice/dashboard"
                className="text-gray-700 hover:text-indigo-600"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dashboard
              </Link>
            </li>
          )}
        </ul>

        <div className="flex items-center gap-2">
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
                    {initials(displayName || user.user_name || "")}
                  </div>
                )}
                <span className="text-sm text-gray-700 max-w-[140px] truncate">
                  {displayName || user.user_name || user.user_email}
                </span>
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
                className="hidden sm:inline-flex border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition shadow-sm hover:shadow-md cursor-pointer"
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
