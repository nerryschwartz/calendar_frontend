import { useEffect, useState, type ReactNode } from "react";
import { getSettings, updateSettings } from "../api/settings";

let pending: Promise<void> | null = null;
export function synchronizeBrowserTimezone(): Promise<void> {
  if (!pending) pending = (async () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const settings = await getSettings();
    if (settings.local_timezone !== zone) await updateSettings({ local_timezone: zone });
  })().finally(() => { pending = null; });
  return pending;
}

export default function BrowserTimezone({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const sync = () => {
      if (document.visibilityState === "hidden") return;
      void synchronizeBrowserTimezone().then(() => {
        if (active) { setReady(true); setError(null); }
      }).catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Timezone synchronization failed");
      });
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      active = false;
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [retry]);
  return <>{error && <section className="view" role="alert">
    <p>Timezone synchronization failed: {error}</p>
    <button type="button" className="btn-secondary" onClick={() => setRetry((value) => value + 1)}>Retry timezone sync</button>
  </section>}{ready ? children : !error && <p className="muted">Loading local timezone...</p>}</>;
}
