"use client";

import { appliquerTheme, useTheme } from "@/lib/hooks";

export function BasculeTheme({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();

  return (
    <button
      onClick={() => appliquerTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
      title={theme === "dark" ? "Thème clair" : "Thème sombre"}
      className={`inline-flex items-center justify-center border border-line rounded-[3px]
        text-mist hover:text-chalk hover:border-line-hi transition-colors
        ${compact ? "w-8 h-8" : "w-9 h-9"}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
              <line
                key={d}
                x1={12 + 7 * Math.cos((d * Math.PI) / 180)}
                y1={12 + 7 * Math.sin((d * Math.PI) / 180)}
                x2={12 + 9.5 * Math.cos((d * Math.PI) / 180)}
                y2={12 + 9.5 * Math.sin((d * Math.PI) / 180)}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ))}
          </>
        ) : (
          <path
            d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}
