"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../components/TopNav";
import Recommended from "../components/Recommended";
import RegisterBanner from "../components/RegisterBanner";
import SiteFooter from "../components/SiteFooter";
import axios from "axios";
import { config } from "../config";
import Swal from "sweetalert2";
import { socket } from "../socket";

type SlideItem = {
  slide_id: number;
  slide_name: string;
  slide_img: string;
  slide_status?: 0 | 1; // รองรับ event จาก socket
  createdAt?: string;
  updatedAt?: string;
};

export default function Home() {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideItem[]>([]);

  // สร้าง base URL ให้รูป (กัน / ซ้ำ)
  const base = useMemo(() => config.apiUrl.replace(/\/$/, ""), []);

  // ดึงสไลด์ครั้งแรก
  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const { data } = await axios.get<SlideItem[]>(
          `${config.apiUrl}/slides_show`,
          { headers: { "Cache-Control": "no-store" } }
        );
        // API นี้คัดเฉพาะ slide_status = 1 อยู่แล้ว
        setSlides(Array.isArray(data) ? data : []);
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
    fetchSlides();
  }, []);

  // ฟัง socket realtime
  useEffect(() => {
    // เผื่อ socket ถูกสร้างด้วย autoConnect:false
    if (!socket.connected) socket.connect();

    const upsertIfActive = (slide: SlideItem) => {
      if (slide.slide_status === 1 || slide.slide_status === undefined) {
        setSlides((prev) => {
          const idx = prev.findIndex((s) => s.slide_id === slide.slide_id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = slide;
            return next;
          } else {
            return [...prev, slide];
          }
        });
      } else {
        // ถ้ากลายเป็น 0 ให้ลบทิ้ง
        setSlides((prev) => prev.filter((s) => s.slide_id !== slide.slide_id));
      }
    };

    const onCreated = (slide: SlideItem) => upsertIfActive(slide);
    const onUpdated = (slide: SlideItem) => upsertIfActive(slide);
    const onDeleted = ({ slide_id }: { slide_id: number }) => {
      setSlides((prev) => prev.filter((s) => s.slide_id !== slide_id));
    };

    socket.on("slide:created", onCreated);
    socket.on("slide:updated", onUpdated);
    socket.on("slide:deleted", onDeleted);

    // debug:
    // socket.onAny((event, ...args) => console.log("SOCKET:", event, args));

    return () => {
      socket.off("slide:created", onCreated);
      socket.off("slide:updated", onUpdated);
      socket.off("slide:deleted", onDeleted);
    };
  }, []);

  // แปลงเป็น URL รูปสำหรับคอมโพเนนต์ Recommended
  const images = useMemo(
    () =>
      slides
        .map((s) => s.slide_img)
        .filter(Boolean)
        .map((p) =>
          p.startsWith("http")
            ? p
            : `${base}${p.startsWith("/") ? "" : "/"}${p}`
        ),
    [slides, base]
  );

  return (
    <main className="min-h-screen bg-neutral-100">
      <TopNav />

      <section className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-9">
            <Recommended
              onFindSlot={({ date, time, people }) =>
                router.push(
                  `/results?date=${date}&time=${time}&people=${people}`
                )
              }
              images={images}
            />
          </div>

          <aside className="lg:col-span-3">
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">การเดินทาง</h3>
              </div>
              <div className="p-3">
                <div className="h-[360px] w-full overflow-hidden rounded-lg">
                  {/* map */}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <RegisterBanner />
      <SiteFooter />
    </main>
  );
}
