"use client"

import * as React from "react"
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ShiningTextProps {
  text: string;
  className?: string;
}

export function ShiningText({ text, className }: ShiningTextProps) {
  return (
    <motion.h1
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className={cn(
        "bg-[length:200%_100%] bg-clip-text font-medium text-transparent",
        "text-xs sm:text-sm",
        /* HALO shimmer: muted forest → olive highlight → muted forest (light) */
        "bg-[linear-gradient(110deg,#4a5a3a,35%,#A3BD6A,50%,#4a5a3a,75%,#4a5a3a)]",
        /* Dark: muted cream → bright cream highlight → muted cream */
        "dark:bg-[linear-gradient(110deg,#7a7b60,35%,#FBFDE2,50%,#7a7b60,75%,#7a7b60)]",
        className
      )}
      transition={{
        duration: 0.3,
        ease: "easeOut"
      }}
    >
      <motion.span
        className="block bg-clip-text text-transparent"
        style={{
          backgroundImage: "inherit",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
        }}
        animate={{ backgroundPosition: "-200% 0" }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "linear",
        }}
      >
        {text}
      </motion.span>
    </motion.h1>
  );
}
