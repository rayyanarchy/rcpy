import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { navigate, usePath } from "../lib/router";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

/** An <a> that navigates without a page load (the app has two pages). */
export function Link({ to, onClick, ...rest }: Props) {
  const path = usePath();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} aria-current={path === to ? "page" : undefined} {...rest} />;
}
