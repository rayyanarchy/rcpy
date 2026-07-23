export function Waveform({ className = "" }) {
  return (
    <svg
      className={`waveform ${className}`}
      viewBox="0 0 260 62"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0 38c30 0 39 0 52-15 13-14 20-12 24 8 4 22 10 22 15-2 5-23 11-20 14 4 4 27 11 24 17-9 4-25 10-25 14-2 4 19 11 21 18 3 8-20 16-15 26-1 11 16 21 17 40 17" />
    </svg>
  );
}
