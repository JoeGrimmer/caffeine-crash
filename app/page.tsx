"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CaffeineEntry,
  formatTime,
  getCrashResults,
  HALF_LIFE_HOURS,
} from "@/lib/caffeine";

type DrinkSize = "Regular" | "Large";

type DrinkOption = {
  drinkType: string;
  category: "Coffee" | "Other";
  short: string;
  caffeine: Record<DrinkSize, number>;
  custom?: boolean;
};

const drinkOptions: DrinkOption[] = [
  { drinkType: "Instant coffee", category: "Coffee", short: "Instant", caffeine: { Regular: 75, Large: 100 } },
  { drinkType: "Single shot espresso", category: "Coffee", short: "Espresso", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Flat white", category: "Coffee", short: "Flat white", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Strong flat white", category: "Coffee", short: "Strong FW", caffeine: { Regular: 126, Large: 189 } },
  { drinkType: "Latte", category: "Coffee", short: "Latte", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Cappuccino", category: "Coffee", short: "Capp", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Long black", category: "Coffee", short: "Long black", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Americano", category: "Coffee", short: "Americano", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Mocha", category: "Coffee", short: "Mocha", caffeine: { Regular: 63, Large: 126 } },
  { drinkType: "Energy drink", category: "Other", short: "Energy", caffeine: { Regular: 80, Large: 160 } },
  { drinkType: "Custom", category: "Other", short: "Custom", caffeine: { Regular: 95, Large: 95 }, custom: true },
];

const quickAddTypes = new Set(["Instant coffee", "Single shot espresso", "Flat white", "Strong flat white", "Latte", "Cappuccino"]);
const quickAddOptions = drinkOptions.filter((option) => quickAddTypes.has(option.drinkType));
const sizeOptions: DrinkSize[] = ["Regular", "Large"];

function getDrinkOption(drinkType: string) {
  return drinkOptions.find((option) => option.drinkType === drinkType) ?? drinkOptions[0];
}

function getDefaultCaffeine(drinkType: string, size: DrinkSize) {
  return getDrinkOption(drinkType).caffeine[size];
}

const STORAGE_KEY = "caffeine-crash.entries";

function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function newEntry(preset = drinkOptions[0], size: DrinkSize = "Regular"): CaffeineEntry {
  return {
    id: crypto.randomUUID(),
    drinkType: preset.drinkType,
    size,
    caffeineMg: preset.caffeine[size],
    time: nowTime(),
  };
}

