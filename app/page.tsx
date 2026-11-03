"use client";

import { useState } from "react";
import { Banners } from "@/components/Banners";
import { DataTransfer } from "@/components/DataTransfer";
import { HistoryPanel } from "@/components/HistoryPanel";
import { PoolsPanel } from "@/components/PoolsPanel";
import { TeamsPanel } from "@/components/TeamsPanel";
import { useStore } from "@/lib/store";

const TABS = [
  { id: "teams", label: "Teams" },
  { id: "pools", label: "Pools" },
  { id: "history", label: "History" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Page() {
  const { hydrated, state } = useStore();
  const [tab, setTab] = useState<TabId>("teams");

  return (
    <main className="mx-auto w-full px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-accent/80">
            Genshin Impact · team builder
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-strong md:text-3xl">
            Team Randomiser
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Build character pools, assign them to teams, and draw squads for co-op or Stygian
            Onslaught. Everything is stored in this browser.
          </p>
        </div>
        <DataTransfer />
      </header>

      <div className="mt-5">
        <Banners />
      </div>

      <nav
        className="mt-6 flex gap-1 border-b border-line"
        role="tablist"
        aria-label="Sections"
      >
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            aria-controls={`panel-${entry.id}`}
            id={`tab-${entry.id}`}
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === entry.id
                ? "border-accent text-strong"
                : "border-transparent text-muted hover:text-soft"
            }`}
          >
            {entry.label}
            {entry.id === "pools" ? (
              <span className="ml-1.5 text-xs text-muted">{state.pools.length}</span>
            ) : null}
            {entry.id === "teams" ? (
              <span className="ml-1.5 text-xs text-muted">{state.teams.length}</span>
            ) : null}
            {entry.id === "history" ? (
              <span className="ml-1.5 text-xs text-muted">{state.history.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="mt-5"
      >
        {hydrated ? (
          <>
            {tab === "teams" ? <TeamsPanel /> : null}
            {tab === "pools" ? <PoolsPanel /> : null}
            {tab === "history" ? <HistoryPanel /> : null}
          </>
        ) : (
          <div className="space-y-3" aria-busy="true">
            <div className="h-16 animate-pulse rounded-xl border border-line bg-panel" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-56 animate-pulse rounded-xl border border-line bg-panel" />
              <div className="h-56 animate-pulse rounded-xl border border-line bg-panel" />
            </div>
          </div>
        )}
      </section>

      <footer className="mt-10 border-t border-line/70 pt-4 text-[11px] leading-relaxed text-muted">
        <p>
          Unofficial fan project. Character data and artwork are property of HoYoverse and are used
          under the same non-commercial fan-use terms as other community tools. Data snapshot:{" "}
          <a
            className="text-soft underline decoration-line underline-offset-2 hover:text-accent"
            href="https://github.com/dvaJi/genshin-data"
            target="_blank"
            rel="noreferrer"
          >
            dvaJi/genshin-data
          </a>
          , artwork from{" "}
          <a
            className="text-soft underline decoration-line underline-offset-2 hover:text-accent"
            href="https://gi.yatta.moe"
            target="_blank"
            rel="noreferrer"
          >
            gi.yatta.moe
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
