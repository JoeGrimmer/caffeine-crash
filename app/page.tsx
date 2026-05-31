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
  const [calculationProgress, setCalculationProgress] = useState(0);
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

  // FIX 1: Animation timing — liquid fill and mg counter are now driven by the
  // same eased progress value, keeping them in perfect sync. The counter eases
  // from 0 to totalMg over pourMs using a cubic-bezier, and fillPercent derives
  // from the same progress variable so there is no drift between the two.
  useEffect(() => {
    if (mode !== "calculating") return;
    setCount(0);
    setCalculationProgress(0);

    const anticipationMs = 280;
    const pourMs = 3200;
    const settleMs = 480;
    const started = Date.now();

    // Ease function: ease-in-out cubic
    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    const ticker = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const raw = Math.min(1, Math.max(0, (elapsed - anticipationMs) / pourMs));
      const eased = easeInOut(raw);

      // Both fill and counter use the same eased progress — perfectly in sync
      setCalculationProgress(eased);
      setCount(Math.round(totalMg * eased));

      if (raw >= 1) {
        window.clearInterval(ticker);
        // Snap both to final values before transitioning
        setCalculationProgress(1);
        setCount(totalMg);
        window.setTimeout(() => setMode("results"), settleMs);
      }
    }, 16); // ~60fps for smoothness

    return () => window.clearInterval(ticker);
  }, [mode, totalMg]);

  useEffect(() => {
    if (mode === "results") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode]);

  useEffect(() => {
    if (!editing) return;
    const scrollY = window.scrollY;
    const originalBodyStyle = document.body.getAttribute("style") ?? "";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.setAttribute("style", originalBodyStyle);
      window.scrollTo(0, scrollY);
    };
  }, [editing]);

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
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
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

        <section id="curve" className="rounded-[2rem] border border-latte/70 bg-foam/82 p-4 shadow-soft backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-caramel">
                <img src="/coffee-beans.png" alt="" className="h-5 w-5 object-contain" />
                Caffeine trail
              </p>
              <h2 className="mt-1 text-2xl font-black text-espresso">Your day in coffee</h2>
            </div>
            <span className="rounded-full bg-latte/70 px-3 py-1 text-sm font-bold text-roast">~{HALF_LIFE_HOURS}h half-life</span>
          </div>
          {results ? <CurveCard results={results} /> : <CurveEmpty />}
        </section>
      </div>

      <AnimatePresence>
        {mode === "calculating" && results ? (
          <CalculationOverlay count={count} progress={calculationProgress} total={totalMg} />
        ) : null}
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
    <section className="mx-auto w-full max-w-[520px] rounded-[2rem] border border-latte bg-foam/90 p-4 shadow-soft backdrop-blur">
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
          <div className="grid h-10 w-10 place-items-center rounded-full bg-latte shadow-sm">
            <img src="/coffee-cup.png" alt="" className="h-7 w-7 object-contain" />
          </div>
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
      <p className="mt-4 max-w-xs text-base leading-6 text-roast">Log today's cups and I'll estimate when your productivity expires.</p>
      <div className="mt-8">
        <h2 className="font-black">Your coffees</h2>
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
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-latte/70">
        <img src="/coffee-cup.png" alt="" className="h-7 w-7 object-contain" />
      </div>
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
      <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-foam shadow-sm">
        <img src="/coffee-mug.png" alt="" className="h-16 w-16 object-contain" />
      </div>
      <h2 className="mt-5 text-2xl font-black">Fresh cup, blank slate</h2>
      <p className="mx-auto mt-2 max-w-[15rem] text-sm leading-6 text-roast/75">Add your first cup and we'll see what the beans have planned.</p>
      <button onClick={onAdd} className="mt-6 rounded-2xl bg-caramel px-6 py-3 font-black text-white shadow-button">
        + Add your first cup
      </button>
    </div>
  );
}

function ResultsView({ results, onCurve }: { results: NonNullable<ReturnType<typeof getCrashResults>>; onCurve: () => void }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-black text-espresso">Here's your caffeine forecast</h1>
      <p className="mt-4 text-roast/75">Today's running total</p>
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
        <h3 className="font-black">What's brewing?</h3>
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
      <img src="/coffee-mug.png" alt="" className="mx-auto h-20 w-20 object-contain" />
      <h2 className="mt-4 text-2xl font-black">No trail yet</h2>
      <p className="mt-2 text-sm text-roast/70">Add a cup and we'll draw the rise, glide, and gentle betrayal.</p>
    </div>
  );
}