export default function Home() {
  const [entries, setEntries] = useState<CaffeineEntry[]>([]);
  const [editing, setEditing] = useState<CaffeineEntry | null>(null);
  const [mode, setMode] = useState<"input" | "calculating" | "results">("input");
  const [count, setCount] = useState(0);
  const [hasLoadedEntries, setHasLoadedEntries] = useState(false);
  const results = useMemo(() => getCrashResults(entries), [entries]);
  const totalMg = results?.totalMg ?? 0;

  useEffect(() => {
    const savedEntries = window.localStorage.getItem(STORAGE_KEY);
    if (!savedEntries) {
      setHasLoadedEntries(true);
      return;
    }

    try {
      const parsedEntries = JSON.parse(savedEntries);
      if (Array.isArray(parsedEntries)) setEntries(parsedEntries);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHasLoadedEntries(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedEntries) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, hasLoadedEntries]);

  useEffect(() => {
    if (mode !== "calculating") return;
    setCount(0);
    const started = Date.now();
    const duration = 2300;
    const ticker = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / duration);
      setCount(Math.round(totalMg * easeOut(progress)));
      if (progress === 1) {
        window.clearInterval(ticker);
        window.setTimeout(() => setMode("results"), 350);
      }
    }, 35);
    return () => window.clearInterval(ticker);
  }, [mode, totalMg]);

  useEffect(() => {
    if (mode === "results") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode]);

  function addPreset(preset = drinkOptions[0]) {
    const entry = newEntry(preset);
    setEntries((current) => [...current, entry]);
    setEditing(entry);
  }

  function saveEntry(entry: CaffeineEntry) {
    setEntries((current) => current.map((item) => (item.id === entry.id ? entry : item)));
    setEditing(null);
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setEditing(null);
    if (entries.length <= 1) setMode("input");
  }

  function calculate() {
    if (!results) return;
    setMode("calculating");
  }

  return (
    <main className="min-h-screen min-h-dvh overflow-x-hidden bg-[image:var(--page-background)] px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:grid lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <PhoneShell>
          <Header onBack={mode === "results" ? () => setMode("input") : undefined} />
          {mode === "results" && results ? (
            <ResultsView results={results} onCurve={() => document.getElementById("curve")?.scrollIntoView()} />
          ) : (
            <InputView
              entries={entries}
              onAdd={() => addPreset(drinkOptions[0])}
              onEdit={setEditing}
              onDelete={deleteEntry}
              onPreset={addPreset}
              onCalculate={calculate}
            />
          )}
        </PhoneShell>

        <section id="curve" className="rounded-[2rem] border border-latte/70 bg-foam/82 p-4 shadow-soft backdrop-blur lg:sticky lg:top-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-caramel">Caffeine trail</p>
              <h2 className="mt-1 text-2xl font-black text-espresso">Your day in coffee</h2>
            </div>
            <span className="rounded-full bg-latte/70 px-3 py-1 text-sm font-bold text-roast">~{HALF_LIFE_HOURS}h half-life</span>
          </div>
          {results ? <CurveCard results={results} /> : <CurveEmpty />}
        </section>
      </div>

      <AnimatePresence>
        {mode === "calculating" && results ? <CalculationOverlay count={count} total={totalMg} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {editing ? (
          <EditEntryModal
            entry={editing}
            onClose={() => setEditing(null)}
            onSave={saveEntry}
            onDelete={() => deleteEntry(editing.id)}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-[430px] rounded-[2rem] border border-latte bg-foam/90 p-4 shadow-soft backdrop-blur">
      {children}
      <p className="mt-6 text-center text-[11px] text-roast/70">Not medical advice. Just coffee and questionable decisions.</p>
    </section>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <header className="mb-8 flex items-center">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-full border border-latte text-xl" aria-label="Back">
            ‹
          </button>
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-latte text-xl shadow-sm">☕</div>
        )}
        <div>
          <p className="text-base font-black leading-tight">Caffeine Crash</p>
          <p className="text-xs text-roast/70">Calculator</p>
        </div>
      </div>
    </header>
  );
}

function InputView({
  entries,
  onAdd,
  onEdit,
  onDelete,
  onPreset,
  onCalculate,
}: {
  entries: CaffeineEntry[];
  onAdd: () => void;
  onEdit: (entry: CaffeineEntry) => void;
  onDelete: (id: string) => void;
  onPreset: (preset: DrinkOption) => void;
  onCalculate: () => void;
}) {
  return (
    <div>
      <h1 className="text-5xl font-black leading-[0.98] tracking-normal text-espresso">
        When will I <span className="text-caramel">crash?</span>
      </h1>
      <p className="mt-4 max-w-xs text-base leading-6 text-roast">Log today’s cups and I’ll estimate when your productivity expires.</p>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-black">Your coffees</h2>
        <button onClick={onAdd} className="grid h-11 w-11 place-items-center rounded-full bg-caramel text-2xl text-white shadow-button" aria-label="Add coffee">
          +
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {entries.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry.id)} />
          ))
        )}
      </div>

      <button onClick={onAdd} className="mt-3 w-full rounded-2xl border border-dashed border-roast/25 py-3 text-sm font-bold text-roast">
        + Add another
      </button>

      <h2 className="mt-6 font-black">Quick add</h2>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2">
        {quickAddOptions.map((preset) => (
          <button
            key={preset.drinkType}
            onClick={() => onPreset(preset)}
            className="min-w-[92px] rounded-2xl border border-latte bg-[#fff1dd] px-3 py-2.5 text-center shadow-sm transition active:scale-95"
          >
            <span className="block whitespace-nowrap text-xs font-black leading-tight">{preset.short}</span>
            <span className="mt-1 block text-xs text-roast/70">{preset.caffeine.Regular}mg</span>
          </button>
        ))}
      </div>

      <button
        onClick={onCalculate}
        disabled={entries.length === 0}
        className="mt-3 w-full rounded-2xl bg-gradient-to-r from-caramel to-[#c77925] px-5 py-4 font-black text-white shadow-button transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
      >
        Brew my crash forecast
      </button>
    </div>
  );
}

