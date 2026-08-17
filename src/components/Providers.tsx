"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { registerServiceWorker } from "@/lib/pushNotification";

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
