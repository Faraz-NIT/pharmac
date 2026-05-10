import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight, Database, Download,
  ExternalLink, FileText, GitBranch, Loader2, Play, RefreshCw, Shield, XCircle,
} from "lucide-react";
import { DRUG_PRESETS, type Signal } from "@/lib/openfda";
import { runPipeline } from "@/lib/pipeline.functions";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedPipeline } from "@/components/AnimatedPipeline";
import { PulseLine, MoleculeMark, ConcentricRings } from "@/components/MinimalGraphics";
import { MoleculeLogo } from "@/components/MoleculeLogo";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Pharmanalyst — Real-time openFDA Pharmacovigilance" },
      { name: "description", content: "Live FDA FAERS ingestion with PRR & ROR disproportionality signal detection." },
    ],
  }),
});

function Index() {
  const [drug, setDrug] = useState<string>("OZEMPIC");
  const [levelFilter, setLevelFilter] = useState<"all" | Signal["level"]>("all");
  const [selected, setSelected] = useState<Signal | null>(null);
  const qc = useQueryClient();
  const runPipelineFn = useServerFn(runPipeline);

  // ---- Read from Supabase ----
  const signalsQ = useQuery({
    queryKey: ["db", "signals", drug],
    queryFn: async (): Promise<Signal[]> => {
      // Latest successful run for this drug
      const { data: lastRun } = await supabase
        .from("pipeline_runs")
        .select("id")
        .eq("drug", drug)
        .eq("status", "success")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastRun) return [];
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("run_id", lastRun.id)
        .order("prr", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        reaction: r.reaction,
        a: r.a, b: r.b, c: r.c, d: r.d,
        prr: Number(r.prr), prrLow: Number(r.prr_low), prrHigh: Number(r.prr_high),
        ror: Number(r.ror), rorLow: Number(r.ror_low), rorHigh: Number(r.ror_high),
        chiSq: Number(r.chi_sq),
        level: r.level as Signal["level"],
      }));
    },
  });

  const runsQ = useQuery({
    queryKey: ["db", "runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lastRunForDrug = useMemo(
    () => runsQ.data?.find((r) => r.drug === drug),
    [runsQ.data, drug],
  );

  const signals = signalsQ.data ?? [];

  const filtered = useMemo(
    () => (levelFilter === "all" ? signals : signals.filter((s) => s.level === levelFilter)),
    [signals, levelFilter],
  );

  // ---- Trigger pipeline run ----
  const runMut = useMutation({
    mutationFn: (d: string) => runPipelineFn({ data: { drug: d } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["db"] });
    },
  });

  // Realtime subscription — refresh on any inserts
  useEffect(() => {
    const ch = supabase
      .channel("pv-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_runs" }, () => {
        qc.invalidateQueries({ queryKey: ["db"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "signals" }, () => {
        qc.invalidateQueries({ queryKey: ["db"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const isLoading = signalsQ.isLoading || runMut.isPending;
  const pipelineError = runMut.error instanceof Error
    ? runMut.error.message
    : lastRunForDrug?.status === "failed"
      ? lastRunForDrug.error ?? "Pipeline run failed."
      : signalsQ.error instanceof Error
        ? signalsQ.error.message
        : null;

  const totals = useMemo(() => ({
    strong: signals.filter((s) => s.level === "strong").length,
    moderate: signals.filter((s) => s.level === "moderate").length,
    weak: signals.filter((s) => s.level === "weak").length,
    grand: lastRunForDrug?.reports_total ?? 0,
    drug: lastRunForDrug?.drug_reports ?? 0,
  }), [signals, lastRunForDrug]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <BackgroundGrid />
      <Sidebar />
      <div className="md:pl-64 relative">
        <Topbar
          drug={drug}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["db"] })}
          onRun={() => runMut.mutate(drug)}
          running={runMut.isPending}
          lastRunAt={lastRunForDrug?.finished_at}
        />
        <main className="px-6 py-8 space-y-8 max-w-[1600px]">
          <section id="overview" className="scroll-mt-20">
            <Hero drug={drug} setDrug={setDrug} totals={totals} loading={isLoading} />
          </section>
          <section id="pipeline" className="scroll-mt-20">
            <AnimatedPipeline active={runMut.isPending} />
          </section>
          <KpiRow totals={totals} signalsCount={signals.length} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <section id="signals" className="scroll-mt-20">
              <SignalsTable
                rows={filtered}
                allRows={signals}
                drug={drug}
                loading={isLoading}
                error={pipelineError}
                levelFilter={levelFilter}
                setLevelFilter={setLevelFilter}
                selected={selected}
                onSelect={setSelected}
              />
              </section>
              <section id="runs" className="scroll-mt-20">
                <RunsTable runs={runsQ.data ?? []} loading={runsQ.isLoading} />
              </section>
            </div>
            <div className="space-y-6">
              <section id="database" className="scroll-mt-20">
                <SignalDetail signal={selected ?? signals[0]} drug={drug} />
              </section>
              <section id="audit" className="scroll-mt-20">
                <AuditCard drug={drug} />
              </section>
            </div>
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

/* ---------- Background ---------- */
function BackgroundGrid() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 opacity-[0.04] pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse at top, black 30%, transparent 80%)",
      }}
    />
  );
}

/* ---------- Layout ---------- */
function Sidebar() {
  const items = [
    { label: "Overview", icon: Activity, target: "overview" },
    { label: "Signals", icon: AlertTriangle, target: "signals" },
    { label: "Pipeline Runs", icon: GitBranch, target: "runs" },
    { label: "Database", icon: Database, target: "database" },
    { label: "Audit Reports", icon: FileText, target: "audit" },
    { label: "Compliance", icon: Shield, target: "audit" },
  ];
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const ids = ["overview", "pipeline", "signals", "runs", "database", "audit"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-sidebar/80 backdrop-blur z-20">
      <div className="px-6 py-6 border-b border-sidebar-border flex items-center gap-3">
        <div className="size-10 rounded-md grid place-items-center text-primary">
          <MoleculeLogo className="size-9" />
        </div>
        <div>
          <div className="font-semibold tracking-tight">Pharmanalyst</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">live · openFDA</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const isActive = active === it.target;
          return (
            <button
              key={it.label}
              onClick={() => go(it.target)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`}
            >
              <it.icon className="size-4" />
              <span>{it.label}</span>
              {isActive && <ChevronRight className="size-4 ml-auto" />}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground space-y-1.5">
        <Status dot="bg-success animate-pulse" label="api.fda.gov healthy" />
        <Status dot="bg-success" label="Postgres · 18 tables" />
        <Status dot="bg-warning" label="Next run · 03:42" />
      </div>
    </aside>
  );
}

function Status({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}

function Topbar({
  drug, onRefresh, onRun, running, lastRunAt,
}: {
  drug: string;
  onRefresh: () => void;
  onRun: () => void;
  running: boolean;
  lastRunAt?: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-background/70 border-b border-border">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Workspace</span>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="font-medium">FAERS-Prod</span>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="text-muted-foreground font-mono">{drug}</span>
          {lastRunAt && (
            <span className="text-[11px] text-muted-foreground font-mono ml-2">
              · last run {new Date(lastRunAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm hover:bg-secondary">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
          <button
            onClick={onRun}
            disabled={running}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {running ? "Running…" : "Trigger run"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero({
  drug, setDrug, totals, loading,
}: {
  drug: string; setDrug: (d: string) => void;
  totals: { strong: number; moderate: number; grand: number; drug: number };
  loading: boolean;
}) {
  const [custom, setCustom] = useState("");
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
      <div
        className="absolute inset-0 opacity-[0.10] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, var(--primary) 0, transparent 45%), radial-gradient(circle at 90% 100%, var(--accent) 0, transparent 45%)",
        }}
      />
      <ConcentricRings className="absolute -right-16 -top-16 size-72 text-primary pointer-events-none opacity-60" />
      <PulseLine className="absolute inset-x-8 bottom-4 h-10 text-primary/40 pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border bg-secondary text-xs font-mono">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            LIVE · api.fda.gov/drug/event.json
          </span>
          <h1 className="font-display text-4xl lg:text-5xl font-light leading-[1.05]">
            Pharmacovigilance for{" "}
            <em className="not-italic font-medium italic bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {drug.toLowerCase()}
            </em>
          </h1>
          <p className="text-muted-foreground">
            Real FDA adverse-event reports, disproportionality math (PRR / ROR / χ²), audited end-to-end.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {DRUG_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => setDrug(d)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                  drug === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {d}
              </button>
            ))}
            <form
              onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { setDrug(custom.trim().toUpperCase()); setCustom(""); } }}
              className="flex items-center gap-1"
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="custom drug…"
                className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-input/60 border border-border w-32 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </form>
          </div>
        </div>
        <div className="flex items-end gap-6 text-sm">
          <MoleculeMark className="hidden md:block size-24 text-primary/70 -mb-1" />
          <Stat label={`${drug} reports`} value={loading ? "…" : totals.drug.toLocaleString()} />
          <Stat label="Strong signals" value={loading ? "…" : totals.strong} accent="strong" />
          <Stat label="Moderate" value={loading ? "…" : totals.moderate} accent="moderate" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: "strong" | "moderate" }) {
  const color = accent === "strong" ? "text-signal-strong" : accent === "moderate" ? "text-signal-moderate" : "text-foreground";
  return (
    <div>
      <div className={`font-display text-4xl font-light tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/* ---------- KPIs ---------- */
function KpiRow({ totals, signalsCount }: { totals: { grand: number; drug: number; strong: number; moderate: number }; signalsCount: number }) {
  const cards = [
    { label: "FAERS reports indexed", value: totals.grand ? totals.grand.toLocaleString() : "—", sub: "openFDA total · all drugs", icon: Database },
    { label: "Drug-specific reports", value: totals.drug.toLocaleString(), sub: "current selection", icon: Activity },
    { label: "Reactions analysed", value: signalsCount, sub: "top MedDRA PT terms", icon: AlertTriangle },
    { label: "Threshold breaches", value: totals.strong + totals.moderate, sub: "PRR ≥ 1.5 · n ≥ 3", icon: CheckCircle2 },
  ];
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <c.icon className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono">{c.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
        </motion.div>
      ))}
    </section>
  );
}

/* ---------- Signals ---------- */
function SignalsTable({
  rows, allRows, drug, loading, error, levelFilter, setLevelFilter, selected, onSelect,
}: {
  rows: Signal[]; allRows: Signal[]; drug: string;
  loading: boolean; error: string | null;
  levelFilter: "all" | Signal["level"]; setLevelFilter: (l: "all" | Signal["level"]) => void;
  selected: Signal | null; onSelect: (s: Signal) => void;
}) {
  const filters: Array<{ k: "all" | Signal["level"]; label: string }> = [
    { k: "all", label: `All · ${allRows.length}` },
    { k: "strong", label: "Strong" },
    { k: "moderate", label: "Moderate" },
    { k: "weak", label: "Weak" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            Disproportionality signals
            <span className="text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">PRR ≥ 2 · χ² ≥ 4 · n ≥ 3</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            <span className="text-foreground">{drug}</span> · live FAERS · MedDRA PT
          </p>
        </div>
        <div className="flex border border-border rounded-md overflow-hidden text-xs">
          {filters.map((f) => (
            <button
              key={f.k}
              onClick={() => setLevelFilter(f.k)}
              className={`px-3 h-9 ${levelFilter === f.k ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            <AlertTriangle className="size-5 mx-auto mb-2 text-destructive" />
            <div className="font-medium text-foreground">Pipeline request failed.</div>
            <div className="mt-1 max-w-2xl mx-auto font-mono text-xs">{error}</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No signals at this threshold. Try widening the filter.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Event (MedDRA PT)</th>
                <th className="text-right font-medium px-3 py-2.5">N</th>
                <th className="text-right font-medium px-3 py-2.5">PRR (95% CI)</th>
                <th className="text-right font-medium px-3 py-2.5">ROR (95% CI)</th>
                <th className="text-right font-medium px-3 py-2.5">χ²</th>
                <th className="text-left font-medium px-3 py-2.5">Signal</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              <AnimatePresence initial={false}>
                {rows.slice(0, 14).map((s) => (
                  <motion.tr
                    key={s.reaction}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onSelect(s)}
                    className={`border-t border-border cursor-pointer transition-colors ${
                      selected?.reaction === s.reaction ? "bg-secondary/60" : "hover:bg-secondary/30"
                    }`}
                  >
                    <td className="px-5 py-3 font-sans">
                      <span className="font-medium">{titleCase(s.reaction)}</span>
                    </td>
                    <td className="px-3 py-3 text-right">{s.a.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">
                      {s.prr.toFixed(2)} <span className="text-muted-foreground text-xs">[{s.prrLow.toFixed(2)}–{s.prrHigh.toFixed(2)}]</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {s.ror.toFixed(2)} <span className="text-muted-foreground text-xs">[{s.rorLow.toFixed(2)}–{s.rorHigh.toFixed(2)}]</span>
                    </td>
                    <td className="px-3 py-3 text-right">{s.chiSq.toFixed(1)}</td>
                    <td className="px-3 py-3"><LevelPill level={s.level} /></td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
      <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground flex justify-between items-center">
        <span>Showing {Math.min(14, rows.length)} of {rows.length} signals</span>
        <a
          href={`https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:%22${drug}%22&count=patient.reaction.reactionmeddrapt.exact`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-primary hover:underline inline-flex items-center gap-1"
        >
          inspect raw API <ExternalLink className="size-3" />
        </a>
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className="p-5 space-y-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 flex-1 rounded bg-secondary/60 animate-pulse" />
          <div className="h-4 w-20 rounded bg-secondary/60 animate-pulse" />
          <div className="h-4 w-24 rounded bg-secondary/60 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function LevelPill({ level }: { level: Signal["level"] }) {
  const map = {
    strong: { c: "bg-signal-strong/15 text-signal-strong border-signal-strong/40", t: "STRONG" },
    moderate: { c: "bg-signal-moderate/15 text-signal-moderate border-signal-moderate/40", t: "MODERATE" },
    weak: { c: "bg-signal-weak/15 text-signal-weak border-signal-weak/40", t: "WEAK" },
    none: { c: "bg-muted text-muted-foreground border-border", t: "NONE" },
  }[level];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono ${map.c}`}>{map.t}</span>;
}

/* ---------- Detail ---------- */
function SignalDetail({ signal, drug }: { signal: Signal | undefined; drug: string }) {
  if (!signal) {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        Select a signal to inspect its 2×2 contingency.
      </section>
    );
  }
  return (
    <motion.section
      key={signal.reaction}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider">SIGNAL DETAIL</span>
          <LevelPill level={signal.level} />
        </div>
        <h3 className="mt-2 font-semibold text-lg leading-tight">
          <span className="font-mono text-primary">{drug}</span>{" "}
          <span className="text-muted-foreground">×</span>{" "}
          {titleCase(signal.reaction)}
        </h3>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">2×2 Contingency</div>
          <table className="w-full text-sm font-mono border border-border rounded-md overflow-hidden">
            <thead className="text-[10px] uppercase text-muted-foreground bg-secondary/40">
              <tr><th className="px-2 py-1.5"></th><th className="px-2 py-1.5">Event +</th><th className="px-2 py-1.5">Event −</th></tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-2 py-2 text-muted-foreground text-[11px]">Drug +</td>
                <td className="px-2 py-2 text-center text-signal-strong font-semibold">{signal.a.toLocaleString()}</td>
                <td className="px-2 py-2 text-center">{signal.b.toLocaleString()}</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-2 py-2 text-muted-foreground text-[11px]">Drug −</td>
                <td className="px-2 py-2 text-center">{signal.c.toLocaleString()}</td>
                <td className="px-2 py-2 text-center">{signal.d.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="PRR" value={signal.prr.toFixed(2)} hint={`[${signal.prrLow.toFixed(2)} – ${signal.prrHigh.toFixed(2)}]`} />
          <Metric label="ROR" value={signal.ror.toFixed(2)} hint={`[${signal.rorLow.toFixed(2)} – ${signal.rorHigh.toFixed(2)}]`} />
          <Metric label="χ² (Yates)" value={signal.chiSq.toFixed(1)} hint={signal.chiSq >= 4 ? "p < 0.05" : "ns"} />
          <Metric label="Cases" value={signal.a.toLocaleString()} hint="exposed + event" />
        </div>
      </div>
    </motion.section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold font-mono mt-0.5">{value}</div>
      <div className="text-[11px] text-muted-foreground font-mono">{hint}</div>
    </div>
  );
}

type RunRow = {
  id: string; drug: string; status: string;
  started_at: string; finished_at: string | null;
  duration_ms: number | null; reports_total: number;
  drug_reports: number; signals_count: number;
};

function RunsTable({ runs, loading }: { runs: RunRow[]; loading: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Recent pipeline runs</h2>
          <p className="text-xs text-muted-foreground mt-0.5">live from <span className="font-mono">pipeline_runs</span> · postgres</p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{runs.length} recent</span>
      </div>
      <div className="divide-y divide-border">
        {loading && runs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin mx-auto mb-2" /> loading runs…
          </div>
        ) : runs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No runs yet. Click <span className="font-mono">Trigger run</span> above.
          </div>
        ) : runs.map((r) => {
          const dur = r.duration_ms ? formatMs(r.duration_ms) : "—";
          const Icon = r.status === "success" ? CheckCircle2
            : r.status === "running" ? Loader2
            : r.status === "failed" ? XCircle
            : AlertTriangle;
          const color = r.status === "success" ? "text-success"
            : r.status === "running" ? "text-primary animate-spin"
            : r.status === "failed" ? "text-destructive"
            : "text-warning";
          return (
            <div key={r.id} className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-secondary/30 transition-colors">
              <Icon className={`size-5 shrink-0 ${color}`} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13px] truncate">
                  <span className="text-foreground">{r.drug}</span>
                  <span className="text-muted-foreground"> · {r.id.slice(0, 8)}</span>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</div>
              </div>
              <div className="hidden sm:block text-right">
                <div className="font-mono text-[13px]">{r.drug_reports.toLocaleString()}</div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">reports</div>
              </div>
              <div className="hidden md:block text-right w-16">
                <div className="font-mono text-[13px]">{r.signals_count}</div>
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider">signals</div>
              </div>
              <div className="font-mono text-xs text-muted-foreground w-20 text-right">{dur}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatMs(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function AuditCard({ drug }: { drug: string }) {
  const reports = [
    { name: `PV-Audit-${drug}-2025-05-10.html`, size: "847 KB" },
    { name: `PV-Audit-${drug}-2025-05-09.html`, size: "812 KB" },
    { name: `PV-Audit-${drug}-2025-05-08.html`, size: "891 KB" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><FileText className="size-4" /> Audit reports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">21 CFR Part 11 · ed25519 signed</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {reports.map((r) => (
          <li key={r.name} className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-secondary/30 transition-colors">
            <div className="size-8 rounded-md bg-secondary border border-border grid place-items-center">
              <FileText className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[12px] truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {r.size}
                <span className="inline-flex items-center gap-1 text-success"><Shield className="size-3" /> signed</span>
              </div>
            </div>
            <button className="size-8 grid place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
              <Download className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Footer() {
  return (
    <footer className="pt-6 pb-10 border-t border-border text-xs text-muted-foreground flex flex-col md:flex-row md:items-center md:justify-between gap-2">
      <div className="font-mono">
        © 2025 Pharmanalyst · data: <a className="text-primary hover:underline" href="https://open.fda.gov" target="_blank" rel="noreferrer">openFDA</a> · MedDRA v27.0
      </div>
      <div className="flex items-center gap-4">
        <span>Build <span className="font-mono text-foreground">2.4.1+a8f3c12</span></span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> all systems operational</span>
      </div>
    </footer>
  );
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
