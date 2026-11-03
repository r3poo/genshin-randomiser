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
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="space-y-1 text-muted">
          {warnings.map((issue, index) => (
            <li key={`w${index}`} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted" aria-hidden />
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
    warn: "border-warning/40 bg-warning/10 text-warning",
    error: "border-danger/40 bg-danger/10 text-danger",
    info: "border-accent/30 bg-accent/5 text-body",
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

const RESET_HINT =
  "Clearing this site's data and cookies, then reloading, often fixes it — export your setup first if you have one.";

/** Storage and load-time problems. Everything here is a state the user cannot fix in-app. */
export function Banners() {
  const { hydrated, storageStatus, storageDetail, saveError, loadIssues, dismissLoadIssues } =
    useStore();

  // The probe only runs on mount, so before that the status is a placeholder. Rendering nothing
  // until it is real avoids a flash of "no local storage" on every single page load, and means a
  // healthy session reserves no space for banners it never shows.
  if (!hydrated) return null;
  if (!saveError && !loadIssues.length && storageStatus === "available") return null;

  return (
    <div className="mt-5 space-y-3">
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
          <p className="mt-1 text-xs opacity-90">{RESET_HINT}</p>
        </Banner>
      ) : null}

      {storageStatus === "unavailable" ? (
        <Banner tone="warn" title="This browser has no local storage">
          <p className="mt-1 text-xs opacity-90">
            Nothing will be saved between visits. Import and export still work.
            {storageDetail ? ` (${storageDetail})` : null}
          </p>
          <p className="mt-1 text-xs opacity-90">{RESET_HINT}</p>
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
