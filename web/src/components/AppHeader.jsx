import { Brand } from "./Brand.jsx";

export function AppHeader({ homeMode, reviewMode, onStartOver }) {
  return (
    <header className="app-header">
      <Brand compact={homeMode} />
      {reviewMode && (
        <button className="text-action" type="button" onClick={onStartOver}>
          Start over
        </button>
      )}
    </header>
  );
}
