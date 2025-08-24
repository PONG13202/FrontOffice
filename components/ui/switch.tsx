"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      // ขนาด/ทรง + ช่องว่างในแทร็ก 2px เพื่อให้หัวสวิตช์ไม่ติดขอบ
      "peer inline-flex h-6 w-11 items-center rounded-full p-[2px]",
      // สีพื้นฐาน/ขอบ/ทรานสิชัน
      "border border-slate-200 bg-slate-300 transition-colors",
      // โฟกัส/disabled
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      // สีเมื่อเปิด
      "data-[state=checked]:bg-sky-600",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        // หัวสวิตช์ขนาดพอดีกับแทร็ก
        "block h-5 w-5 rounded-full bg-white",
        "shadow-sm ring-1 ring-black/5",
        // ระยะเลื่อนพอดีกับ w-11 + p-[2px]
        "translate-x-0 transition-transform",
        "data-[state=checked]:translate-x-5"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
