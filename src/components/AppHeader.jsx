import { Brand } from "./Brand.jsx";

export function AppHeader({ reviewMode, onStartOver }) {
  return (
    <header className="app-header">
      <Brand />
      {reviewMode ? (
        <button className="text-action" type="button" onClick={onStartOver}>
          Start over
        </button>
      ) : (
        <a className="text-action" href="#how-it-works">
          How it works
        </a>
      )}
    </header>
  );
}
