'use client';
import { useRouter } from "next/navigation";
import TopNav from "../components/TopNav";
import Recommended from "../components/Recommended";
import RegisterBanner from "../components/RegisterBanner";
import SiteFooter from "../components/SiteFooter";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-neutral-100">
      {/* แถบเมนู */}
      <TopNav />

      {/* เนื้อหา */}
      <section className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recommended */}
          <div className="lg:col-span-9">
            <Recommended
              onFindSlot={({ date, time, people }) =>
                router.push(`/results?date=${date}&time=${time}&people=${people}`)
              }
              images={[
                "/images/hero-sailom.jpg",
                "/images/food-1.jpg",
                "/images/food-2.jpg",
              ]}
            />
          </div>

          {/* การเดินทาง / แผนที่ */}
          <aside className="lg:col-span-3">
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">การเดินทาง</h3>
              </div>
              <div className="p-3">
                <div className="h-[360px] w-full overflow-hidden rounded-lg">
                  <iframe
                    title="Map"
                    src="https://www.google.com/maps?q=Hua+Hin&output=embed"
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* แบนเนอร์สมัครสมาชิก */}
      <RegisterBanner />

      {/* ฟุตเตอร์ */}
      <SiteFooter />
    </main>
  );
}
