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
    md: "h-10 max-w-[180px]",
    lg: "h-14 max-w-[240px]",
    xl: "h-20 max-w-[300px]",
  };

  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/logo.png"
        alt="Unitglo Solutions Logo"
        className={`${dimensions[size]} w-auto object-contain drop-shadow-sm`}
      />
    </div>
  );
}
