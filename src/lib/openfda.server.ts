import type { CountResponse, SearchMeta } from "./openfda";

const BASE = "https://api.fda.gov/drug/event.json";

// Use the normalized openFDA brand/generic fields (.exact). The raw
// `patient.drug.medicinalproduct` is a tokenized text field that frequently
// triggers `search_phase_execution_exception` on the openFDA backend.
function drugQuery(drug: string) {
  const d = drug.toUpperCase().replace(/"/g, "");
  return `(patient.drug.openfda.brand_name.exact:"${d}" OR patient.drug.openfda.generic_name.exact:"${d}")`;
}

function withApiKey(url: string) {
  const apiKey = process.env.OPENFDA_API_KEY;
  if (!apiKey) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}api_key=${encodeURIComponent(apiKey)}`;
}

async function getJson<T>(url: string): Promise<T> {
  const finalUrl = withApiKey(url);
  let lastError: unknown = null;

  // openFDA frequently returns transient 5xx (search_phase_execution_exception,
  // rejected_execution_exception). Retry with exponential backoff.
  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(finalUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Pharmanalyst/1.0 (pharmacovigilance pipeline)",
          Accept: "application/json",
        },
      });

      if (res.ok) return (await res.json()) as T;

      if (res.status === 404) {
        return { meta: { results: { total: 0, skip: 0, limit: 0 } }, results: [] } as unknown as T;
      }

      const body = await res.text().catch(() => "");
      if (res.status === 403 && body.includes("API_KEY_MISSING")) {
        throw new Error("openFDA needs an OPENFDA_API_KEY secret to be configured.");
      }

      // Retry on transient server-side and rate-limit errors
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`openFDA ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
      } else {
        throw new Error(`openFDA ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new Error("openFDA request timed out after 25 seconds.");
      } else {
        lastError = error;
      }
    } finally {
      clearTimeout(timeout);
    }

    // backoff: 400ms, 900ms, 1900ms
    await new Promise((r) => setTimeout(r, 400 + attempt * 500 + Math.random() * 200));
  }

  throw lastError instanceof Error ? lastError : new Error("openFDA request failed after retries");
}

export function fetchTopReactionsForDrug(drug: string, limit = 15) {
  const q = encodeURIComponent(drugQuery(drug));
  return getJson<CountResponse>(
    `${BASE}?search=${q}&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`,
  );
}

export function fetchGlobalReactionCounts(limit = 1000) {
  return getJson<CountResponse>(
    `${BASE}?count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`,
  );
}

export async function fetchDrugReportTotal(drug: string): Promise<number> {
  const q = encodeURIComponent(drugQuery(drug));
  const r = await getJson<SearchMeta>(`${BASE}?search=${q}&limit=1`);
  return r.meta.results.total;
}

export async function fetchTotalReports(): Promise<number> {
  const r = await getJson<SearchMeta>(`${BASE}?search=_exists_:patient&limit=1`);
  return r.meta.results.total;
}