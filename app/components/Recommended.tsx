"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { th } from "date-fns/locale";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Dot,
  Search,
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import { Calendar } from "../../components/ui/calendar";
import { cn } from "@/lib/utils";

/** ---------- Types ---------- */
type FindSlotPayload = { date: string; time: string; people: number };

export default function Recommended({
  images,
  onFindSlot,
  autoPlay = true,
  intervalMs = 4000,
  transitionMs = 450,
  seatChoices,
}: {
  images: string[];
  onFindSlot?: (p: FindSlotPayload) => void;
  autoPlay?: boolean;
  intervalMs?: number;
  transitionMs?: number;
  seatChoices?: number[];
}) {
  /** ---------- State ---------- */
  const [index, setIndex] = useState(0);

  const [isHovering, setIsHovering] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  // utils
  const toDateStr = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // วันที่/เวลาเริ่มต้น
  const todayObj = useMemo(() => startOfToday(), []);
  const [dateObj, setDateObj] = useState<Date>(todayObj);
  const [date, setDate] = useState<string>(toDateStr(todayObj));
  const currentYear = new Date().getFullYear();

  // ใช้ภาษาไทย + ปฏิทินเกรกอเรียน (ปี ค.ศ.)
  const thFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    []
  );

  const nextHalfHour = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30 || 30)), 0, 0);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  }, []);
  const [time, setTime] = useState(nextHalfHour);

  // จำนวนคน (state หลัก)
  const [people, setPeople] = useState(2);
  const choices =
    seatChoices && seatChoices.length ? seatChoices : [1, 2, 3, 4, 5, 6, 7, 8];

  // โหมดพิมพ์เองสำหรับจำนวนคน
  const [useManualPeople, setUseManualPeople] = useState(false);
  const [manualPeople, setManualPeople] = useState(String(people));

  useEffect(() => {
    if (!useManualPeople) setManualPeople(String(people));
  }, [useManualPeople, people]);

  const handleManualChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 2);
    setManualPeople(digits);
    if (digits !== "") {
      const n = Math.max(1, Math.min(99, Number(digits)));
      setPeople(n);
    }
  };
  const finishManualIfEmpty = () => {
    if (manualPeople === "") setManualPeople(String(people));
  };

  const visibleImages = images?.filter(Boolean) ?? [];
  const count = visibleImages.length;

  /** ---------- Helpers ---------- */
  const go = useCallback(
    (to: number) => {
      if (count === 0) return;
      const next = (to + count) % count;
      setIndex(next);
    },
    [count]
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    if (count === 0) setIndex(0);
    else if (index > count - 1) setIndex(count - 1);
  }, [count, index]);

  useEffect(() => {
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);
    const onVisibility = () => setIsHidden(document.hidden);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const paused =
    isHovering || !isWindowFocused || isHidden || count <= 1 || !autoPlay;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % Math.max(1, count));
    }, Math.max(transitionMs + 100, intervalMs));
    return () => clearInterval(id);
  }, [paused, intervalMs, transitionMs, count]);

  const imgDragRef = useRef(false);
  const disableDrag = (e: React.DragEvent) => {
    imgDragRef.current = true;
    e.preventDefault();
  };

  const timeInputRef = useRef<HTMLInputElement>(null);
  const openTimePicker = useCallback(() => {
    const el = timeInputRef.current as any;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  }, []);

  /** ---------- Render ---------- */
  return (
    <div className="w-full">
      {/* สไลด์โชว์ */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-200"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <AnimatePresence initial={false}>
          {count > 0 ? (
            <motion.div
              key={visibleImages[index]}
              className="absolute inset-0"
              initial={{ opacity: 0.0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.0, scale: 0.995 }}
              transition={{ duration: transitionMs / 1000 }}
            >
              <Image
                src={visibleImages[index]}
                alt={`slide-${index + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                priority
                onDragStart={disableDrag}
                className="object-cover"
              />
            </motion.div>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-neutral-500">
              ไม่มีรูปสไลด์
            </div>
          )}
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              aria-label="Previous"
              onClick={prev}
              className="cursor-pointer absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/60 focus:outline-none"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Next"
              onClick={next}
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/60 focus:outline-none"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {count > 1 && (
          <div className=" absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1">
              {visibleImages.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to ${i + 1}`}
                  className={`cursor-pointer grid place-items-center rounded-full p-1 transition ${
                    i === index ? "scale-110" : "opacity-70 hover:opacity-100"
                  }`}
                  onClick={() => setIndex(i)}
                >
                  <Dot
                    className={`h-6 w-6 ${
                      i === index ? "text-white" : "text-white/70"
                    }`}
                  />
                </button>
              ))}
              <button
                aria-label={paused ? "Play" : "Pause"}
                onClick={() => setIsHovering((p) => !p)}
                className="cursor-pointer ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-800 hover:bg-white"
              >
                {paused ? "เล่น" : "พัก"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* แถบจอง */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-md">
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-12"
          onSubmit={(e) => {
            e.preventDefault();
            onFindSlot?.({ date, time, people });
          }}
        >
          {/* วันที่ */}
          <div className="md:col-span-3">
            <div className="mb-1 block text-sm font-medium">วันที่</div>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "cursor-pointer h-11 w-full justify-start rounded-xl bg-white pl-9 text-left font-normal",
                      "border-0 ring-1 ring-inset ring-gray-200 hover:bg-white",
                      "focus-visible:ring-2 focus-visible:ring-primary"
                    )}
                  >
                    {thFormatter.format(dateObj ?? todayObj)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="cursor-pointer w-auto rounded-xl border bg-white p-0 shadow-xl"
                >
                  <Calendar
                    mode="single"
                    selected={dateObj}
                    onSelect={(d) => {
                      if (!d) return;
                      if (d < startOfToday()) return;
                      setDateObj(d);
                      setDate(toDateStr(d));
                    }}
                    disabled={(d) => d < startOfToday()}
                    initialFocus
                    locale={th}
                    captionLayout="dropdown"
                    fromYear={currentYear - 2}
                    toYear={currentYear + 3}
                    defaultMonth={dateObj}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* เวลา */}
          <div className="md:col-span-3">
            <div className="mb-1 block text-sm font-medium">เวลา</div>
            <div
              role="button"
              tabIndex={0}
              aria-label="เลือกเวลา"
              onClick={openTimePicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTimePicker();
                }
              }}
              className="relative flex h-11 cursor-pointer items-center rounded-xl bg-white pl-9 pr-3
                         ring-1 ring-inset ring-gray-200 focus-within:ring-2 focus-within:ring-primary"
            >
              <Clock className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={timeInputRef}
                type="time"
                step={1800}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="cursor-pointer h-full w-full border-0 bg-transparent p-0 focus-visible:ring-0"
              />
            </div>
          </div>

          {/* จำนวนคน */}
          <div className="md:col-span-3">
            <div className="mb-1 block text-sm font-medium">จำนวนคน</div>

            {useManualPeople ? (
              // โหมดพิมพ์เอง + ปุ่มตัวเลือกด้านในช่อง (ขวา)
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="เช่น 12"
                  value={manualPeople}
                  onChange={(e) => handleManualChange(e.target.value)}
                  onBlur={finishManualIfEmpty}
                  className="h-11 rounded-xl bg-white pl-9 pr-20 ring-1 ring-inset ring-gray-200
                             focus-visible:ring-2 focus-visible:ring-primary"
                  title="พิมพ์ได้เฉพาะตัวเลข ไม่เกิน 2 หลัก (1–99)"
                  aria-label="จำนวนคน (พิมพ์เอง)"
                />
                <button
                  type="button"
                  onClick={() => setUseManualPeople(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  ตัวเลือก
                </button>
              </div>
            ) : (
              // โหมดเลือกจากรายการ + ปุ่มเพิ่มเติมด้านในช่อง (ขวา)
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select
                  value={String(people)}
                  onValueChange={(v) => {
                    setPeople(parseInt(v));
                  }}
                >
                  <SelectTrigger
                    className="cursor-pointer h-11 rounded-xl bg-white pl-9 pr-20 border-0 ring-1 ring-inset ring-gray-200
                               focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <SelectValue placeholder="เลือกจำนวนคน" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-xl">
                    {choices.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} คน
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* ปุ่ม 'เพิ่มเติม' ข้างๆ จำนวน */}
                <button
                  type="button"
                  onClick={() => {
                    setUseManualPeople(true);
                    setManualPeople(String(people));
                  }}
                  className="cursor-pointer absolute right-6 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  เพิ่มเติม
                </button>
              </div>
            )}
          </div>

          {/* ปุ่มค้นหา */}
          <div className="md:col-span-2 md:col-start-10 flex items-end">
            <Button
              type="submit"
              className="cursor-pointer h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Search className="mr-2 h-4 w-4" />
              Find Slot
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