function EntryCard({ entry, onEdit, onDelete }: { entry: CaffeineEntry; onEdit: () => void; onDelete: () => void }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-latte bg-foam px-4 py-3 shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-latte/70 text-xl">☕</div>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-black capitalize">{entry.drinkType}</p>
        <p className="mt-1 text-xs text-roast/65">{entry.size ?? "Regular"} · {formatEntryTime(entry.time)}</p>
      </button>
      <p className="text-sm font-black">{entry.caffeineMg}mg</p>
      <button onClick={onDelete} className="grid h-8 w-8 place-items-center rounded-full text-roast/55" aria-label={`Remove ${entry.drinkType}`}>
        ×
      </button>
    </article>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border border-latte bg-[#fff1dd] px-5 py-8 text-center">
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-foam text-5xl shadow-sm">☕</div>
      <h2 className="mt-5 text-2xl font-black">Fresh cup, blank slate</h2>
      <p className="mx-auto mt-2 max-w-[15rem] text-sm leading-6 text-roast/75">Add your first cup and we’ll see what the beans have planned.</p>
      <button onClick={onAdd} className="mt-6 rounded-2xl bg-caramel px-6 py-3 font-black text-white shadow-button">
        + Add your first cup
      </button>
    </div>
  );
}

function ResultsView({ results, onCurve }: { results: NonNullable<ReturnType<typeof getCrashResults>>; onCurve: () => void }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-black text-espresso">Here’s the roast report 😅</h1>
      <p className="mt-4 text-roast/75">Today’s running total</p>
      <div className="mt-2 text-7xl font-black tracking-normal text-espresso">{results.totalMg}<span className="text-3xl">mg</span></div>
      <p className="text-lg">of liquid ambition</p>

      <div className="mx-auto mt-6 max-w-[260px] rounded-2xl bg-latte px-5 py-4">
        <p className="font-black">{statusIcon(results.status)} {results.status}</p>
        <p className="mt-1 text-sm text-roast/75">Proceed responsibly.</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric title="Peak buzz" value={formatTime(results.peakTime)} icon="↗" />
        <Metric title="Crash window" value={`${formatTime(results.crashStart)} - ${formatTime(results.crashEnd)}`} icon="☠" />
        <Metric title="Sleep mood" value={results.sleepRisk} icon="☾" />
      </div>

      <div className="mt-4 rounded-2xl border border-latte bg-foam p-4 text-left">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-roast/70">Regret meter</p>
            <p className="text-3xl font-black text-espresso">{results.regretScore}/100</p>
          </div>
          <p className="max-w-[11rem] text-sm leading-5 text-roast/75">Estimated crash incoming. Water would like a word.</p>
        </div>
      </div>

      <button onClick={onCurve} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-caramel to-[#c77925] px-5 py-4 font-black text-white shadow-button">
        ↗ See the caffeine trail
      </button>
    </div>
  );
}

function Metric({ icon, title, value }: { icon: string; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-latte bg-foam px-2 py-4">
      <div className="text-xl">{icon}</div>
      <p className="mt-2 text-[11px] text-roast/70">{title}</p>
      <p className="mt-1 text-sm font-black leading-tight">{value}</p>
    </div>
  );
}

