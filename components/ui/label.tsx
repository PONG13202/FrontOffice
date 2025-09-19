"use client";

import * as React from "react";
import * as RadixLabel from "@radix-ui/react-label";
import { cn } from "@/lib/utils"; // ถ้าไม่มีฟังก์ชัน cn ให้เปลี่ยนเป็น className ตรง ๆ ได้

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof RadixLabel.Root> {
  requiredMark?: boolean;
}

export const Label = React.forwardRef<
  React.ElementRef<typeof RadixLabel.Root>,
  LabelProps
>(({ className, children, requiredMark, ...props }, ref) => {
  return (
    <RadixLabel.Root
      ref={ref}
      className={cn(
        "text-sm font-medium text-foreground",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    >
      <span className="align-middle">{children}</span>
      {requiredMark && <span className="ml-1 text-red-600 align-middle">*</span>}
    </RadixLabel.Root>
  );
});
Label.displayName = "Label";
