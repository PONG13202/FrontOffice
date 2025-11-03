import { Suspense } from "react";
import ResultsStepperInner from "./ResultsStepperInner";

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">กำลังโหลด...</div>}>
      <ResultsStepperInner />
    </Suspense>
  );
}
