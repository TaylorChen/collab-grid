import React from "react";
import CanvasGrid from "@/components/Grid/CanvasGrid";
import { useRealtime } from "@/hooks/useRealtime";

export default function Home() {
  useRealtime("demo");
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Demo Grid</h2>
      </div>
      <CanvasGrid />
    </div>
  );
}

