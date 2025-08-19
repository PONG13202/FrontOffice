"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Clock, Users, Search } from "lucide-react";

type Props = {
  onFindSlot?: (q: { date: string; time: string; people: number }) => void;
  bgImage?: string;
};

export default function HeroSection({ onFindSlot }: Props) {
  // --- defaults: วันนี้ + เวลาปัจจุบัน (ปัดเป็นช่วง 30 นาทีถัดไป) ---
  const { todayStr, timeStr } = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const roundTo30 = (d: Date) => {
      const m = d.getMinutes();
      const add = m === 0 ? 0 : 30 - (m % 30 || 30);
      d.setMinutes(m + add, 0, 0);
      return d;
    };
    const d = new Date(now);
    const t = roundTo30(new Date(now));
    return {
      todayStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      timeStr: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
    };
  }, []);

  // --- shadcn Select ไม่ส่งค่าลงฟอร์ม: เก็บ state + hidden input ---
  const [people, setPeople] = useState<string>("2");
  useEffect(() => setPeople("2"), []);

  const handleSubmit = (formData: FormData) => {
    const date = String(formData.get("date") || "");
    const time = String(formData.get("time") || "");
    const p = Number(formData.get("people") || people || 2);
    onFindSlot?.({ date, time, people: p });
  };

  return (
    <section className="relative isolate">
      {/* พื้นหลัง/เฮดไลน์ ตัดทอนออกได้ตามต้องการ */}
      <div className="container mx-auto px-4 pt-6 sm:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            จองโต๊ะ & สั่งอาหาร
          </h1>
          <p className="mt-2 text-muted-foreground">
            เลือกวัน เวลา และจำนวนคน ระบบจะหาโต๊ะที่เหมาะที่สุดให้คุณทันที
          </p>
        </motion.div>

        {/* ---------- Booking Bar (สวยงาม + ไอคอน + กระจกใส) ---------- */}
        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          action={(fd) => handleSubmit(fd)}
          className="mt-6"
        >
          {/* กรอบไฮไลต์แบบกราเดียนต์บาง ๆ */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-purple-500/20 p-[1px] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)]">
            <div className="rounded-2xl border border-black/5 bg-white/90 p-3 backdrop-blur md:p-4">
              {/* hidden สำหรับ Select */}
              <input type="hidden" name="people" value={people} />

              {/* แถวอินพุต */}
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
                {/* วันที่ */}
                <div className="md:col-span-4">
                  <label
                    htmlFor="date"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    วันที่
                  </label>
                  <div className="group relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      required
                      defaultValue={todayStr}
                      min={todayStr}
                      className="h-11 pl-9 pr-3 rounded-xl bg-white shadow-sm ring-1 ring-inset ring-gray-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                    {/* เส้นแบ่งแนวตั้งทางขวา (เดสก์ท็อป) */}
                    <div className="pointer-events-none absolute right-[-12px] top-2 hidden h-7 w-px bg-gray-200 md:block" />
                  </div>
                </div>

                {/* เวลา */}
                <div className="md:col-span-3">
                  <label
                    htmlFor="time"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    เวลา
                  </label>
                  <div className="group relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="time"
                      name="time"
                      type="time"
                      step={1800}
                      required
                      defaultValue={timeStr}
                      className="h-11 pl-9 pr-3 rounded-xl bg-white shadow-sm ring-1 ring-inset ring-gray-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                    <div className="pointer-events-none absolute right-[-12px] top-2 hidden h-7 w-px bg-gray-200 md:block" />
                  </div>
                </div>

                {/* จำนวนคน */}
                <div className="md:col-span-3">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    จำนวนคน
                  </label>
                  <div className="group relative">
                    <Users className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Select value={people} onValueChange={setPeople}>
                      <SelectTrigger className="h-11 pl-9 rounded-xl bg-white shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-indigo-500">
                        <SelectValue placeholder="เลือก" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} คน
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ปุ่มค้นหา */}
                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Find Slot
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.form>
      </div>
    </section>
  );
}
