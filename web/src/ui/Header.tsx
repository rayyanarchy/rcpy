import type { ReactNode } from "react";
import { usePath } from "../lib/router";
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
  const path = usePath();
  return (
    <nav aria-label="Main" className="header__nav">
      {path === "/how-it-works" ? <Link to="/">Home</Link> : <Link to="/how-it-works">How it works</Link>}
      <a href="https://github.com/rayyanarchy/rcpy">GitHub</a>
    </nav>
  );
}