function CurveCard({ results }: { results: NonNullable<ReturnType<typeof getCrashResults>> }) {
  return (
    <div>
      <div className="h-[270px] rounded-3xl border border-latte bg-[#fff9ef] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={results.chartData} margin={{ top: 18, right: 18, left: -12, bottom: 4 }}>
            <defs>
              <linearGradient id="coffeeFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#b8651f" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#b8651f" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#ead5b8" strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fill: "#6f442b", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#6f442b", fontSize: 11 }} tickLine={false} axisLine={false} width={38} />
            <Tooltip
              contentStyle={{ border: "1px solid #f4dcc0", borderRadius: 16, background: "#fffaf1", color: "#2a170f" }}
              formatter={(value) => [`${value}mg`, "Coffee power"]}
            />
            <Area type="monotone" dataKey="caffeine" stroke="#8f4618" strokeWidth={3} fill="url(#coffeeFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 rounded-3xl border border-latte bg-foam p-4">
        <h3 className="font-black">What’s brewing?</h3>
        <ul className="mt-3 space-y-3 text-sm leading-5 text-roast/80">
          <li><b>Lift-off:</b> caffeine usually hits its stride 30–60 minutes after a cup.</li>
          <li><b>Peak:</b> your caffeine likely peaks around {formatTime(results.peakTime)}.</li>
          <li><b>Crash:</b> you may start feeling the crash around {formatTime(results.crashStart)}.</li>
        </ul>
      </div>
    </div>
  );
}

function CurveEmpty() {
  return (
    <div className="rounded-3xl border border-dashed border-roast/25 bg-foam p-8 text-center">
      <div className="text-5xl">☕</div>
      <h2 className="mt-4 text-2xl font-black">No trail yet</h2>
      <p className="mt-2 text-sm text-roast/70">Add a cup and we’ll draw the rise, glide, and gentle betrayal.</p>
    </div>
  );
}

