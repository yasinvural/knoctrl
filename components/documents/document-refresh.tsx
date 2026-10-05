"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DocumentRefresh({ processing }: { processing: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [processing, router]);
  return null;
}
