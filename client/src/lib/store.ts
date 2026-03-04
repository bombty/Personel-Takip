import { useState, useCallback } from "react";
import type { ProcessingResult } from "@shared/schema";

let globalResult: ProcessingResult | null = null;

export function useProcessingResult() {
  const [result, setResultState] = useState<ProcessingResult | null>(globalResult);

  const setResult = useCallback((r: ProcessingResult | null) => {
    globalResult = r;
    setResultState(r);
  }, []);

  return { result: globalResult || result, setResult };
}

export function getProcessingResult() {
  return globalResult;
}

export function setProcessingResult(r: ProcessingResult | null) {
  globalResult = r;
}
