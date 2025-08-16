"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  onFindSlot?: (q: { date: string; time: string; people: number }) => void;
  bgImage?: string;
};

export default function HeroSection({
  onFindSlot,
}: Props) {
  // --- defaults: วันนี้ + เวลาปัจจุบัน (ปัดเป็นช่วง 30 นาทีถัดไป) ---
  const { todayStr, timeStr } = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const roundTo30 = (d: Date) => {
      const m = d.getMinutes();
      const add = m === 0 ? 0 : 30 - (m % 30);
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

  // optional: sync people=2 ตอนเริ่ม
  useEffect(() => setPeople("2"), []);

  const handleSubmit = (formData: FormData) => {
    const date = String(formData.get("date") || "");
    const time = String(formData.get("time") || "");
    const p = Number(formData.get("people") || people || 2);
    onFindSlot?.({ date, time, people: p });
  };

  return (
    <section className="relative isolate min-h-[min(860px,100svh)]">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        {/* <Image
          src={bgImage}
          alt="SaiLom Hotel & Restaurant"
          fill
          priority
          className="object-cover"
        /> */}
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-background/95" />
        {/* subtle noise (optional) */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:12px_12px]" />
      </div>

      <div className="container mx-auto px-4 py-16 sm:py-20 lg:py-28">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl text-white"
        >
          <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium tracking-wide backdrop-blur">
            Welcome to <span className="text-[#AEB3FF]">SaiLom</span>
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            จองโต๊ะ & สั่งอาหาร
            <br className="hidden sm:block" />
            ง่าย รวดเร็ว ในที่เดียว
          </h1>
          <p className="mt-4 text-white/90 sm:text-lg">
            เลือกวัน เวลา และจำนวนคน ระบบจะหาโต๊ะที่เหมาะที่สุดให้คุณทันที
          </p>

          {/* CTAs */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="bg-[#6066FF] hover:bg-[#4d53d9]">ดูเมนูแนะนำ</Button>
            <Button
              variant="outline"
              className="border-white/60 bg-white/10 text-white hover:bg-white/20"
            >
              สมัครสมาชิกฟรี
            </Button>
          </div>
        </motion.div>

        {/* Search bar (Glass) */}
        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          action={(fd) => handleSubmit(fd)}
          className="mt-8 rounded-2xl border border-white/20 bg-white/90 p-3 shadow-xl backdrop-blur sm:p-4"
        >
          {/* hidden for Select */}
          <input type="hidden" name="people" value={people} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {/* Date */}
            <div className="sm:col-span-2">
              <label htmlFor="date" className="mb-1 block text-sm font-medium text-foreground/80">
                วันที่
              </label>
              <Input
                id="date"
                type="date"
                name="date"
                required
                defaultValue={todayStr}
                className="bg-white"
              />
            </div>

            {/* Time */}
            <div>
              <label htmlFor="time" className="mb-1 block text-sm font-medium text-foreground/80">
                เวลา
              </label>
              <Input
                id="time"
                type="time"
                name="time"
                required
                defaultValue={timeStr}
                className="bg-white"
              />
            </div>

            {/* People */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground/80">
                จำนวนคน
              </label>
              <Select value={people} onValueChange={setPeople}>
                <SelectTrigger className="bg-white">
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

            {/* Button */}
            <div className="flex items-end">
              <Button
                type="submit"
                className="h-10 w-full bg-[#6066FF] hover:bg-[#4d53d9]"
              >
                Find Slot
              </Button>
            </div>
          </div>
        </motion.form>
      </div>
    </section>
  );
}
