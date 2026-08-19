import React from "react";
import { cn } from "@/lib/utils";

interface RabbitLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function RabbitLogo({ className, size = "md" }: RabbitLogoProps) {
  const sizeClasses = {
    sm: "h-7 w-7 text-sm rounded-lg",
    md: "h-9 w-9 text-lg rounded-xl",
    lg: "h-14 w-14 text-2xl rounded-2xl",
    xl: "h-20 w-20 text-4xl rounded-3xl",
  }[size];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/20 select-none transition-transform hover:scale-105",
        sizeClasses,
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
      <span className="relative z-10 filter drop-shadow-xs">🐰</span>
    </div>
  );
}
