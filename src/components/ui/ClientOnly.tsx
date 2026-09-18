"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  // Mount detection is the one legitimate setState-in-effect: it only exists
  // to suppress hydration mismatches and never cascades (empty deps).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}