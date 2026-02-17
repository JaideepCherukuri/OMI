import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* ── HALO Color Tokens ─────────────────────── */
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        brand: "var(--brand)",
        "brand-foreground": "var(--brand-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        cream: "var(--cream)",
        destructive: "var(--destructive)",
        /* Static palette */
        forest: "#0D1F18",
        olive: "#A3BD6A",
        "sage-cream": "#F4F7EE",
        "sage-light": "#D5DAAD",
        "sage-border": "#CBD5A0",
        "brand-green": "#274029",
        "card-white": "#FDFDFD",
        "deep-jungle": "#0D1F18",
      },

      /* ── HALO Typography ───────────────────────── */
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },

      /* ── HALO Radius ───────────────────────────── */
      borderRadius: {
        DEFAULT: 'var(--radius)',
        halo: 'var(--radius)',
      },

      /* ── HALO Shadows ──────────────────────────── */
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },

      /* ── Animations ────────────────────────────── */
      keyframes: {
        'fade-scale': {
          '0%': { opacity: '0', transform: 'translateY(-50%) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(-50%) scale(1)' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        'fade-scale': 'fade-scale 0.2s var(--ease-out-quart)',
        'scale-in': 'scale-in 0.4s var(--ease-out-expo) forwards',
        'marquee': 'marquee 40s linear infinite',
      },

      /* ── HALO Motion ───────────────────────────── */
      transitionTimingFunction: {
        'halo': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'halo-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    }
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
