// app/lib/bookingStore.ts
export const LS_BOOKING_KEY = "booking:v2";
export const LS_CART_KEY = "cart:v1";
const LS_USER_KEY = "user:v1";
const BOOKING_TTL_MS = 6 * 60 * 60 * 1000; // 6 ชั่วโมง

export type PaymentRow = {
  id: number;
  amount: number;
  status: "PENDING" | "SUBMITTED" | "PAID" | "EXPIRED";
  qrDataUrl?: string | null;
  expiresAt?: string | null;
  slipImage?: string | null;
};

export type BookingDraft = {
  date?: string;
  time?: string;
  people?: number;
  tableId?: string | number;
  tableName?: string;
  reservationId?: number | null;
  savedAt?: number;
  ownerUserId?: number | null;
  status?: "PENDING_OTP" | "OTP_VERIFIED" | "AWAITING_PAYMENT" | "CONFIRMED" | "CANCELED" | "EXPIRED";
  payment?: PaymentRow;
};

function getCurrentUserId(): number | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    const u = raw ? JSON.parse(raw) : null;
    return typeof u?.user_id === "number" ? u.user_id : null;
  } catch {
    return null;
  }
}

function isPastDate(dateISO?: string) {
  if (!dateISO) return false;
  try {
    const today = new Date();
    const yyyyMmDd = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
      .toISOString()
      .slice(0, 10);
    return dateISO < yyyyMmDd;
  } catch {
    return false;
  }
}

/**
 * อ่าน booking แบบปลอดภัย (ไม่ลบทิ้งถ้า user ยังไม่พร้อม)
 * หมายเหตุ: ไม่ลบเมื่อพบ reservationId — เราจะให้ตัวเคลียร์เฉพาะกิจเป็นคนลบ
 */
export function readBookingSafe(): BookingDraft | null {
  try {
    // migrate v1 -> v2
    const legacy = localStorage.getItem("booking:v1");
    if (legacy && !localStorage.getItem(LS_BOOKING_KEY)) {
      const uid = getCurrentUserId();
      try {
        const bk = JSON.parse(legacy);
        const migrated = { ...bk, ownerUserId: uid ?? null, savedAt: Date.now() };
        localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(migrated));
      } catch {}
      localStorage.removeItem("booking:v1");
    }

    const raw = localStorage.getItem(LS_BOOKING_KEY);
    if (!raw) return null;

    let bk: BookingDraft = JSON.parse(raw);
    const uid = getCurrentUserId();
    const owner = bk.ownerUserId ?? null;
    const current = uid ?? null;

    // TTL & วันที่ผ่านมา → ลบทิ้งได้
    if (!bk.savedAt || Date.now() - bk.savedAt > BOOKING_TTL_MS) {
      localStorage.removeItem(LS_BOOKING_KEY);
      return null;
    }
    if (isPastDate(bk.date)) {
      localStorage.removeItem(LS_BOOKING_KEY);
      return null;
    }

    // เจ้าของตรงกัน → ใช้ได้
    if (owner === current) return bk;

    // guest → user เพิ่งรู้ตัวตน: โอนสิทธิ์ booking ให้ user นี้
    if (owner === null && current !== null) {
      bk = { ...bk, ownerUserId: current, savedAt: Date.now() };
      localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(bk));
      return bk;
    }

    // owner มีอยู่แล้ว แต่ current ยัง null → อย่าลบ
    if (owner !== null && current === null) {
      return null;
    }

    // คนละ user → ลบทิ้ง
    localStorage.removeItem(LS_BOOKING_KEY);
    return null;
  } catch {
    localStorage.removeItem(LS_BOOKING_KEY);
    return null;
  }
}

/** เขียน booking โดย merge ของเดิม + ผูก owner ให้แน่ใจ */
export function writeBookingSafe(partial: BookingDraft) {
  const uid = getCurrentUserId();
  let prev: BookingDraft = {};
  try {
    const raw = localStorage.getItem(LS_BOOKING_KEY);
    if (raw) prev = JSON.parse(raw);
  } catch {}

  const bk: BookingDraft = {
    ...prev,
    ...partial,
    ownerUserId: uid ?? (prev.ownerUserId ?? null),
    savedAt: Date.now(),
  };
  localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(bk));
  window.dispatchEvent(new Event("booking:changed"));
}

/** ล้าง booking */
export function clearBooking() {
  localStorage.removeItem(LS_BOOKING_KEY);
  window.dispatchEvent(new Event("booking:changed"));
}

/** ล้าง cart */
export function clearCart() {
  localStorage.removeItem(LS_CART_KEY);
  window.dispatchEvent(new Event("cart:changed"));
}

/** ล้างทั้ง booking + cart */
export function clearBookingAndCart() {
  clearBooking();
  clearCart();
}

/**
 * เคลียร์หลัง commit (เมื่อมี reservationId ใน booking)
 * คืน true ถ้ามีการเคลียร์
 */
// เคลียร์หลัง commit จริง ๆ (เฉพาะเสร็จสมบูรณ์แล้ว)
export function clearIfCommitted(finalStatuses: string[] = ["CONFIRMED", "CANCELED", "EXPIRED"]): boolean {
  try {
    const raw = localStorage.getItem(LS_BOOKING_KEY);
    if (!raw) return false;
    const bk: BookingDraft = JSON.parse(raw);

    // ถ้ายังไม่มี reservationId → ยังไม่ commit
    if (!bk || typeof bk.reservationId !== "number") return false;

    // ถ้ามี status และ status อยู่ใน finalStatuses → เคลียร์
    if (bk.status && finalStatuses.includes(bk.status)) {
      clearBookingAndCart();
      return true;
    }

    // ถ้าไม่มี status ให้ปล่อยไว้ (เช่น OTP, AWAITING_PAYMENT)
    return false;
  } catch {
    return false;
  }
}
