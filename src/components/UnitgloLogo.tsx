import React from "react";

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
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
    xl: "h-18",
  };

  const isDark = theme === "dark";

  return (
    <div className={`flex items-center select-none ${className}`}>
      {/* Exact Unitglo Solutions Logo SVG */}
      <svg
        className={`${dimensions[size]} w-auto aspect-[540/140]`}
        viewBox="0 0 540 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="logoShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow
              dx="2.5"
              dy="2.5"
              stdDeviation="0"
              floodColor={isDark ? "#000000" : "#888888"}
              floodOpacity={isDark ? "0.7" : "0.4"}
            />
          </filter>
        </defs>

        {/* Logo Emblem Icon */}
        <g transform="translate(10, 8)">
          {/* Cyan Upper Left Arm */}
          <path
            d="M 12 10 C 12 5.5 15.5 2 20 2 C 24.5 2 28 5.5 28 10 L 28 55 L 12 70 Z"
            fill="#00A6FF"
          />

          {/* Dark / Accent Lower Left Arm & Bottom G-Hook Curve */}
          <path
            d="M 12 70 L 28 55 L 28 85 C 28 98 38 108 51 108 C 64 108 74 98 74 85 L 74 65 L 50 65 C 46 65 43 62 43 58 C 43 54 46 51 50 51 L 82 51 C 86.5 51 90 54.5 90 59 L 90 85 C 90 106.5 72.5 124 51 124 C 29.5 124 12 106.5 12 85 Z"
            fill={isDark ? "#38BDF8" : "#1C2127"}
          />

          {/* Cyan Right Arm */}
          <path
            d="M 74 10 C 74 5.5 77.5 2 82 2 C 86.5 2 90 5.5 90 10 L 90 51 L 74 51 Z"
            fill="#00A6FF"
          />
        </g>

        {/* Typography: UNITGLO */}
        <text
          x="125"
          y="64"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif"
          fontSize="62"
          fontWeight="900"
          letterSpacing="2"
          fill={isDark ? "#FFFFFF" : "#181C20"}
          filter="url(#logoShadow)"
        >
          UNITGLO
        </text>

        {/* Typography: SOLUTIONS */}
        <text
          x="126"
          y="120"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif"
          fontSize="52"
          fontWeight="900"
          letterSpacing="5"
          fill={isDark ? "#F8FAFC" : "#181C20"}
          filter="url(#logoShadow)"
        >
          SOLUTIONS
        </text>
      </svg>
    </div>
  );
}
