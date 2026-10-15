"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      navigator.serviceWorker
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silently catch registration errors
      });
    }
  }, []);

  return null;
}
