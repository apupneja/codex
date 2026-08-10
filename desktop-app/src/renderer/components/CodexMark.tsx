export function CodexMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="codex-mark"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <defs>
        <linearGradient id="codex-gradient" x1="3" x2="28" y1="4" y2="27">
          <stop stopColor="#f3f1ea" />
          <stop offset="1" stopColor="#999d96" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.8a7.2 7.2 0 0 1 6.62 4.36 7.2 7.2 0 0 1 5.24 10.84 7.2 7.2 0 0 1-8.02 9.4 7.2 7.2 0 0 1-11.48-3.48A7.2 7.2 0 0 1 5.1 12.56 7.2 7.2 0 0 1 16 2.8Z"
        fill="none"
        stroke="url(#codex-gradient)"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="m10.3 12.7 5.7-3.3 5.7 3.3v6.6L16 22.6l-5.7-3.3v-6.6Z"
        fill="none"
        stroke="url(#codex-gradient)"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
