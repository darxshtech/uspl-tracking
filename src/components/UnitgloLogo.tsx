import React from "react";

export default function UnitgloLogo({ size = "md", showText = true }: { size?: "sm" | "md" | "lg"; showText?: boolean }) {
  const heights = {
    sm: "h-7",
    md: "h-9",
    lg: "h-12"
  };

  return (
    <div className="flex items-center gap-3 select-none">
      {/* Unitglo U Emblem */}
      <svg className={`${heights[size]} w-auto aspect-square`} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top cyan arms */}
        <path d="M 20 10 L 40 10 L 40 50 C 40 55, 45 60, 50 60 C 55 60, 60 55, 60 50 L 60 10 L 80 10 L 80 50 C 80 68, 66 82, 50 82 C 34 82, 20 68, 20 50 Z" fill="#0099FF" />
        {/* Bottom dark charcoal hook curve */}
        <path d="M 20 45 L 40 45 L 40 52 C 40 58, 44 62, 50 62 C 56 62, 60 58, 60 52 L 60 40 L 75 40 L 75 52 C 75 66, 64 78, 50 78 C 36 78, 25 66, 25 52 Z" fill="#1E293B" />
        <path d="M 50 40 C 40 40 30 48 30 60 C 30 72 40 80 50 80 C 60 80 70 72 70 60 L 55 60 C 55 63 52 66 50 66 C 48 66 45 63 45 60 C 45 57 48 54 50 54 L 60 54 L 60 40 Z" fill="#0F172A" />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold tracking-wider text-slate-900 text-lg uppercase font-sans">
            UNITGLO
          </span>
          <span className="font-bold tracking-widest text-slate-700 text-xs uppercase font-sans mt-0.5">
            SOLUTIONS
          </span>
        </div>
      )}
    </div>
  );
}
