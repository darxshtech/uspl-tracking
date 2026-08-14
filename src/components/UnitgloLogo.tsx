import React from "react";
import Image from "next/image";

export default function UnitgloLogo({
  size = "md",
  theme = "auto",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  theme?: "light" | "dark" | "auto";
  className?: string;
}) {
  const dimensions = {
    sm: "h-8 max-w-[140px]",
    md: "h-10 max-w-[170px]",
    lg: "h-14 max-w-[240px]",
    xl: "h-18 max-w-[300px]",
  };

  const isDark = theme === "dark";

  return (
    <div className={`inline-flex items-center select-none ${isDark ? "bg-white/95 p-1.5 rounded-xl shadow-xs" : ""} ${className}`}>
      {/* Official Unitglo Solutions Logo */}
      <img
        src="/unitglo.jpeg"
        alt="Unitglo Solutions Logo"
        className={`${dimensions[size]} w-auto object-contain transition-transform`}
      />
    </div>
  );
}
