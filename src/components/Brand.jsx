export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Crumbly home">
      <svg
        className="brand__mark"
        viewBox="0 0 38 38"
        aria-hidden="true"
      >
        <path d="M3 20H7 M10 12V28 M15 7V31 M20 13V25 M25 8V29 M30 15V23 M34 19H36" />
        <circle cx="31" cy="8" r="1.8" fill="currentColor" stroke="none" />
      </svg>
      <span>Crumbly</span>
    </a>
  );
}
