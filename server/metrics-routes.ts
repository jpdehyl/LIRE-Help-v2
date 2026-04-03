import { Router } from "express";
import { requireAdmin } from "./middleware/auth.js";
import { db } from "./db.js";
import { tokenUsage } from "../shared/schema.js";
import { platformSessions } from "../shared/schema.js";
import { tenants } from "../shared/schema.js";
import { gte } from "drizzle-orm";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const days = req.query.days === "30" ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch raw data using Drizzle (proven pattern from capitan-dd)
    const [sessions, tokenRows, tenantList] = await Promise.all([
      db.select().from(platformSessions).where(gte(platformSessions.createdAt, since)),
      db.select().from(tokenUsage).where(gte(tokenUsage.createdAt, since)).catch(() => [] as any[]),
      db.select().from(tenants),
    ]);

    // Conversation stats (JS aggregation)
    const total = sessions.length;
    const leads = sessions.filter((s: any) => s.isLead).length;
    const escalated = sessions.filter((s: any) => s.escalatedToWa).length;
    const totalMsgs = sessions.reduce((acc: number, s: any) => acc + (s.messageCount || 0), 0);
    const avgMessages = total > 0 ? +(totalMsgs / total).toFixed(1) : 0;
    const escalationRate = total > 0 ? +(escalated / total).toFixed(2) : 0;

    // Daily conversation trend
    const dailyMap: Record<string, number> = {};
    for (const s of sessions) {
      const dateKey = new Date(s.createdAt).toISOString().slice(0, 10);
      dailyMap[dateKey] = (dailyMap[dateKey] ?? 0) + 1;
    }
    const now = Date.now();
    const dailyTrend: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      dailyTrend.push({ date: d, count: dailyMap[d] ?? 0 });
    }

    // Token stats (JS aggregation — same pattern as capitan-dd)
    const grandTotal = { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };
    const byModel: Record<string, { input: number; output: number; cost: number; calls: number }> = {};
    const dailyCostMap: Record<string, number> = {};

    for (const row of tokenRows) {
      const cost = parseFloat(row.costUsd || "0");
      grandTotal.inputTokens += row.inputTokens;
      grandTotal.outputTokens += row.outputTokens;
      grandTotal.costUsd += cost;
      grandTotal.calls += 1;

      const m = row.model;
      if (!byModel[m]) byModel[m] = { input: 0, output: 0, cost: 0, calls: 0 };
      byModel[m]!.input += row.inputTokens;
      byModel[m]!.output += row.outputTokens;
      byModel[m]!.cost += cost;
      byModel[m]!.calls += 1;

      const dateKey = new Date(row.createdAt).toISOString().slice(0, 10);
      dailyCostMap[dateKey] = (dailyCostMap[dateKey] ?? 0) + cost;
    }

    const dailyCost = Object.entries(dailyCostMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date, cost: cost.toFixed(2) }));

    const byModelArr = Object.entries(byModel).map(([model, d]) => ({
      model,
      input: d.input,
      output: d.output,
      cost: d.cost.toFixed(2),
    }));

    // Per-tenant (simplified — no join needed)
    const perTenant = tenantList.filter((t: any) => t.isActive).map((t: any) => ({
      tenantId: t.id,
      name: t.name,
      conversations: total, // all sessions are platform-level for now
      tokens: grandTotal.inputTokens + grandTotal.outputTokens,
      cost: grandTotal.costUsd.toFixed(2),
      escalationRate,
      monthlyBudgetUsd: null,
    }));

    // Projection
    const dailyAvg = days > 0 ? grandTotal.costUsd / days : 0;

    res.json({
      conversations: { total, leads, escalationRate, avgMessages, dailyTrend },
      tokens: {
        totalInput: grandTotal.inputTokens,
        totalOutput: grandTotal.outputTokens,
        totalCostUsd: grandTotal.costUsd.toFixed(2),
        byModel: byModelArr,
        dailyCost,
      },
      perTenant,
      projection: { monthlyEstimate: (dailyAvg * 30).toFixed(2) },
    });
  } catch (err) {
    console.error("[metrics] Error:", err);
    res.status(500).json({ message: "Error fetching metrics" });
  }
});

export default router;
