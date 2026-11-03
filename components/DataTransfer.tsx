"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BUTTON, BUTTON_GHOST } from "@/lib/ui";
import {
  EXPORT_APP_ID,
  buildExportPayload,
  parseExportPayload,
  type Issue,
} from "@/lib/validate";

type Report = { kind: "ok" | "error"; message: string; issues: Issue[] };

export function DataTransfer() {
  const { state, dispatch } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<Report | null>(null);

  function onExport() {
    const payload = buildExportPayload(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `genshin-teams-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setReport({
      kind: "ok",
      message: `Exported ${state.pools.length} pool(s), ${state.teams.length} team(s) and ${state.history.length} history entries.`,
      issues: [],
    });
  }

  async function onFile(file: File) {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setReport({ kind: "error", message: `${file.name} is not valid JSON.`, issues: [] });
      return;
    }

    const app = typeof raw === "object" && raw !== null ? (raw as { app?: unknown }).app : undefined;
    if (app !== EXPORT_APP_ID) {
      setReport({
        kind: "error",
        message: `${file.name} is not a Genshin Team Randomiser export.`,
        issues: [],
      });
      return;
    }

    const { state: imported, issues } = parseExportPayload(raw);
    const failed = issues.filter((issue) => issue.level === "error");

    if (
      !window.confirm(
        `Importing replaces your current pools, teams and history with the contents of ${file.name}. Continue?`,
      )
    ) {
      return;
    }

    dispatch({ type: "replace", state: imported });
    setReport({
      kind: failed.length ? "error" : "ok",
      message: failed.length
        ? `Imported with ${failed.length} problem(s) — unusable data was dropped.`
        : `Imported ${imported.pools.length} pool(s), ${imported.teams.length} team(s) and ${imported.history.length} history entries.`,
      issues,
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" className={BUTTON} onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <button type="button" className={BUTTON} onClick={onExport}>
          Export
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset first so choosing the same file twice still fires a change event.
          event.target.value = "";
          if (file) void onFile(file);
        }}
      />

      {report ? (
        <div
          role="status"
          className={`max-w-md rounded-lg border px-3 py-2 text-left text-xs ${
            report.kind === "ok"
              ? "border-accent/30 bg-accent/5 text-slate-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-100"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{report.message}</span>
            <button
              type="button"
              className={BUTTON_GHOST}
              onClick={() => setReport(null)}
              aria-label="Dismiss import report"
            >
              ✕
            </button>
          </div>
          {report.issues.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {report.issues.map((issue, index) => (
                <li key={index} className="flex gap-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      issue.level === "error" ? "bg-rose-400" : "bg-slate-500"
                    }`}
                    aria-hidden
                  />
                  <span className={issue.level === "error" ? "" : "text-muted"}>
                    {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
