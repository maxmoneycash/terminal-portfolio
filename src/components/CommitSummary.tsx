import { useEffect, useState } from "react";

type Activity = { commits: number; streak: number };

export function CommitSummary({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/cm/v1/ticker/maxmoneycash", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (!response.ok) throw new Error("Activity unavailable");
        const { ticker } = await response.json();
        if (!Number.isFinite(ticker?.stats?.commits52w) || !Number.isFinite(ticker?.stats?.currentStreak)) {
          throw new Error("Invalid activity response");
        }
        if (controller.signal.aborted) return;
        setActivity({ commits: ticker.stats.commits52w, streak: ticker.stats.currentStreak });
        setUnavailable(false);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [active]);

  return (
    <div className="projects-activity">
      <span>{activity ? <><strong>{activity.commits.toLocaleString("en-US")}</strong> commits / 52w <span aria-hidden="true">·</span> <strong>{activity.streak}d</strong> streak{unavailable ? " · last received" : ""}</> : unavailable ? "Activity unavailable" : "Loading activity…"}</span>
      <button type="button" onClick={onOpen} aria-label="Open live commits.sh data">commits.sh →</button>
    </div>
  );
}
