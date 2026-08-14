export function CodexMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="codex-mark"
      height={size}
      viewBox="0 0 1024 1024"
      width={size}
    >
      <path
        d="M512 188c102 0 190 64 224 155 101 12 180 98 180 203 0 72-38 136-95 172-5 112-97 202-211 202-62 0-118-27-157-69-101 26-208-26-250-125-25-59-20-123 8-175-36-95 4-206 98-254 65-33 140-28 198 7 2-64 4-101 5-116Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="64"
      />
      <path
        d="m347 416 165-95 165 95v191L512 702l-165-95V416Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="55"
      />
    </svg>
  );
}
