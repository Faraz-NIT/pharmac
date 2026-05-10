import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchDrugReportTotal, fetchGlobalReactionCounts,
  fetchTopReactionsForDrug, fetchTotalReports,
} from "./openfda.server";
import {
  computeSignals,
} from "./openfda";

export const runPipeline = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ drug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const drug = data.drug.toUpperCase();
    const started = Date.now();

    // 1) Create run row (status=running)
    const { data: run, error: runErr } = await supabaseAdmin
      .from("pipeline_runs")
      .insert({ drug, status: "running" })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(runErr?.message ?? "could not create run");

    try {
      // 2) Fetch openFDA in parallel
      const [top, background, drugTotal, grandTotal] = await Promise.all([
        fetchTopReactionsForDrug(drug, 25),
        fetchGlobalReactionCounts(1000),
        fetchDrugReportTotal(drug),
        fetchTotalReports(),
      ]);

      // 3) Compute signals
      const signals = computeSignals(
        top.results ?? [],
        background.results ?? [],
        drugTotal,
        grandTotal,
      );

      // 4) Persist signals
      if (signals.length > 0) {
        const rows = signals.map((s) => ({
          run_id: run.id,
          drug,
          reaction: s.reaction,
          a: s.a, b: s.b, c: s.c, d: s.d,
          prr: s.prr, prr_low: s.prrLow, prr_high: s.prrHigh,
          ror: s.ror, ror_low: s.rorLow, ror_high: s.rorHigh,
          chi_sq: s.chiSq,
          level: s.level,
        }));
        const { error: insErr } = await supabaseAdmin.from("signals").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      // 5) Finalise run
      await supabaseAdmin
        .from("pipeline_runs")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - started,
          reports_total: grandTotal,
          drug_reports: drugTotal,
          signals_count: signals.length,
        })
        .eq("id", run.id);

      return { run_id: run.id, signals: signals.length, drug_reports: drugTotal };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      await supabaseAdmin
        .from("pipeline_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - started,
          error: msg,
        })
        .eq("id", run.id);
      throw new Error(msg);
    }
  });