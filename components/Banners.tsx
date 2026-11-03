"use client";

import { useStore } from "@/lib/store";
import type { Issue } from "@/lib/validate";

function IssueList({ issues }: { issues: Issue[] }) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  return (
    <div className="mt-2 space-y-2 text-xs">
      {errors.length > 0 ? (
        <ul className="space-y-1">
          {errors.map((issue, index) => (
            <li key={`e${index}`} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="space-y-1 text-muted">
          {warnings.map((issue, index) => (
            <li key={`w${index}`} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: "warn" | "error" | "info";
  title: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const tones = {
    warn: "border-amber-500/40 bg-amber-500/10 text-amber-100",
    error: "border-rose-500/40 bg-rose-500/10 text-rose-100",
    info: "border-accent/30 bg-accent/5 text-slate-200",
  } as const;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`} role="status">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          {children}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded px-1 text-xs text-current/70 hover:text-current"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Storage and load-time problems. Everything here is a state the user cannot fix in-app. */
export function Banners() {
  const { storageStatus, storageDetail, saveError, loadIssues, dismissLoadIssues } = useStore();

  return (
    <div className="space-y-3">
      {storageStatus === "denied" ? (
        <Banner
          tone="warn"
          title="This browser is blocking local storage"
        >
          <p className="mt-1 text-xs opacity-90">
            Your pools, teams and history live only in this tab and will be lost when you close it.
            Import and export still work, so use them to keep a copy.
            {storageDetail ? ` (${storageDetail})` : null}
          </p>
        </Banner>
      ) : null}

      {storageStatus === "unavailable" ? (
        <Banner tone="warn" title="This browser has no local storage">
          <p className="mt-1 text-xs opacity-90">
            Nothing will be saved between visits. Import and export still work.
            {storageDetail ? ` (${storageDetail})` : null}
          </p>
        </Banner>
      ) : null}

      {saveError ? (
        <Banner tone="error" title="Changes could not be saved">
          <p className="mt-1 text-xs opacity-90">{saveError}</p>
        </Banner>
      ) : null}

      {loadIssues.length > 0 ? (
        <Banner
          tone="info"
          title="Saved configuration was repaired on load"
          onDismiss={dismissLoadIssues}
        >
          <p className="mt-1 text-xs text-muted">
            Parts of the stored data were unusable and have been dropped.
          </p>
          <IssueList issues={loadIssues} />
        </Banner>
      ) : null}
    </div>
  );
}
