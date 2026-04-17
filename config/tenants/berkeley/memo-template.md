# Credit Memo Template — Berkeley Partners (standard v1)

<!--
  This is the canonical memo format for Pilot B. Claude drafts into this
  structure. Every value enclosed in {{braces}} is a placeholder filled from
  the checklist run. Every numeric value in the final memo must carry a
  citation: [¶{doc_id}:p{page}].

  STATUS: placeholder. Replace with Berkeley's actual memo format once the
  credit team sends an anonymized example.
-->

**Lessee:** {{lessee_legal_name}}
**Reporting Period:** {{period_start}} – {{period_end}}
**Rubric Version:** {{rubric_version}}
**Prepared:** {{prepared_at}}
**Analyst:** {{analyst_name}}
**Status:** {{status}}

---

## 1. Executive Summary

{{executive_summary_narrative}}

**Overall Rating:** {{overall_rating}}
**Red Flags:** {{red_flag_count}}
**Yellow Flags:** {{yellow_flag_count}}

---

## 2. Financial Snapshot

| Metric | Current | Prior | Δ | Citation |
|---|---|---|---|---|
| Revenue | {{revenue_current}} | {{revenue_prior}} | {{revenue_delta}} | {{revenue_citation}} |
| EBITDA | {{ebitda_current}} | {{ebitda_prior}} | {{ebitda_delta}} | {{ebitda_citation}} |
| EBITDA Margin | {{ebitda_margin_current}} | {{ebitda_margin_prior}} | {{ebitda_margin_delta}} | {{ebitda_margin_citation}} |
| Current Ratio | {{current_ratio_current}} | {{current_ratio_prior}} | — | {{current_ratio_citation}} |
| DSCR | {{dscr_current}} | {{dscr_prior}} | — | {{dscr_citation}} |
| Cash on Hand (months) | {{cash_months_current}} | {{cash_months_prior}} | — | {{cash_months_citation}} |

---

## 3. Flagged Items

{{#each flags}}
### {{rule_id}} — {{severity}}

**What the rule checks:** {{description}}
**Observed:** {{observed_value}} ({{citation}})
**Threshold:** {{threshold}}
**Reasoning:** {{reasoning}}

{{/each}}

---

## 4. Qualitative Notes

{{qualitative_notes_narrative}}

---

## 5. Recommendation

> **Default:** "Analyst review required." The AI does not make the credit decision. This section is populated by the analyst.

{{analyst_recommendation}}

---

## 6. Source Documents

{{#each documents}}
- `{{classification}}` — {{filename}} ({{page_count}} pages) — SHA256: {{sha256}}
{{/each}}

---

*All values in this memo trace to the source documents listed above. Memo draft, analyst edits, and approval chain are recorded in the archive log for this lessee and checklist run.*
