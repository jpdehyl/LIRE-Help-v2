// Evaluates a set of extractions against a Berkeley-style checklist rubric.
// Pure logic — no DB, no Claude. Fed by the routes layer.
//
// Threshold syntax supported:
//   "< 1.1", "<= -0.20", ">= 0.08", "> -0.05"  — numeric comparisons
//   "expired" | "expires_within_30_days" | "valid"  — date status (for COI-style checks)
//
// Unknown thresholds fall through to "unknown" and are surfaced in reasoning so
// the analyst can intervene.

export type RubricRule = {
  id: string;
  category: string;
  description: string;
  required_inputs: string[];
  thresholds: {
    red?: string;
    yellow?: string;
    green?: string;
  };
};

export type Rubric = {
  version: string;
  rules: RubricRule[];
  required_documents?: string[];
};

export type ExtractedValue = {
  line_item: string;
  value: string | null;
  unit: string | null;
  page?: number | null;
  raw_text?: string;
  confidence?: number;
  document_id?: string;
};

export type RuleResult = {
  rule_id: string;
  category: string;
  severity: "green" | "yellow" | "red" | "unknown";
  observed: number | string | null;
  threshold: string | null;
  reasoning: string;
  citations: string[];
};

export type ChecklistEvaluation = {
  rubric_version: string;
  results: RuleResult[];
  red_flag_count: number;
  yellow_flag_count: number;
  missing_inputs: Array<{ rule_id: string; missing: string[] }>;
};

function toNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[$,%]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function evalNumericThreshold(op: string, value: number): boolean {
  const m = op.trim().match(/^(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return false;
  const operator = m[1]!;
  const rhs = Number(m[2]!);
  switch (operator) {
    case "<": return value < rhs;
    case "<=": return value <= rhs;
    case ">": return value > rhs;
    case ">=": return value >= rhs;
    default: return false;
  }
}

function evalDateStatus(op: string, isoDate: string | null): boolean {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const msIn30d = 30 * 24 * 60 * 60 * 1000;
  if (op === "expired") return date.getTime() < now.getTime();
  if (op === "expires_within_30_days") {
    const delta = date.getTime() - now.getTime();
    return delta >= 0 && delta <= msIn30d;
  }
  if (op === "valid") return date.getTime() > now.getTime() + msIn30d;
  return false;
}

function citationFor(e: ExtractedValue): string {
  const doc = e.document_id ?? "doc";
  const page = e.page ?? "?";
  return `[¶${doc}:p${page}]`;
}

function firstAvailable(extractions: ExtractedValue[], keys: string[]): ExtractedValue | null {
  for (const k of keys) {
    const hit = extractions.find((e) => e.line_item === k);
    if (hit) return hit;
  }
  return null;
}

function evalRule(rule: RubricRule, extractions: ExtractedValue[]): RuleResult {
  const inputs = rule.required_inputs.map((key) => ({ key, hit: extractions.find((e) => e.line_item === key) ?? null }));
  const missing = inputs.filter((i) => !i.hit || i.hit.value == null).map((i) => i.key);

  if (missing.length > 0) {
    return {
      rule_id: rule.id,
      category: rule.category,
      severity: "unknown",
      observed: null,
      threshold: null,
      reasoning: `Missing input(s): ${missing.join(", ")}`,
      citations: [],
    };
  }

  // Compute observed value. Conventions by rule id — keep this short and readable.
  let observed: number | string | null = null;
  const citations: string[] = inputs.filter((i) => i.hit).map((i) => citationFor(i.hit!));

  switch (rule.id) {
    case "revenue_trend": {
      const cur = toNumber(firstAvailable(extractions, ["revenue_current_year"])?.value ?? null);
      const prior = toNumber(firstAvailable(extractions, ["revenue_prior_year"])?.value ?? null);
      if (cur == null || prior == null || prior === 0) { observed = null; break; }
      observed = (cur - prior) / prior;
      break;
    }
    case "ebitda_margin": {
      const ebitda = toNumber(firstAvailable(extractions, ["ebitda_current"])?.value ?? null);
      const rev = toNumber(firstAvailable(extractions, ["revenue_current_year"])?.value ?? null);
      if (ebitda == null || rev == null || rev === 0) { observed = null; break; }
      observed = ebitda / rev;
      break;
    }
    case "current_ratio": {
      const a = toNumber(firstAvailable(extractions, ["current_assets"])?.value ?? null);
      const l = toNumber(firstAvailable(extractions, ["current_liabilities"])?.value ?? null);
      if (a == null || l == null || l === 0) { observed = null; break; }
      observed = a / l;
      break;
    }
    case "dscr": {
      const ebitda = toNumber(firstAvailable(extractions, ["ebitda_current"])?.value ?? null);
      const ds = toNumber(firstAvailable(extractions, ["annual_debt_service"])?.value ?? null);
      if (ebitda == null || ds == null || ds === 0) { observed = null; break; }
      observed = ebitda / ds;
      break;
    }
    case "cash_on_hand_months": {
      const cash = toNumber(firstAvailable(extractions, ["cash_equivalents"])?.value ?? null);
      const opex = toNumber(firstAvailable(extractions, ["monthly_opex"])?.value ?? null);
      if (cash == null || opex == null || opex === 0) { observed = null; break; }
      observed = cash / opex;
      break;
    }
    case "concentration_risk": {
      observed = toNumber(firstAvailable(extractions, ["top_customer_revenue_pct"])?.value ?? null);
      break;
    }
    case "insurance_coi_current": {
      observed = firstAvailable(extractions, ["coi_expiry_date"])?.value ?? null;
      break;
    }
    default: {
      const first = firstAvailable(extractions, rule.required_inputs);
      observed = toNumber(first?.value ?? null);
    }
  }

  if (observed === null) {
    return {
      rule_id: rule.id,
      category: rule.category,
      severity: "unknown",
      observed: null,
      threshold: null,
      reasoning: "Could not compute observed value from extractions",
      citations,
    };
  }

  const isDateRule = rule.id === "insurance_coi_current";
  const thresholds = rule.thresholds;
  const order: Array<"red" | "yellow" | "green"> = ["red", "yellow", "green"];
  let severity: RuleResult["severity"] = "unknown";
  let matchedThreshold: string | null = null;

  for (const tier of order) {
    const op = thresholds[tier];
    if (!op) continue;
    const matched = isDateRule
      ? evalDateStatus(op, typeof observed === "string" ? observed : null)
      : typeof observed === "number" && evalNumericThreshold(op, observed);
    if (matched) {
      severity = tier;
      matchedThreshold = `${tier}: ${op}`;
      break;
    }
  }

  return {
    rule_id: rule.id,
    category: rule.category,
    severity,
    observed,
    threshold: matchedThreshold,
    reasoning: severity === "unknown"
      ? "Observed value did not match any defined threshold"
      : `Matched ${severity} threshold (${matchedThreshold})`,
    citations,
  };
}

export function evaluateChecklist(rubric: Rubric, extractions: ExtractedValue[]): ChecklistEvaluation {
  const results = rubric.rules.map((rule) => evalRule(rule, extractions));
  return {
    rubric_version: rubric.version,
    results,
    red_flag_count: results.filter((r) => r.severity === "red").length,
    yellow_flag_count: results.filter((r) => r.severity === "yellow").length,
    missing_inputs: results
      .filter((r) => r.severity === "unknown")
      .map((r) => ({
        rule_id: r.rule_id,
        missing: (rubric.rules.find((rule) => rule.id === r.rule_id)?.required_inputs ?? []).filter(
          (k) => !extractions.find((e) => e.line_item === k && e.value != null),
        ),
      })),
  };
}
