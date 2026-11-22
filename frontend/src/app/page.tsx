"use client";

import { Providers } from "@/lib/providers";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <Providers>
      <Dashboard />
    </Providers>
  );
}
