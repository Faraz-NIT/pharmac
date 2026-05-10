import { motion } from "framer-motion";
import { Cloud, Database, Filter, FlaskConical, FileCheck, Calculator } from "lucide-react";

const STAGES = [
  { key: "extract",   name: "Extract",   sub: "openFDA REST",       icon: Cloud },
  { key: "validate",  name: "Validate",  sub: "JSON Schema · MedDRA", icon: Filter },
  { key: "load",      name: "Load",      sub: "Postgres COPY",       icon: Database },
  { key: "transform", name: "Transform", sub: "Contingency cube",    icon: FlaskConical },
  { key: "detect",    name: "Detect",    sub: "PRR · ROR · χ²",      icon: Calculator },
  { key: "report",    name: "Report",    sub: "HTML · ed25519",      icon: FileCheck },
];

export function AnimatedPipeline({ active = true }: { active?: boolean }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold">Pipeline · live</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            DAG <span className="text-foreground">pv_etl</span> · streaming openFDA → Postgres → audit
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          {active ? "executing" : "idle"}
        </div>
      </div>

      <div className="relative">
        {/* connector line */}
        <div className="absolute top-7 left-7 right-7 h-px bg-border" />
        <div
          className="absolute top-[27px] left-7 right-7 h-0.5 overflow-hidden rounded-full"
          style={{ background: "transparent" }}
        >
          <motion.div
            className="h-full w-1/3 rounded-full"
            style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
            animate={{ x: ["-30%", "330%"] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: "linear" }}
          />
        </div>

        {/* flowing data packets */}
        {active && [0, 0.6, 1.2, 1.8].map((delay) => (
          <motion.div
            key={delay}
            className="absolute top-[24px] size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]"
            style={{ left: "1.75rem" }}
            initial={{ x: 0, opacity: 0 }}
            animate={{
              x: ["0%", "calc(100vw - 8rem)"],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ repeat: Infinity, duration: 4, delay, ease: "linear" }}
          />
        ))}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 relative">
          {STAGES.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative"
            >
              <div className="flex flex-col items-center text-center gap-2">
                <motion.div
                  className="relative size-14 grid place-items-center rounded-xl border border-border bg-secondary/60 backdrop-blur"
                  animate={active ? {
                    boxShadow: [
                      "0 0 0 0 oklch(0.78 0.16 165 / 0)",
                      "0 0 24px 4px oklch(0.78 0.16 165 / 0.25)",
                      "0 0 0 0 oklch(0.78 0.16 165 / 0)",
                    ],
                  } : {}}
                  transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.4 }}
                >
                  <s.icon className="size-5 text-primary" />
                  <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-background border border-border grid place-items-center text-[10px] font-mono text-muted-foreground">
                    {i + 1}
                  </span>
                </motion.div>
                <div className="text-xs font-medium tracking-wide">{s.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground leading-tight">{s.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* throughput bars */}
      <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
        <ThroughputStat label="Throughput" value="2.4k rec/s" />
        <ThroughputStat label="Lag" value="142 ms" />
        <ThroughputStat label="Errors" value="0.00%" tone="ok" />
      </div>
    </div>
  );
}

function ThroughputStat({ label, value, tone }: { label: string; value: string; tone?: "ok" }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono ${tone === "ok" ? "text-success" : "text-foreground"}`}>{value}</div>
    </div>
  );
}