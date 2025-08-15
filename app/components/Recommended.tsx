"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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
import { MapPin, Clock3, Route } from "lucide-react";

type Props = {
  onFindSlot?: (q: { date: string; time: string; people: number }) => void;
  images: string[];
};

export default function Recommended({ onFindSlot, images }: Props) {
  const [slide, setSlide] = useState(0);
  const [people, setPeople] = useState("2");

  const { todayStr, timeStr } = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}`;
    const t = `${pad(now.getHours())}:${pad(
      (Math.ceil(now.getMinutes() / 30) * 30) % 60
    )}`;
    return { todayStr: d, timeStr: t };
  }, []);

  const next = () => setSlide((s) => (s + 1) % images.length);
  const prev = () => setSlide((s) => (s - 1 + images.length) % images.length);

  const handleSubmit = (fd: FormData) => {
    const date = String(fd.get("date") || "");
    const time = String(fd.get("time") || "");
    const p = Number(fd.get("people") || people || 2);
    onFindSlot?.({ date, time, people: p });
  };

  return (
    <div className="rounded-xl border-2 border-blue-300 bg-white shadow-sm">
      <div className="px-4 py-2 border-b">
        <h2 className="text-center font-semibold tracking-wider text-blue-700">
          RECOMMENDED
        </h2>
      </div>

      {/* สไลด์รูป */}
      <div className="relative w-full h-[400px] overflow-hidden">
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`slide-${i}`}
            fill
            className={`object-cover transition-opacity duration-500 ${
              slide === i ? "opacity-100" : "opacity-0"
            }`}
            priority={i === 0}
          />
        ))}

        {/* ปุ่มเลื่อน */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white p-2 shadow"
          aria-label="prev"
        >
          ‹
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white p-2 shadow"
          aria-label="next"
        >
          ›
        </button>

        {/* จุดแสดงสไลด์ */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <span
              key={i}
              onClick={() => setSlide(i)}
              className={`h-2 w-2 rounded-full cursor-pointer ${
                i === slide ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* รายละเอียดร้าน */}
      <div className="px-4 pt-3">
        <a href="#" className="font-semibold text-indigo-700 hover:underline">
          SaiLom Hotel &amp; Restaurant
        </a>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <ul className="text-sm text-gray-700 space-y-1">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-600" /> 5 ถนนนเรศดำริห์
              อ.หัวหิน{" "}
              <span className="ml-1 text-indigo-600 hover:underline">
                Get Direction
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-indigo-600" /> 10:00 AM - 11:00 PM
            </li>
            <li className="flex items-center gap-2">
              <Route className="h-4 w-4 text-indigo-600" /> 2xx m.
            </li>
          </ul>
          <div className="text-sm text-gray-700">
            <ul className="list-disc pl-5 space-y-1">
              <li>ตั้งโต๊ะนอกอาคาร และในอาคาร พร้อมวิวสวน</li>
              <li>เมนูหลากหลาย ทั้งไทย/ซีฟู้ด</li>
              <li>ที่จอดรถ พร้อมสาธารณูปโภค</li>
            </ul>
            <a href="#" className="text-indigo-600 hover:underline text-sm">
              Read More..
            </a>
          </div>
        </div>
      </div>

      {/* แถบจอง (Date / Time / People / Find) */}
      <motion.form
        action={(fd) => handleSubmit(fd)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="m-4 mt-3 rounded-lg border bg-white p-3"
      >
        <input type="hidden" name="people" value={people} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Date</label>
            <Input name="date" type="date" required defaultValue={todayStr} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Time</label>
            <Input name="time" type="time" required defaultValue={timeStr} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">People</label>
            <Select value={people} onValueChange={setPeople}>
              <SelectTrigger>
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
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              Find Slots
            </Button>
          </div>
        </div>
      </motion.form>
    </div>
  );
}
