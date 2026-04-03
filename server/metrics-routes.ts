import { Router } from "express";
import { requireAdmin } from "./middleware/auth.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const days = req.query.days === "30" ? 30 : 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const [convStats, tokenStats, dailyConvos, dailyCosts, modelBreakdown, tenantMetrics] = await Promise.all([
      // 1. Conversation aggregates
      db.execute(sql`
        SELECT
          COUNT(*)::int as total,
          SUM(CASE WHEN is_lead THEN 1 ELSE 0 END)::int as leads,
          SUM(CASE WHEN escalated_to_wa THEN 1 ELSE 0 END)::int as escalated,
          COALESCE(AVG(message_count), 0)::float as avg_messages
        FROM platform_sessions
        WHERE created_at >= ${cutoffStr}::timestamp
      `),

      // 2. Token aggregates
      db.execute(sql`
        SELECT
          COALESCE(SUM(input_tokens), 0)::int as total_input,
          COALESCE(SUM(output_tokens), 0)::int as total_output,
          COALESCE(SUM(cost_usd::numeric), 0)::text as total_cost
        FROM token_usage
        WHERE created_at >= ${cutoffStr}::timestamp
      `),

      // 3. Daily conversation trend
      db.execute(sql`
        SELECT DATE(created_at)::text as date, COUNT(*)::int as count
        FROM platform_sessions
        WHERE created_at >= ${cutoffStr}::timestamp
        GROUP BY DATE(created_at)
        ORDER BY date
      `),

      // 4. Daily cost trend
      db.execute(sql`
        SELECT DATE(created_at)::text as date, COALESCE(SUM(cost_usd::numeric), 0)::text as cost
        FROM token_usage
        WHERE created_at >= ${cutoffStr}::timestamp
        GROUP BY DATE(created_at)
        ORDER BY date
      `),

      // 5. By model breakdown
      db.execute(sql`
        SELECT model,
          COALESCE(SUM(input_tokens), 0)::int as input,
          COALESCE(SUM(output_tokens), 0)::int as output,
          COALESCE(SUM(cost_usd::numeric), 0)::text as cost
        FROM token_usage
        WHERE created_at >= ${cutoffStr}::timestamp
        GROUP BY model
      `),

      // 6. Per-tenant metrics
      db.execute(sql`
        SELECT
          t.id as tenant_id, t.name,
          COALESCE(tk.tokens, 0)::int as tokens,
          COALESCE(tk.cost, '0') as cost,
          COALESCE(ps.convos, 0)::int as conversations,
          COALESCE(ps.escalation_rate, 0)::float as escalation_rate
        FROM tenants t
        LEFT JOIN (
          SELECT tenant_id,
            SUM(input_tokens + output_tokens) as tokens,
            SUM(cost_usd::numeric)::text as cost
          FROM token_usage
          WHERE created_at >= ${cutoffStr}::timestamp
          GROUP BY tenant_id
        ) tk ON tk.tenant_id = t.id
        LEFT JOIN (
          SELECT
            COUNT(*) as convos,
            CASE WHEN COUNT(*) > 0
              THEN SUM(CASE WHEN escalated_to_wa THEN 1 ELSE 0 END)::float / COUNT(*)
              ELSE 0
            END as escalation_rate
          FROM platform_sessions
          WHERE created_at >= ${cutoffStr}::timestamp
        ) ps ON true
        WHERE t.is_active = true
      `),
    ]);

    // Parse results
    const conv = (convStats.rows?.[0] ?? convStats[0] ?? {}) as any;
    const tok = (tokenStats.rows?.[0] ?? tokenStats[0] ?? {}) as any;

    const totalCost = parseFloat(tok.total_cost || "0");
    const dailyAvg = days > 0 ? totalCost / days : 0;

    res.json({
      conversations: {
        total: conv.total || 0,
        leads: conv.leads || 0,
        escalationRate: conv.total > 0 ? (conv.escalated || 0) / conv.total : 0,
        avgMessages: parseFloat((conv.avg_messages || 0).toFixed(1)),
        dailyTrend: (dailyConvos.rows ?? dailyConvos ?? []).map((r: any) => ({ date: r.date, count: r.count })),
      },
      tokens: {
        totalInput: tok.total_input || 0,
        totalOutput: tok.total_output || 0,
        totalCostUsd: totalCost.toFixed(2),
        byModel: (modelBreakdown.rows ?? modelBreakdown ?? []).map((r: any) => ({
          model: r.model,
          input: r.input,
          output: r.output,
          cost: parseFloat(r.cost || "0").toFixed(2),
        })),
        dailyCost: (dailyCosts.rows ?? dailyCosts ?? []).map((r: any) => ({ date: r.date, cost: parseFloat(r.cost || "0").toFixed(2) })),
      },
      perTenant: (tenantMetrics.rows ?? tenantMetrics ?? []).map((r: any) => ({
        tenantId: r.tenant_id,
        name: r.name,
        conversations: r.conversations,
        tokens: r.tokens,
        cost: parseFloat(r.cost || "0").toFixed(2),
        escalationRate: parseFloat((r.escalation_rate || 0).toFixed(2)),
        monthlyBudgetUsd: null,
      })),
      projection: {
        monthlyEstimate: (dailyAvg * 30).toFixed(2),
      },
    });
  } catch (err) {
    console.error("[metrics] Error:", err);
    res.status(500).json({ message: "Error fetching metrics" });
  }
});

export default router;
