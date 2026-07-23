export function Brand({ compact = false }) {
  return (
    <a
      className={`brand ${compact ? "brand--compact" : ""}`}
      href="/"
      aria-label="RCPY home"
    >
      <img className="brand__mark" src="/rcpy_icon.svg" alt="" />
      {!compact && <span>RCPY</span>}
    </a>
  );
}
