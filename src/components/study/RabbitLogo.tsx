import React from "react";
import { cn } from "@/lib/utils";

export function RabbitLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md select-none",
        className
      )}
    >
      <span className="text-xl">🐰</span>
    </div>
  );
}