function CalculationOverlay({ count, total }: { count: number; total: number }) {
  const ratio = total === 0 ? 0 : count / Math.max(600, total);
  const label = count >= 450 ? "Send help" : count >= 300 ? "Danger zone" : count >= 150 ? "Wired" : "Mild buzz";

  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center bg-[radial-gradient(circle_at_top,#6d3518,#24120b_66%)] px-5 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-[390px] text-center">
        <div className="text-4xl">☕</div>
        <h2 className="mt-5 text-3xl font-black leading-tight">Brewing your crash forecast...</h2>
        <div className="relative mx-auto mt-8 h-[390px] w-[180px] rounded-b-[3.2rem] rounded-t-[1.4rem] border-4 border-white/55 bg-white/10 shadow-[inset_0_0_36px_rgba(255,255,255,.16)]">
          <div className="absolute left-1/2 top-[-32px] h-[112%] w-5 -translate-x-1/2 bg-gradient-to-b from-[#d27224]/80 to-[#6a2e12]/70 blur-[1px]" />
          <motion.div
            className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-b-[2.8rem] bg-gradient-to-b from-[#d27224] via-[#8f4618] to-[#3a180b]"
            initial={{ height: 0 }}
            animate={{ height: `${Math.min(88, Math.max(10, ratio * 100))}%` }}
            transition={{ duration: 0.35 }}
          >
            <div className="h-6 bg-[#ffe2bc]/85 shadow-[0_0_18px_rgba(255,226,188,.8)]" />
            <div className="absolute inset-x-5 top-9 h-3 rounded-full bg-white/20" />
          </motion.div>
          <div className="absolute -right-28 top-8 space-y-10 text-left text-xs font-bold text-white/90">
            <ScaleMark mg="600mg" label="Send help" />
            <ScaleMark mg="400mg" label="Danger zone" />
            <ScaleMark mg="200mg" label="Wired" />
            <ScaleMark mg="0mg" label="Mild buzz" />
          </div>
        </div>
        <p className="mt-7 text-6xl font-black">{count}mg</p>
        <p className="mt-1 text-xl">{label}</p>
      </div>
    </motion.div>
  );
}

function ScaleMark({ mg, label }: { mg: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px w-5 bg-white/45" />
      <span><b>{mg}</b><br />{label}</span>
    </div>
  );
}

function EditEntryModal({
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  entry: CaffeineEntry;
  onClose: () => void;
  onSave: (entry: CaffeineEntry) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(entry);
  const draftSize = draft.size ?? "Regular";
  const selectedDrink = getDrinkOption(draft.drinkType);
  const isCustomDrink = selectedDrink.custom === true;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-end bg-espresso/40 px-3 pb-3 sm:place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...draft, caffeineMg: Math.max(0, Number(draft.caffeineMg) || 0) });
        }}
        className="max-h-[calc(100dvh-24px)] w-full max-w-[430px] overflow-y-auto rounded-[2rem] bg-foam p-5 shadow-soft"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
      >
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-latte text-xl" aria-label="Close">
            ‹
          </button>
          <h2 className="text-lg font-black">Edit entry</h2>
          <button type="button" onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-full border border-latte text-xl" aria-label="Delete">
            ×
          </button>
        </div>

        <div className="mx-auto mt-6 grid h-24 w-24 place-items-center rounded-full bg-latte/70 text-5xl">☕</div>

        <label className="mt-7 block text-sm font-black">Drink type</label>
        <select
          value={draft.drinkType}
          onChange={(event) => {
            const selected = getDrinkOption(event.target.value);
            setDraft((current) => ({
              ...current,
              drinkType: event.target.value,
              size: current.size ?? "Regular",
              caffeineMg: selected.custom ? current.caffeineMg : selected.caffeine[current.size ?? "Regular"],
            }));
          }}
          className="mt-2 w-full rounded-2xl border border-latte bg-foam px-4 py-4 outline-none ring-caramel/30 focus:ring-4"
        >
          <optgroup label="Coffee">
            {drinkOptions
              .filter((option) => option.category === "Coffee")
              .map((option) => (
                <option key={option.drinkType}>{option.drinkType}</option>
              ))}
          </optgroup>
          <optgroup label="Other">
            {drinkOptions
              .filter((option) => option.category === "Other")
              .map((option) => (
                <option key={option.drinkType}>{option.drinkType}</option>
              ))}
          </optgroup>
        </select>
        <p className="mt-2 text-xs leading-5 text-roast/60">Based on typical Australian café servings</p>

        {!isCustomDrink ? (
          <>
            <label className="mt-5 block text-sm font-black">Size</label>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-latte bg-[#fff1dd] p-1">
              {sizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      size,
                      caffeineMg: getDefaultCaffeine(current.drinkType, size),
                    }))
                  }
                  className={`rounded-xl px-3 py-3 text-sm font-black transition ${
                    draftSize === size ? "bg-caramel text-white shadow-sm" : "text-roast/70"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-4 rounded-2xl bg-latte/55 px-4 py-3 text-sm text-roast">
          <span className="font-black">Estimated caffeine:</span>{" "}
          {isCustomDrink ? `${Math.max(0, Number(draft.caffeineMg) || 0)}mg, because you know your cup best.` : `${draft.caffeineMg}mg`}
        </div>

        <label className="mt-5 block text-sm font-black">Caffeine (mg)</label>
        <div className="mt-2 flex items-center rounded-2xl border border-latte bg-foam px-4 ring-caramel/30 focus-within:ring-4">
          <input
            type="number"
            min="0"
            value={draft.caffeineMg}
            onChange={(event) => setDraft((current) => ({ ...current, caffeineMg: Number(event.target.value) }))}
            className="w-full bg-transparent py-4 outline-none"
          />
          <span className="text-sm text-roast/60">mg</span>
        </div>

        <label className="mt-5 block text-sm font-black">Time consumed</label>
        <input
          type="time"
          value={draft.time}
          onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
          className="mt-2 w-full rounded-2xl border border-latte bg-foam px-4 py-4 outline-none ring-caramel/30 focus:ring-4"
        />

        <button className="mt-8 w-full rounded-2xl bg-gradient-to-r from-caramel to-[#c77925] px-5 py-4 font-black text-white shadow-button">
          Save changes
        </button>
      </motion.form>
    </motion.div>
  );
}

function formatEntryTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatTime(date);
}

function statusIcon(status: string) {
  if (status === "Send help") return "🚨";
  if (status === "Danger zone") return "☠";
  if (status === "Wired") return "⚡";
  return "☕";
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}
