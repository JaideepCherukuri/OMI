"use client";

import { CornerRightUp, Mic, MicOff } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useAutoResizeTextarea } from "../hooks/use-auto-resize-textarea";

interface AIInputProps {
  id?: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  onSubmit?: (value: string) => void
  onMicClick?: () => void
  micIcon?: React.ReactNode
  minimizedOrb?: React.ReactNode
  className?: string
  onFocus?: () => void
  onBlur?: () => void
  disabled?: boolean
}

export function AIInput({
  id = "ai-input",
  placeholder = "Type your message...",
  minHeight = 52,
  maxHeight = 160,
  onSubmit,
  onMicClick,
  micIcon,
  minimizedOrb,
  className,
  onFocus,
  onBlur,
  disabled
}: AIInputProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });
  const [inputValue, setInputValue] = useState("");

  const handleReset = () => {
    if (!inputValue.trim()) return;
    onSubmit?.(inputValue);
    setInputValue("");
    adjustHeight(true);
  };

  return (
    <div className={cn("w-full py-2 sm:py-3", className)}>
      <div className="relative w-full mx-auto">
        <textarea
          id={id}
          placeholder={placeholder}
          className={cn(
            /* HALO: PP Neue Montreal (font-sans) + design system radius */
            "w-full font-sans bg-black/5 dark:bg-white/5 rounded-[var(--radius)]",
            "pl-4 sm:pl-5 md:pl-6 pr-20 sm:pr-24",
            "placeholder:text-black/40 dark:placeholder:text-white/40",
            "border-none outline-none",
            "text-black dark:text-white",
            "text-[15px] sm:text-base md:text-lg",
            "resize-none overflow-hidden",
            "leading-[1.3] py-[14px] sm:py-4 md:py-[18px]",
            "focus:ring-0 focus:outline-none",
            "appearance-none",
            // Hide all scrollbars
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
            "[&::-webkit-resizer]:hidden"
          )}
          style={{ 
            minHeight: `${minHeight}px`, 
            maxHeight: `${maxHeight}px`,
            WebkitAppearance: 'none',
            background: 'transparent',
          }}
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleReset();
            }
          }}
          rows={1}
        />

        {/* Background layer (so textarea bg is behind everything) — keeps orb snap working */}
        <div className="absolute inset-0 rounded-[var(--radius)] bg-black/5 dark:bg-white/5 -z-10 pointer-events-none" />

        {/* Mic / Orb Button — HALO radius but preserve animation-critical layout */}
        <div
          onClick={onMicClick}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 rounded-[var(--radius)] transition-all duration-500 cursor-pointer overflow-hidden isolate",
            "p-1.5 sm:p-2",
            "hover:bg-black/10 dark:hover:bg-white/10",
            !minimizedOrb && "bg-black/5 dark:bg-white/5",
            inputValue ? "right-11 sm:right-14" : "right-3 sm:right-4"
          )}
        >
          {minimizedOrb && (
            <div className="absolute inset-0 -z-10 animate-scale-in">
              {minimizedOrb}
            </div>
          )}
          <div className="relative z-10">
            {micIcon || (
              <MicOff
                className={cn(
                  "transition-colors duration-200",
                  "w-5 h-5 sm:w-6 sm:h-6",
                  minimizedOrb
                    ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    : "text-black/70 dark:text-white/70"
                )}
              />
            )}
          </div>
        </div>

        {/* Submit Button — HALO radius */}
        <button
          onClick={handleReset}
          type="button"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-3 sm:right-4",
            "rounded-[var(--radius)] bg-black/5 dark:bg-white/5",
            "p-1.5 sm:p-2",
            "transition-all duration-200",
            inputValue
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          <CornerRightUp className="w-5 h-5 sm:w-6 sm:h-6 text-black/70 dark:text-white/70" />
        </button>
      </div>
    </div>
  );
}
