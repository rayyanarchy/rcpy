import type { ReactNode } from "react";
import { Link } from "./Link";
import "./Header.css";

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="header page">
      <Link to="/" className="header__logo" aria-label="RCPY home">
        <img src="/rcpy_icon.svg" alt="" width={34} height={37} />
      </Link>
      <div className="header__actions">{children}</div>
    </header>
  );
}

export function MainNav() {
  return (
    <nav aria-label="Main" className="header__nav">
      <Link to="/how-it-works">How it works</Link>
      <a href="https://github.com/rayyanarchy/rcpy">GitHub</a>
    </nav>
  );
}
