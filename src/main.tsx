import "./lib/auth/recoveryHash";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Tras publicar una versión nueva, las pestañas abiertas piden archivos que ya
// no existen. Recargamos una sola vez para tomar la versión vigente.
function reloadOnceForNewVersion() {
  const key = "walix-chunk-reload";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last < 30_000) return false;
  sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
  return true;
}
window.addEventListener("vite:preloadError", (e) => {
  if (reloadOnceForNewVersion()) e.preventDefault();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e.reason as any)?.message ?? e.reason ?? "");
  if (/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)) {
    reloadOnceForNewVersion();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
