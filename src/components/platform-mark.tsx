export function PlatformMark({ id, accent }: { id: string; accent: string }) {
  return (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
      style={{ background: accent }}
      aria-hidden
    >
      {id === "youtube" ? (
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
          <path d="M21.5 7.2a3 3 0 0 0-2.1-2.1C17.6 4.6 12 4.6 12 4.6s-5.6 0-7.4.5A3 3 0 0 0 2.5 7.2 31 31 0 0 0 2 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.4.5 7.4.5s5.6 0 7.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.5-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
        </svg>
      ) : null}
      {id === "tiktok" ? (
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
          <path d="M14.2 3h2.1a5.4 5.4 0 0 0 3.5 3.3v2.2a7.4 7.4 0 0 1-3.5-1v6.7a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.3a3.4 3.4 0 1 0 2.7 3.3V3Z" />
        </svg>
      ) : null}
      {id === "x" ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M14.7 10.3 22 2h-2.2l-6.2 7.1L8.4 2H2.2l7.7 11.1L2 22h2.2l6.8-7.8L15.4 22h6.2l-6.9-11.7Zm-2.4 2.8-.8-1.1L5.2 3.6h2.7l5 7.2.8 1.1 6.6 9.4h-2.7l-5.3-7.2Z" />
        </svg>
      ) : null}
      {id === "instagram" ? (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      ) : null}
      {id === "linkedin" ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M5.7 9.2H2.9V21h2.8V9.2ZM4.3 3C3.3 3 2.5 3.8 2.5 4.8S3.3 6.6 4.3 6.6 6.1 5.8 6.1 4.8 5.3 3 4.3 3ZM21 21h-2.8v-6.2c0-1.8-.8-2.4-1.8-2.4s-1.9.8-1.9 2.5V21H11.7V9.2h2.7v1.6c.5-.9 1.6-1.9 3.4-1.9 2.2 0 3.2 1.4 3.2 4.1V21Z" />
        </svg>
      ) : null}
    </span>
  );
}
