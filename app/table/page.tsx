import { Suspense } from "react";
import TableInner from "./TableInner";

export default function TablePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">กำลังโหลด...</div>}>
      <TableInner />
    </Suspense>
  );
}