function CalculationOverlay({ count, progress, total }: { count: number; progress: number; total: number }) {
  const fillPercent = Math.min(100, progress * 100);
  const isSettling = total > 0 && progress >= 1;

  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,#70401e,#24120b_68%)] px-5 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="w-full max-w-[390px] text-center">
        <h2 className="mb-6 text-3xl font-black leading-tight">Brewing your crash forecast...</h2>
        <CaffeineCupAnimation fillPercent={fillPercent} isComplete={isSettling} size={236} />
        <motion.p
          className="mt-3 text-6xl font-black"
          animate={isSettling ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.48 }}
        >
          {count}mg
        </motion.p>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#c9934a]">CAFFEINE LOADED</p>
      </div>
    </motion.div>
  );
}

function CaffeineCupAnimation({
  fillPercent,
  isComplete,
  size = 236,
}: {
  fillPercent: number;
  isComplete: boolean;
  size?: number;
}) {
  const topY = 80;
  const bottomY = 256;
  const interiorHeight = bottomY - topY;
  const fillHeight = (fillPercent / 100) * interiorHeight;
  const liquidY = bottomY - fillHeight;
  const foamY = liquidY - 9;
  const showFoam = fillPercent > 4;
  const showSteam = fillPercent > 68 || isComplete;

  // FIX 1: Liquid rect uses plain SVG attributes driven directly by the eased
  // progress value from the parent. No Framer Motion transition on the rect —
  // that was causing the duration:0 jump. The easing lives in the ticker above,
  // so the SVG just mirrors the value every frame with no additional delay.
  return (
    <div className="mx-auto flex flex-col items-center">
      <motion.svg
        width={size}
        height={290 * (size / 200)}
        viewBox="0 0 200 290"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        role="img"
        aria-label="Coffee cup filling"
        animate={isComplete ? { scale: [1, 1.025, 1] } : { scale: 1 }}
        transition={{ duration: 0.48, ease: "easeOut" }}
      >
        <defs>
          <linearGradient id="cc-liq" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2C0F04" />
            <stop offset="40%" stopColor="#4A1C08" />
            <stop offset="100%" stopColor="#2C0F04" />
          </linearGradient>
          <linearGradient id="cc-foam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9934A" />
            <stop offset="100%" stopColor="#9B6225" />
          </linearGradient>
          <linearGradient id="cc-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7B3A1E" />
            <stop offset="30%" stopColor="#A8522A" />
            <stop offset="55%" stopColor="#C1693A" />
            <stop offset="80%" stopColor="#A8522A" />
            <stop offset="100%" stopColor="#7B3A1E" />
          </linearGradient>
          <linearGradient id="cc-sleeve" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e0d6cc" />
            <stop offset="50%" stopColor="#f7f3ef" />
            <stop offset="100%" stopColor="#e0d6cc" />
          </linearGradient>
          <linearGradient id="cc-lid" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5A2410" />
            <stop offset="40%" stopColor="#7B3A1E" />
            <stop offset="100%" stopColor="#5A2410" />
          </linearGradient>
          <clipPath id="cc-interior" clipPathUnits="userSpaceOnUse">
            <polygon points="38,80 162,80 150,256 50,256" />
          </clipPath>
        </defs>

        {/* 1. Cup body — back */}
        <polygon points="32,78 168,78 156,260 44,260" fill="url(#cc-body)" />
        <polygon points="46,84 60,84 52,254 40,254" fill="white" opacity="0.06" />
        <ellipse cx="100" cy="260" rx="56" ry="5" fill="#4A1B0C" opacity="0.5" />

        {/* 2. Liquid — clipped to interior, plain attributes updated each render */}
        <g clipPath="url(#cc-interior)">
          <rect
            x="36"
            y={liquidY}
            width="128"
            height={fillHeight + 6}
            fill="url(#cc-liq)"
          />
          {showFoam && (
            <rect
              x="36"
              y={Math.max(foamY, topY)}
              width="128"
              height="9"
              fill="url(#cc-foam)"
              opacity="0.92"
            />
          )}
          {showFoam && [
            { cx: 68, r: 3 },
            { cx: 100, r: 2.2 },
            { cx: 130, r: 2.8 },
            { cx: 52, r: 1.8 },
            { cx: 148, r: 2 },
          ].map((b, i) => (
            <circle key={i} cx={b.cx} cy={liquidY + 4 + (i % 3)} r={b.r} fill="rgba(255,255,255,0.25)" />
          ))}
        </g>

        {/* 3. Sleeve + bean — front, over liquid */}
        <polygon points="36,155 164,155 160,200 40,200" fill="url(#cc-sleeve)" />
        <line x1="36" y1="155" x2="164" y2="155" stroke="#c4b4a4" strokeWidth="0.8" />
        <line x1="40" y1="200" x2="160" y2="200" stroke="#c4b4a4" strokeWidth="0.8" />
        <ellipse cx="100" cy="177" rx="13" ry="17" fill="#6B3118" opacity="0.85" />
        <path d="M100 161 Q107 169 100 177 Q93 185 100 193" fill="none" stroke="#4A1B0C" strokeWidth="1.6" strokeLinecap="round" />

        {/* 4. Lid — top */}
        <rect x="26" y="58" width="148" height="22" rx="4" fill="url(#cc-lid)" />
        <rect x="34" y="52" width="132" height="10" rx="3" fill="#6B3118" />
        <rect x="72" y="54" width="56" height="5" rx="2.5" fill="#3A1208" opacity="0.8" />
        <rect x="28" y="77" width="144" height="5" rx="2" fill="#5A2410" />

        {/* 5. Steam */}
        {showSteam &&
          [
            { d: "M78 52 C72 40 84 30 78 18", delay: 0 },
            { d: "M100 52 C94 38 106 26 100 12", delay: 0.45 },
            { d: "M122 52 C116 40 128 30 122 18", delay: 0.9 },
          ].map((steam, index) => (
            <motion.path
              key={index}
              d={steam.d}
              fill="none"
              stroke="#C9934A"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.55, 0.2, 0], y: [0, -4, -14, -24] }}
              transition={{ duration: 2.2, delay: steam.delay, ease: "easeInOut", repeat: Infinity }}
            />
          ))}
      </motion.svg>
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
      className="fixed inset-0 z-50 grid touch-none place-items-end overflow-hidden overscroll-none bg-espresso/40 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-[calc(env(safe-area-inset-top)+8px)] sm:place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...draft, caffeineMg: Math.max(0, Number(draft.caffeineMg) || 0) });
        }}
        className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-16px)] w-full max-w-[430px] touch-pan-y flex-col overflow-hidden rounded-[2rem] bg-foam shadow-soft"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pt-4">
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-latte text-xl" aria-label="Close">
            ‹
          </button>
          <h2 className="text-lg font-black">Edit entry</h2>
          <button type="button" onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-full border border-latte text-xl" aria-label="Delete">
            ×
          </button>
        </div>

        <div className="overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-3 [-webkit-overflow-scrolling:touch]">
          <div className="mx-auto mt-3 grid h-16 w-16 place-items-center rounded-full bg-latte/70">
            <img src="/coffee-cup.png" alt="" className="h-11 w-11 object-contain" />
          </div>

          <label className="mt-4 block text-sm font-black">Drink type</label>
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
            className="mt-2 block w-full max-w-full min-w-0 rounded-2xl border border-latte bg-foam px-4 py-3 outline-none ring-caramel/30 focus:ring-4"
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

          {!isCustomDrink ? (
            <>
              <label className="mt-4 block text-sm font-black">Size</label>
              <div className="mt-2 grid w-full max-w-full grid-cols-2 gap-2 rounded-2xl border border-latte bg-[#fff1dd] p-1">
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
                    className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${
                      draftSize === size ? "bg-caramel text-white shadow-sm" : "text-roast/70"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="mt-3 rounded-2xl bg-latte/55 px-4 py-2.5 text-sm text-roast">
            <span className="font-black">Estimated caffeine:</span>{" "}
            {isCustomDrink ? `${Math.max(0, Number(draft.caffeineMg) || 0)}mg, because you know your cup best.` : `${draft.caffeineMg}mg`}
          </div>
          <p className="mt-1.5 text-xs leading-5 text-roast/55">Based on typical Australian café servings</p>

          <label className="mt-4 block text-sm font-black">Caffeine (mg)</label>
          <div className="mt-2 flex w-full max-w-full min-w-0 items-center rounded-2xl border border-latte bg-foam px-4 ring-caramel/30 focus-within:ring-4">
            <input
              type="number"
              min="0"
              value={draft.caffeineMg}
              onChange={(event) => setDraft((current) => ({ ...current, caffeineMg: Number(event.target.value) }))}
              className="w-full min-w-0 bg-transparent py-3 outline-none"
            />
            <span className="text-sm text-roast/60">mg</span>
          </div>

          {/* FIX 2: Time input — appearance-none removes the browser's native
              time-picker chrome that adds intrinsic width on iOS/Android,
              box-sizing:border-box ensures padding is included in w-full,
              and -webkit-appearance:none covers older WebKit engines.
              The result matches the height, padding, and width of all other fields. */}
          <label className="mt-4 block text-sm font-black">Time consumed</label>
          <input
            type="time"
            value={draft.time}
            onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
            className="mt-2 block w-full max-w-full min-w-0 rounded-2xl border border-latte bg-foam px-4 py-3 outline-none ring-caramel/30 focus:ring-4 appearance-none [box-sizing:border-box] [-webkit-appearance:none]"
          />
        </div>

        <div className="shrink-0 overflow-x-hidden bg-foam px-4 pb-4 pt-2">
          <button className="w-full rounded-2xl bg-gradient-to-r from-caramel to-[#c77925] px-5 py-3.5 font-black text-white shadow-button">
            Save changes
          </button>
        </div>
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
  return "•";
}
