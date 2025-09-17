// app/lib/bookingStore.ts
export const LS_BOOKING_KEY = "booking:v2";
const LS_USER_KEY = "user:v1";
const BOOKING_TTL_MS = 6 * 60 * 60 * 1000; // 6 ชั่วโมง

export type BookingDraft = {
  date?: string;
  time?: string;
  people?: number;
  tableId?: string | number;
  tableName?: string;
  reservationId?: number | null;
  savedAt?: number;
  ownerUserId?: number | null;
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

/** อ่าน booking แบบปลอดภัย (ไม่ลบทิ้งถ้า user ยังไม่พร้อม) */
export function readBookingSafe(): BookingDraft | null {
  try {
    // migrate v1 -> v2 (คงเดิมของคุณได้)
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

    // กรณี guest → user พึ่งรู้ตัวตน: โอนสิทธิ์ booking ให้ user นี้
    if (owner === null && current !== null) {
      bk = { ...bk, ownerUserId: current, savedAt: Date.now() };
      localStorage.setItem(LS_BOOKING_KEY, JSON.stringify(bk));
      return bk;
    }

    // กรณี user ของ booking เป็นคนจริงอยู่แล้ว แต่ตอนนี้ยัง "ไม่รู้ว่าใคร" (current = null)
    // → อย่าลบ! คืน null ไปก่อน รอรอบถัดไปที่รู้ user แล้วค่อยตัดสิน
    if (owner !== null && current === null) {
      return null; // เก็บไว้ใน LS เหมือนเดิม
    }

    // ทั้งสองฝั่งเป็นคนละ user ชัดเจน → ลบทิ้ง (ป้องกัน cross-user)
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
