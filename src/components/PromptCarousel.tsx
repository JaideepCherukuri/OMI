import React from 'react';
import { cn } from '../lib/utils';

interface PromptCarouselProps {
  onSelect: (text: string) => void;
  className?: string;
}

/* ── Phosphor-style SVG icons (inline, weight="regular") ── */
const icons: Record<string, React.FC<{ className?: string }>> = {
  GraduationCap: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130.13,130.13,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a1.59,1.59,0,0,1-.46,1C201.53,174,190.11,182,176,188.39V152l32-17.07ZM128,158.93,29.86,96,128,33.07,226.14,96Z" />
    </svg>
  ),
  Heart: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M178,32c-20.65,0-38.73,8.88-50,23.89C116.73,40.88,98.65,32,78,32A62.07,62.07,0,0,0,16,94c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,220.66,240,164,240,94A62.07,62.07,0,0,0,178,32ZM128,206.8C109.74,196.16,32,147.69,32,94A46.06,46.06,0,0,1,78,48c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,147.61,146.24,196.15,128,206.8Z" />
    </svg>
  ),
  House: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M218.83,103.77l-80-75.48a1.14,1.14,0,0,1-.11-.11,16,16,0,0,0-21.53,0l-.11.11L37.17,103.77A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V160h32v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM208,208H160V160a16,16,0,0,0-16-16H112a16,16,0,0,0-16,16v48H48V115.55l.11-.1L128,40l79.9,75.43.11.1Z" />
    </svg>
  ),
  Gift: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M216,72H180.92c.39-.33.79-.65,1.17-1A29.53,29.53,0,0,0,192,49.57,32.62,32.62,0,0,0,158.44,16,29.53,29.53,0,0,0,137,25.91a54.94,54.94,0,0,0-9,14.48,54.94,54.94,0,0,0-9-14.48A29.53,29.53,0,0,0,97.56,16,32.62,32.62,0,0,0,64,49.57,29.53,29.53,0,0,0,73.91,71c.38.33.78.65,1.17,1H40A16,16,0,0,0,24,88v32a16,16,0,0,0,16,16v72a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V136a16,16,0,0,0,16-16V88A16,16,0,0,0,216,72ZM149,36.51a13.69,13.69,0,0,1,10-4.5h.49A16.62,16.62,0,0,1,176,49.08a13.69,13.69,0,0,1-4.5,10c-9.49,8.4-25.98,11.92-35.34,13.14C137.38,62.86,140.9,45.7,149,36.51ZM80,49.08A16.62,16.62,0,0,1,96.56,32h.49a13.69,13.69,0,0,1,10,4.5c8.1,9.19,11.62,26.35,12.84,35.78-9.36-1.22-25.85-4.74-35.34-13.14A13.69,13.69,0,0,1,80,49.08ZM40,88H120v32H40ZM56,136h64v72H56Zm144,72H136V136h64Zm16-88H136V88h80v32Z" />
    </svg>
  ),
  Trophy: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80v16a56.06,56.06,0,0,0,56,56h1.77A72.11,72.11,0,0,0,120,195.49V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V195.49A72.11,72.11,0,0,0,190.23,152H192a56.06,56.06,0,0,0,56-56V80A16,16,0,0,0,232,64ZM64,136A40,40,0,0,1,24,96V80H48v32a72.47,72.47,0,0,0,1.18,12.85A40.31,40.31,0,0,1,64,136Zm128-24a56,56,0,0,1-112,0V56H192ZM232,96a40,40,0,0,1-14.82,31.05A72.47,72.47,0,0,0,208,112V80h24Z" />
    </svg>
  ),
  Baby: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M92,140a12,12,0,1,1,12-12A12,12,0,0,1,92,140Zm72-24a12,12,0,1,0,12,12A12,12,0,0,0,164,116Zm-12,48a48.05,48.05,0,0,1-48,0,8,8,0,1,0-8,13.86,64.1,64.1,0,0,0,64,0,8,8,0,1,0-8-13.86ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
    </svg>
  ),
  Smiley: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.79-27.39,28-46.93,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.07-20a8,8,0,0,1,13.86,8Z" />
    </svg>
  ),
  DeviceMobile: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72ZM80,32h96a8,8,0,0,1,8,8V48H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8V208H184v16A8,8,0,0,1,176,224Z" />
    </svg>
  ),
};

const SUGGESTIONS = [
  { id: 'grad', prompt: 'Find a graduation gift for him.', icon: 'GraduationCap' },
  { id: 'anniv', prompt: 'Suggest unique anniversary gifts for her.', icon: 'Heart' },
  { id: 'house', prompt: 'What should I buy for a housewarming?', icon: 'House' },
  { id: 'bday', prompt: 'Need a birthday gift under $50.', icon: 'Gift' },
  { id: 'retire', prompt: 'Find a luxury retirement gift idea.', icon: 'Trophy' },
  { id: 'baby', prompt: 'Best baby shower gifts for boys.', icon: 'Baby' },
  { id: 'mother', prompt: "Suggest a thoughtful Mother's Day gift.", icon: 'Smiley' },
  { id: 'tech', prompt: 'Find a tech gift for teenagers.', icon: 'DeviceMobile' },
];

export const PromptCarousel: React.FC<PromptCarouselProps> = ({ onSelect, className }) => {
  const items = [...SUGGESTIONS, ...SUGGESTIONS];

  return (
    <div
      className={cn("w-full overflow-hidden py-0.5 sm:py-1", className)}
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
      }}
    >
      <div
        className="flex w-max gap-2 sm:gap-3 hover:pause motion-safe:animate-marquee"
        style={{ paddingLeft: '8%' }}
      >
        {items.map((item, i) => {
          const Icon = icons[item.icon];
          return (
            <button
              key={`${item.id}-${i}`}
              onClick={() => onSelect(item.prompt)}
              className={cn(
                "group relative flex items-center flex-shrink-0",
                "gap-2 sm:gap-2.5",
                "px-3 py-2 sm:px-3.5 sm:py-2.5",
                "min-h-[44px]",
                /* HALO: mono, uppercase, tracked text */
                "font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.15em] font-normal",
                /* HALO: sharp radius, 1px border */
                "rounded-[var(--radius)]",
                "border border-[var(--border)]",
                "bg-[var(--card)] text-[var(--foreground)]",
                /* HALO: transform-only hover */
                "transition-all duration-200 ease-halo",
                "hover:border-[var(--accent)] hover:translate-y-[-1px]",
                "active:translate-y-0",
                "whitespace-nowrap"
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
              <span>{item.prompt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
