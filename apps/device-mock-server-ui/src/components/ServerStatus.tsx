import { useEffect, useState } from "react";
import { Tag } from "@ledgerhq/lumen-ui-react";

import { api, type Health } from "@/api/client";

export function ServerStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const poll = () =>
      api
        .health()
        .then((next) => {
          if (cancelled) return;
          setHealth(next);
          setReachable(true);
        })
        .catch(() => {
          if (!cancelled) setReachable(false);
        });

    void poll();
    const interval = setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!reachable) {
    return <Tag appearance="error" label="Server unreachable" size="sm" />;
  }

  const sessions = health?.sessions ?? 0;
  return (
    <Tag
      appearance="success"
      size="sm"
      label={`Server up · ${sessions} session${sessions === 1 ? "" : "s"}`}
    />
  );
}
