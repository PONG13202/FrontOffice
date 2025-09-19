// app/(site)/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../components/TopNav";
import Recommended from "../components/Recommended";
import RegisterBanner from "../components/RegisterBanner";
import axios from "axios";
import { config } from "../config";
import Swal from "sweetalert2";
import { socket } from "../socket";

type SlideItem = {
  slide_id: number;
  slide_name: string;
  slide_img: string;
  slide_status?: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
};

type Seat = { id: number; seats: number };

type LocationT = {
  location_id: number;
  location_name: string;
  location_link: string;
  location_map: string; // อาจเป็นลิงก์หรือโค้ด <iframe>
};

// ดึง src จากสตริงที่อาจเป็นลิงก์ / โค้ด iframe / พิกัด
const extractMapSrc = (raw: string) => {
  if (!raw) return "";
  const s = String(raw).trim();

  // 1) <iframe ... src="...">
  const m1 = s.match(/<iframe[^>]*\s+src=["']([^"']+)["']/i);
  if (m1?.[1]) return m1[1];

  // 2) ลิงก์ embed
  const m2 = s.match(/https?:\/\/www\.google\.com\/maps\/embed\?[^"' <]+/i);
  if (m2?.[0]) return m2[0];

  // 3) URL อื่น -> q=&output=embed
  const anyUrl = s.match(/https?:\/\/[^\s<>"']+/i);
  if (anyUrl?.[0]) {
    const url = anyUrl[0];
    if (/\/maps\/embed/i.test(url)) return url;
    return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
  }

  // 4) lat,lng
  const coord = s.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (coord) {
    return `https://www.google.com/maps?q=${coord[1]},${coord[2]}&output=embed`;
  }
  return "";
};

export default function Home() {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [seatChoices, setSeatChoices] = useState<number[]>([]);

  // แผนที่/สถานที่
  const [location, setLocation] = useState<LocationT | null>(null);
  const [mapSrc, setMapSrc] = useState("");

  const base = useMemo(() => config.apiUrl.replace(/\/$/, ""), []);

  /** -------- Slides (fetch + realtime) -------- */
  useEffect(() => {
    let mounted = true;

    const normalize = (arr: SlideItem[]) =>
      (Array.isArray(arr) ? arr : []).filter((s) => (s.slide_status ?? 1) === 1);

    const fetchSlides = async () => {
      try {
        const { data } = await axios.get<SlideItem[]>(
          `${config.apiUrl}/slides_show`,
          { headers: { "Cache-Control": "no-store" } }
        );
        if (!mounted) return;
        setSlides(normalize(data));
      } catch (e) {
        await Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถดึงข้อมูลสไลด์ได้ " + e,
          showConfirmButton: false,
          timer: 2000,
        });
      }
    };

    if (!socket.connected) socket.connect();

    const upsert = (payload: SlideItem | SlideItem[]) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      setSlides((prev) => {
        const map = new Map<number, SlideItem>(prev.map((s) => [s.slide_id, s]));
        for (const r of rows) {
          if (!r) continue;
          map.set(r.slide_id, r);
        }
        // โชว์เฉพาะ status=1
        return Array.from(map.values()).filter((s) => (s.slide_status ?? 1) === 1);
      });
    };

    const onList = (rows: SlideItem[]) => setSlides(normalize(rows));
    const onCreated = (row: SlideItem) => upsert(row);
    const onUpdated = (row: SlideItem) => upsert(row);
    const onDeleted = (payload: any) =>
      setSlides((prev) => {
        const id =
          typeof payload === "number"
            ? payload
            : payload?.slide_id ?? payload?.id;
        if (typeof id !== "number") return prev;
        return prev.filter((s) => s.slide_id !== id);
      });

    socket.on("slide:list", onList);
    socket.on("slide:created", onCreated);
    socket.on("slide:updated", onUpdated);
    socket.on("slide:deleted", onDeleted);

    fetchSlides();

    return () => {
      mounted = false;
      socket.off("slide:list", onList);
      socket.off("slide:created", onCreated);
      socket.off("slide:updated", onUpdated);
      socket.off("slide:deleted", onDeleted);
    };
  }, []);

  /** -------- Seats (realtime) -------- */
  useEffect(() => {
    let mounted = true;

    const toList = (rows: Seat[]) =>
      Array.from(new Set((rows || []).map((r) => r.seats)))
        .filter((n): n is number => Number.isFinite(n))
        .sort((a, b) => a - b);

    const fetchSeat = async () => {
      try {
        const { data } = await axios.get<Seat[]>(`${config.apiUrl}/seat`, {
          headers: { "Cache-Control": "no-store" },
        });
        if (!mounted) return;
        if (Array.isArray(data)) setSeatChoices(toList(data));
      } catch (e) {
        await Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถดึงข้อมูลที่นั่งได้ " + e,
          showConfirmButton: false,
          timer: 2000,
        });
        if (mounted) setSeatChoices([1, 2, 3, 4, 5, 6, 7, 8]);
      }
    };

    if (!socket.connected) socket.connect();

    const onSeatList = (rows: Seat[]) => setSeatChoices(toList(rows));
    const onSeatCreated = (row: Seat) =>
      setSeatChoices((prev) =>
        toList([...(prev.map((n) => ({ seats: n })) as any), row])
      );
    const onSeatUpdated = (row: Seat) =>
      setSeatChoices((prev) =>
        toList([...(prev.map((n) => ({ seats: n })) as any), row])
      );
    const onSeatDeleted = ({ id }: { id: number }) =>
      setSeatChoices((prev) => prev.filter((n) => n !== id)); // ปรับตาม schema จริงของคุณ

    socket.on("seat:list", onSeatList);
    socket.on("seat:created", onSeatCreated);
    socket.on("seat:updated", onSeatUpdated);
    socket.on("seat:deleted", onSeatDeleted);

    fetchSeat();

    return () => {
      mounted = false;
      socket.off("seat:list", onSeatList);
      socket.off("seat:created", onSeatCreated);
      socket.off("seat:updated", onSeatUpdated);
      socket.off("seat:deleted", onSeatDeleted);
    };
  }, []);

  /** -------- Location/Map (realtime) -------- */
  useEffect(() => {
    const fetchMap = async () => {
      try {
        const { data } = await axios.get<LocationT>(`${config.apiUrl}/locations`, {
          headers: { "Cache-Control": "no-store" },
        });
        if (data) {
          setLocation(data);
          setMapSrc(extractMapSrc(data.location_map || ""));
        } else {
          setLocation(null);
          setMapSrc("");
        }
      } catch (e) {
        setLocation(null);
        setMapSrc("");
      }
    };
    fetchMap();
    if (!socket.connected) socket.connect();

    const onLocation = (row: LocationT) => {
      setLocation(row);
      setMapSrc(extractMapSrc(row.location_map || ""));
    };

    socket.on("location", onLocation);
    socket.on("location:updated", onLocation);

    return () => {
      socket.off("location", onLocation);
      socket.off("location:updated", onLocation);
    };
  }, []);

  /** -------- Slides → URLs -------- */
  const images = useMemo(
    () =>
      slides
        .map((s) => s.slide_img)
        .filter(Boolean)
        .map((p) => (p.startsWith("http") ? p : `${base}${p.startsWith("/") ? "" : "/"}${p}`)),
    [slides, base]
  );

  return (
    <main className="min-h-screen bg-neutral-100">
      

      <section className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-9">
            <Recommended
              seatChoices={seatChoices}
              onFindSlot={({ date, time, people }) =>
                router.push(`/table?date=${date}&time=${time}&people=${people}`)
              }
              images={images}
            />
          </div>

          <aside className="lg:col-span-3">
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">การเดินทาง</h3>
                {location?.location_name && (
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {location.location_link ? (
                      <a
                        href={location.location_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline"
                      >
                        {location.location_name}
                      </a>
                    ) : (
                      <span>{location.location_name}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="h-[360px] w-full overflow-hidden rounded-lg border">
                  {mapSrc ? (
                    <iframe
                      src={mapSrc}
                      className="h-full w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-neutral-500">
                      ยังไม่ได้ตั้งค่าแผนที่
                    </div>
                  )}
                </div>

                {location?.location_link && (
                  <a
                    href={location.location_link}
                    target="_blank"
                    className="mt-3 inline-block text-sm font-medium text-orange-600 hover:underline"
                  >
                    เปิดใน Google Maps
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <RegisterBanner />
    
    </main>
  );
}
