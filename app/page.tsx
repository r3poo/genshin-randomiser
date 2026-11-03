export default function Page() {
  return (
    <main className="min-h-dvh p-8">
      <h1 className="text-2xl font-semibold text-accent">Genshin Team Randomiser</h1>
      <p className="mt-2 text-muted">Scaffold OK.</p>
      <div className="mt-4 flex gap-2">
        {["anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo", "elementless"].map((e) => (
          <span key={e} className={`rounded bg-${e} px-2 py-1 text-xs text-ink`}>
            {e}
          </span>
        ))}
      </div>
    </main>
  );
}
