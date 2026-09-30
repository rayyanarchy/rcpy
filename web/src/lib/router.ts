import { useSyncExternalStore } from "react";

// Two pages don't need a router library: the path lives in the History API.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l());
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}
