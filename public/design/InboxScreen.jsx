// LIRE Help — Inbox screen (3-pane: views / list / detail)

const { useState: useStateI, useMemo: useMemoI, useEffect: useEffectI, useRef: useRefI } = React;

// ----- Small helpers -----
const PRI = {
  urgent: { tone: "error",   label: "URGENT" },
  high:   { tone: "warning", label: "HIGH" },
  medium: { tone: "muted",   label: "MEDIUM" },
  low:    { tone: "muted",   label: "LOW" },
};
const SLA = {
  at_risk:  { tone: "warning", label: "SLA AT RISK" },
  breached: { tone: "error",   label: "SLA BREACHED" },
  healthy:  { tone: "muted",   label: "ON TRACK" },
};
const CHAN = {
  email:     { icon: Icon.Mail,      label: "Email" },
  sms:       { icon: Icon.Phone,     label: "SMS" },
  whatsapp:  { icon: Icon.Msg,       label: "WhatsApp" },
  messenger: { icon: Icon.MsgSquare, label: "Messenger" },
  slack:     { icon: Icon.Hash,      label: "Slack" },
  zoom:      { icon: Icon.Video,     label: "Zoom" },
  web:       { icon: Icon.MsgSquare, label: "Web" },
};

function ViewSection({ title, items, active, onPick, variant = "default" }) {
  return (
    <div style={{ padding: "8px 10px 0" }}>
      <Eyebrow style={{ padding: "0 8px 6px", color: "var(--fg-subtle)" }}>{title}</Eyebrow>
      {items.map(v => {
        const isActive = active === v.key;
        const Ch = variant === "channels" && v.channel ? (CHAN[v.channel] || {}) : null;
        const ChIcon = Ch && Ch.icon;
        return (
          <button key={v.key} onClick={() => onPick(v.key)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "7px 8px", border: 0, borderRadius: 3, cursor: "pointer",
              background: isActive ? "var(--surface-2)" : "transparent",
              color: v.offline ? "var(--fg-subtle)" : "var(--fg)", textAlign: "left",
              fontFamily: "var(--font-body)", fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 120ms var(--ease)",
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-2)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
          >
            {ChIcon && (
              <span style={{ color: v.offline ? "var(--fg-subtle)" : "var(--fg-muted)", display: "inline-flex" }}>
                <ChIcon size={14}/>
              </span>
            )}
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.label}</span>
            {variant === "channels" && (
              <StatusDot tone={v.offline ? "muted" : "success"} size={6}/>
            )}
            {v.count > 0 && <Num size={11} color="var(--fg-muted)">{v.count}</Num>}
          </button>
        );
      })}
    </div>
  );
}

function ViewsPane({ views, active, onPick, density, collapsed, onToggleCollapsed }) {
  const byS = { default: [], channels: [], teams: [], saved: [] };
  views.forEach(v => { if (byS[v.section]) byS[v.section].push(v); });
  if (collapsed) {
    // Icon-only strip
    const primary = [
      { key: "priority",   icon: <Icon.Flag size={16}/>,   label: "Priority" },
      { key: "all",        icon: <Icon.Inbox size={16}/>,  label: "All open" },
      { key: "ch-email",   icon: <Icon.Mail size={16}/>,   label: "Email" },
      { key: "ch-whatsapp",icon: <Icon.Msg size={16}/>,    label: "WhatsApp" },
      { key: "ch-sms",     icon: <Icon.Phone size={16}/>,  label: "SMS" },
      { key: "ch-zoom",    icon: <Icon.Video size={16}/>,  label: "Zoom" },
    ];
    return (
      <div style={{
        width: 48, flexShrink: 0, borderRight: "1px solid var(--border)",
        background: "var(--surface)", display: "flex", flexDirection: "column",
      }}>
        <button onClick={onToggleCollapsed} title="Expand views"
          style={{ width: 48, height: 48, border: 0, background: "transparent", cursor: "pointer", color: "var(--fg-muted)",
                   borderBottom: "1px solid var(--border)" }}>
          <Icon.PanelLeft size={16}/>
        </button>
        {primary.map(p => {
          const isActive = active === p.key;
          return (
            <button key={p.key} onClick={() => onPick(p.key)} title={p.label}
              style={{
                width: 48, height: 44, border: 0, cursor: "pointer",
                background: isActive ? "var(--surface-2)" : "transparent",
                color: isActive ? "var(--fg)" : "var(--fg-muted)",
                borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = "var(--fg)"; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "var(--fg-muted)"; } }}
            >{p.icon}</button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{
      width: 224, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "var(--surface)", overflow: "auto",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Eyebrow>Views</Eyebrow>
          <div style={{ marginTop: 6, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg)" }}>
            Inbox
          </div>
        </div>
        <Btn size="icon" variant="ghost" title="Collapse views" onClick={onToggleCollapsed} icon={<Icon.PanelLeft size={14}/>}/>
      </div>
      <ViewSection title="Default"  items={byS.default}  active={active} onPick={onPick}/>
      <ViewSection title="Channels" items={byS.channels} active={active} onPick={onPick} variant="channels"/>
      <ViewSection title="Teams"    items={byS.teams}    active={active} onPick={onPick}/>
      <ViewSection title="Saved"    items={byS.saved}    active={active} onPick={onPick}/>

      <div style={{ flex: 1 }}/>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <Eyebrow style={{ fontSize: 10, color: "var(--fg-subtle)" }}>24h autonomy</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <Num size={22} weight={500} color="var(--fg)">82</Num>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--fg-muted)" }}>% resolved without human</span>
        </div>
      </div>
    </div>
  );
}

function ListRow({ t, property, selected, onSelect, density }) {
  const pad = density === "compact" ? "10px 14px" : "12px 14px";
  const Ch = CHAN[t.channel] || CHAN.email;
  return (
    <button onClick={() => onSelect(t.id)}
      style={{
        width: "100%", display: "block", textAlign: "left",
        padding: pad, border: 0, borderBottom: "1px solid var(--border)",
        background: selected ? "var(--surface-2)" : "var(--surface)",
        cursor: "pointer", position: "relative",
        transition: "background 120ms var(--ease)",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--surface-2)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "var(--surface)"; }}
    >
      {selected && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--accent)" }}/>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {t.unread && <StatusDot tone="accent" size={6}/>}
        <Num size={11} color="var(--fg-subtle)" style={{ letterSpacing: "0.02em" }}>{t.id}</Num>
        <span style={{ color: "var(--fg-subtle)" }}><Ch.icon size={12}/></span>
        <span style={{ flex: 1 }}/>
        <Num size={11} color="var(--fg-muted)">{t.lastActivity}</Num>
      </div>
      <div style={{
        fontFamily: "var(--font-body)", fontSize: 13,
        fontWeight: t.unread ? 600 : 500, color: "var(--fg)",
        lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{t.subject}</div>
      <div style={{
        marginTop: 4, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)",
        display: "-webkit-box", WebkitLineClamp: density === "compact" ? 1 : 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", lineHeight: 1.45,
      }}>{t.preview}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Chip tone={PRI[t.priority].tone} size="sm">{PRI[t.priority].label}</Chip>
        {t.sla.state !== "healthy" && <Chip tone={SLA[t.sla.state].tone} size="sm">{t.sla.label}</Chip>}
        {t.assigneeKind === "ai" && <Chip tone="ai" size="sm" dot={false}>AI · {t.assignee === "AI Concierge" ? "HANDLING" : t.assignee}</Chip>}
        <span style={{ flex: 1 }}/>
        <Num size={10} color="var(--fg-subtle)">{property?.code || ""}</Num>
      </div>
    </button>
  );
}

function ListPane({ tickets, properties, selectedId, onSelect, density, viewLabel }) {
  return (
    <div style={{
      width: 400, flexShrink: 0,
      borderRight: "1px solid var(--border)",
      background: "var(--surface)", display: "flex", flexDirection: "column",
      minWidth: 0,
    }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 8, background: "var(--surface)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>{viewLabel}</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
            <Num size={18} weight={500} color="var(--fg)">{tickets.length}</Num>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)" }}>open</span>
          </div>
        </div>
        <Btn size="sm" variant="ghost" icon={<Icon.Filter size={13}/>}>Filter</Btn>
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {tickets.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Nothing in this view.<br/><span style={{ color: "var(--fg-subtle)" }}>Try another filter.</span>
          </div>
        ) : tickets.map(t => (
          <ListRow key={t.id} t={t} property={properties.find(p => p.id === t.property)}
            selected={selectedId === t.id} onSelect={onSelect} density={density}/>
        ))}
      </div>
      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)",
                    background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 10 }}>
        <Kbd>J</Kbd><Kbd>K</Kbd>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--fg-muted)" }}>navigate</span>
        <span style={{ flex: 1 }}/>
        <Kbd>⌘K</Kbd>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--fg-muted)" }}>jump</span>
      </div>
    </div>
  );
}

// ---------- Timeline item ----------
function TimelineItem({ msg }) {
  const byKind = {
    customer: {
      bg: "var(--surface)", border: "1px solid var(--border)",
      eyebrow: "TENANT", eyebrowColor: "var(--fg-muted)", align: "left",
    },
    teammate: {
      bg: "var(--surface)", border: "1px solid var(--border)",
      eyebrow: "TEAMMATE", eyebrowColor: "var(--fg-muted)", align: "left",
    },
    ai: {
      bg: "rgba(17,17,17,0.03)", border: "1px solid var(--border)",
      eyebrow: "LIRE CONCIERGE", eyebrowColor: "var(--fg)", align: "left",
      leftBar: "var(--fg)",
    },
    system: {
      bg: "transparent", border: "1px dashed var(--border)",
      eyebrow: "SYSTEM", eyebrowColor: "var(--fg-subtle)", align: "left",
    },
    internal: {
      bg: "rgba(255,77,0,0.06)", border: "1px solid rgba(255,77,0,0.25)",
      eyebrow: "INTERNAL NOTE", eyebrowColor: "var(--accent-press)", align: "left",
    },
  }[msg.kind] || {};
  return (
    <article style={{
      background: byKind.bg, border: byKind.border, borderRadius: 4,
      padding: "12px 14px 12px 16px", position: "relative",
      borderLeft: byKind.leftBar ? `3px solid ${byKind.leftBar}` : byKind.border,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Eyebrow style={{ color: byKind.eyebrowColor, fontSize: 10 }}>{byKind.eyebrow}</Eyebrow>
        <span style={{ color: "var(--fg-subtle)", fontSize: 11 }}>·</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>
          {msg.who}
        </span>
        {msg.channel && (
          <>
            <span style={{ color: "var(--fg-subtle)", fontSize: 11 }}>·</span>
            <Num size={10} color="var(--fg-subtle)">{msg.channel}</Num>
          </>
        )}
        <span style={{ flex: 1 }}/>
        <Num size={10} color="var(--fg-subtle)">{msg.at}</Num>
      </div>
      <div style={{
        fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg)",
        whiteSpace: "pre-wrap",
      }}>{msg.body}</div>
      {msg.meta && (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <Icon.Sparkles size={12} color="var(--accent)"/>
          <Num size={10} color="var(--fg-muted)" style={{ letterSpacing: "0.02em" }}>{msg.meta}</Num>
        </div>
      )}
    </article>
  );
}

// ---------- Composer ----------
function Composer({ onSend }) {
  const [mode, setMode] = useStateI("reply");
  const [body, setBody] = useStateI("");
  const channel = "WhatsApp";
  const send = () => { if (body.trim()) { onSend(mode, body.trim(), channel); setBody(""); } };
  return (
    <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface)", padding: "12px 20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {[
          { k: "reply", label: "Reply", icon: <Icon.Reply size={13}/> },
          { k: "note",  label: "Internal note", icon: <Icon.FileText size={13}/> },
        ].map(m => (
          <Btn key={m.k} size="sm" variant={mode === m.k ? "dark" : "ghost"} icon={m.icon}
            onClick={() => setMode(m.k)}>
            {m.label}
          </Btn>
        ))}
        <span style={{ flex: 1 }}/>
        {mode === "reply" && (
          <>
            <Num size={11} color="var(--fg-subtle)">SENDING VIA</Num>
            <Chip tone="neutral" size="sm" dot={false}>{channel}</Chip>
          </>
        )}
      </div>
      <div style={{
        border: `1px solid ${mode === "note" ? "rgba(255,77,0,0.4)" : "var(--border)"}`,
        borderRadius: 4,
        background: mode === "note" ? "rgba(255,77,0,0.04)" : "var(--surface)",
      }}>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder={mode === "reply"
            ? "Reply to tenant. Keep it direct — they're on a jobsite."
            : "Note for teammates. Not sent to tenant."}
          style={{
            width: "100%", border: 0, outline: "none", background: "transparent", resize: "none",
            padding: "12px 14px", fontFamily: "var(--font-body)", fontSize: 13.5, lineHeight: 1.55,
            color: "var(--fg)", minHeight: 84,
          }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px 8px", borderTop: "1px solid var(--border)" }}>
          <Btn size="icon" variant="ghost" title="Attach" icon={<Icon.Paperclip size={14}/>}/>
          <Btn size="icon" variant="ghost" title="Tag" icon={<Icon.Tag size={14}/>}/>
          <span style={{ flex: 1 }}/>
          <Num size={10} color="var(--fg-subtle)">⌘↵</Num>
          <Btn size="sm" variant={mode === "note" ? "dark" : "primary"} icon={<Icon.Send size={12}/>}
            onClick={send} disabled={!body.trim()}>
            {mode === "reply" ? "Send reply" : "Add note"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ---------- Right rail tab button ----------
function RailTab({ icon, label, active, badge, onClick }) {
  return (
    <button onClick={onClick} title={label}
      style={{
        position: "relative",
        width: 48, height: 48, border: 0, cursor: "pointer",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        transition: "all 120ms var(--ease)",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--fg)"; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-muted)"; } }}
    >
      {icon}
      {badge && (
        <span style={{
          position: "absolute", top: 8, right: 8, minWidth: 6, height: 6,
          borderRadius: "50%", background: "var(--accent)",
        }}/>
      )}
    </button>
  );
}

// ---------- Detail pane (Option D: center is pure conversation; right rail hosts Reply, AI, Details, Tenant, Property) ----------
const FALLBACK_DRAFTS = {
  "LIRE-4184": {
    summary: "Confirm vendor ETA with tenant and post the 4:30 AM arrival window in the shared channel. Ready to draft.",
    draft: "Quick update — Sentinel tech Rafael is on the way, ETA 4:30 AM. We'll keep your SLA protected for the 5 AM inbound. I'll confirm the moment he's on site.",
  },
  "LIRE-4181": {
    summary: "Send final pricing confirmation with the ADA repaint scope attached. Draft is ready.",
    draft: "Maya — final pricing grid attached with the 3.2% escalation. ADA repaint is confirmed inside our CapEx scope, scheduled for the week of May 5. Good to sign Friday.",
  },
  _default: {
    summary: "Acknowledge and route to preferred vendor. Draft is ready.",
    draft: "Confirmed — routing to preferred vendor now. I'll follow up with ETA shortly.",
  },
};
const draftFor = (t) => (t && FALLBACK_DRAFTS[t.id]) || FALLBACK_DRAFTS._default;
const channelLabel = (c) => c ? c.charAt(0).toUpperCase() + c.slice(1) : "WhatsApp";

function DetailPane({ ticket, property, timeline, aiPanelVisible, onSend, onTriage, user }) {
  const scrollRef = useRefI(null);
  const [rail, setRail] = useStateI(() => localStorage.getItem("lire.rail") || "reply");
  useEffectI(() => { localStorage.setItem("lire.rail", rail || ""); }, [rail]);
  useEffectI(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timeline?.length]);

  const toggleTab = (k) => setRail(prev => prev === k ? null : k);

  // Live AI draft state (per ticket). Starts with the seeded fallback, can be regenerated from /api/chat.
  const [aiDraft,    setAiDraft]    = useStateI(() => draftFor(ticket).draft);
  const [aiSummary,  setAiSummary]  = useStateI(() => draftFor(ticket).summary);
  const [aiLoading,  setAiLoading]  = useStateI(false);
  const [aiError,    setAiError]    = useStateI(null);
  const [aiEscalate, setAiEscalate] = useStateI(false);
  const [aiLive,     setAiLive]     = useStateI(false);
  const activeTicketIdRef = useRefI(ticket?.id);

  useEffectI(() => {
    activeTicketIdRef.current = ticket?.id;
    const d = draftFor(ticket);
    setAiDraft(d.draft);
    setAiSummary(d.summary);
    setAiError(null);
    setAiEscalate(false);
    setAiLive(false);
    setAiLoading(false);
  }, [ticket?.id]);

  const regenerateDraft = async () => {
    if (!ticket || aiLoading) return;
    const requestTicketId = ticket.id;
    setAiLoading(true);
    setAiError(null);
    try {
      const tenant = ticket.requester?.name || "A tenant";
      const company = ticket.requester?.company ? ` from ${ticket.requester.company}` : "";
      const siteLabel = ticket.property ? ` at ${ticket.property}` : "";
      const ask = ticket.preview || ticket.subject || "requesting assistance";
      const userMsg = `I'm ${tenant}${company}${siteLabel}. ${ask}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMsg }],
          sessionId: `inbox-${requestTicketId}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (activeTicketIdRef.current !== requestTicketId) return;
      if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
      setAiDraft((data.response || "").trim() || aiDraft);
      setAiEscalate(!!data.escalate);
      setAiSummary(data.escalate
        ? "Concierge flagged this for human escalation. Review draft before sending."
        : "Drafted live from the platform knowledge base.");
      setAiLive(true);
    } catch (err) {
      if (activeTicketIdRef.current !== requestTicketId) return;
      setAiError(err && err.message ? err.message : "Draft request failed.");
    } finally {
      if (activeTicketIdRef.current === requestTicketId) setAiLoading(false);
    }
  };

  const useDraft = () => {
    if (!ticket || !aiDraft.trim()) return;
    onSend("reply", aiDraft.trim(), channelLabel(ticket.channel));
    setRail("reply");
  };

  if (!ticket) {
    return (
      <div style={{ flex: 1, display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <Icon.Inbox size={32} color="var(--fg-subtle)"/>
          <div style={{ marginTop: 10, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
            Select a conversation
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--fg-muted)" }}>
            Pick a ticket to see its timeline, ticket state, and next actions.
          </div>
        </div>
      </div>
    );
  }
  const Ch = CHAN[ticket.channel] || CHAN.email;
  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0, background: "var(--bg)" }}>
      {/* Center column — slim header + timeline only */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--surface)", borderRight: "1px solid var(--border)" }}>
        <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <Ch.icon size={14} color="var(--fg-muted)"/>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>
            {ticket.subject}
          </div>
          <Chip tone={PRI[ticket.priority].tone} size="sm">{PRI[ticket.priority].label}</Chip>
          {ticket.sla.state !== "healthy" && <Chip tone={SLA[ticket.sla.state].tone} size="sm">{SLA[ticket.sla.state].label}</Chip>}
          <Num size={11} color="var(--fg-subtle)">{ticket.id}</Num>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {timeline.map(m => <TimelineItem key={m.id} msg={m}/>)}
        </div>
      </div>

      {/* Right rail */}
      <div style={{ display: "flex", flexShrink: 0, background: "var(--bg)", minHeight: 0 }}>
        {rail && (
          <aside style={{
            width: rail === "reply" ? 420 : 320, flexShrink: 0,
            background: "var(--surface)", borderLeft: "1px solid var(--border)",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Eyebrow>
                {rail === "reply" ? "Reply"
                 : rail === "ai" ? "AI Concierge"
                 : rail === "details" ? "Ticket details"
                 : rail === "tenant" ? "Tenant"
                 : "Property"}
              </Eyebrow>
              <span style={{ flex: 1 }}/>
              <Btn size="icon" variant="ghost" title="Collapse" onClick={() => setRail(null)} icon={<Icon.X size={14}/>}/>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: rail === "reply" ? 0 : 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {rail === "reply" && <Composer onSend={onSend}/>}

              {rail === "ai" && aiPanelVisible && (
                <section style={{ background: "var(--fg)", color: "#FAFAFA", borderRadius: 4, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon.Sparkles size={14} color="var(--accent)"/>
                    <Eyebrow style={{ color: "#FAFAFA" }}>Suggested next step</Eyebrow>
                    <span style={{ flex: 1 }}/>
                    {aiLive && <Chip tone="success" size="sm">LIVE · CLAUDE</Chip>}
                    {aiEscalate && <Chip tone="warning" size="sm">ESCALATE</Chip>}
                  </div>
                  <div style={{ marginTop: 10, fontFamily: "var(--font-body)", fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                    {aiSummary}
                  </div>
                  <div style={{
                    marginTop: 10, padding: "10px 12px", borderRadius: 3,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                    fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}>
                    {aiLoading ? "Drafting from the live knowledge base…" : aiDraft}
                  </div>
                  {aiError && (
                    <div style={{
                      marginTop: 8, padding: "6px 10px", borderRadius: 3,
                      background: "rgba(220,38,38,0.18)", border: "1px solid rgba(220,38,38,0.45)",
                      fontFamily: "var(--font-body)", fontSize: 11, color: "#FEE2E2",
                    }}>{aiError}</div>
                  )}
                  <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn size="sm" variant="primary" onClick={useDraft} disabled={aiLoading || !aiDraft.trim()}>Use draft</Btn>
                    <Btn size="sm" variant="ghost" style={{ color: "#FAFAFA", borderColor: "rgba(255,255,255,0.15)" }}
                      onClick={regenerateDraft} disabled={aiLoading} icon={<Icon.Sparkles size={12}/>}>
                      {aiLoading ? "Drafting…" : aiLive ? "Regenerate" : "Draft with Claude"}
                    </Btn>
                  </div>
                </section>
              )}
              {rail === "ai" && !aiPanelVisible && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--fg-muted)", fontSize: 12 }}>
                  AI Concierge panel is hidden. Re-enable in Tweaks.
                </div>
              )}

              {rail === "details" && (
                <section style={{ display: "grid", gap: 12 }}>
                  <div>
                    <Num size={10} color="var(--fg-subtle)" style={{ letterSpacing: "0.04em" }}>CATEGORY</Num>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{ticket.category}</div>
                  </div>
                  <div>
                    <Num size={10} color="var(--fg-subtle)" style={{ letterSpacing: "0.04em" }}>TAGS</Num>
                    <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {ticket.tags.map(tg => <Chip key={tg} tone="muted" size="sm" dot={false}>{tg}</Chip>)}
                    </div>
                  </div>
                  <div>
                    <Num size={10} color="var(--fg-subtle)" style={{ letterSpacing: "0.04em" }}>ASSIGNEE</Num>
                    <div style={{ marginTop: 4 }}>
                      <Select value={ticket.assignee || ""} onChange={e => onTriage("assignee", e.target.value || null)}>
                        <option value="">Unassigned</option>
                        <option value="AI Concierge">AI Concierge</option>
                        {user && user.name && user.name !== "Guest" && (
                          <option value={user.name}>{user.name} (you)</option>
                        )}
                        <option value="Jordan Lee">Jordan Lee</option>
                        <option value="Priya Shah">Priya Shah</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Num size={10} color="var(--fg-subtle)" style={{ letterSpacing: "0.04em" }}>STATUS</Num>
                    <div style={{ marginTop: 4 }}>
                      <Select value={ticket.status} onChange={e => onTriage("status", e.target.value)}>
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="waiting">Waiting on tenant</option>
                        <option value="resolved">Resolved</option>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Num size={10} color="var(--fg-subtle)" style={{ letterSpacing: "0.04em" }}>PRIORITY</Num>
                    <div style={{ marginTop: 4 }}>
                      <Select value={ticket.priority} onChange={e => onTriage("priority", e.target.value)}>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                    </div>
                  </div>
                </section>
              )}

              {rail === "tenant" && (
                <section>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                    {ticket.requester.name}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)" }}>
                    {ticket.requester.role} · {ticket.requester.company}
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <Row label="Channel" value={<span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><Ch.icon size={12}/> {Ch.label}</span>}/>
                    <Row label="Phone"   value={<Num size={12}>{ticket.requester.phone}</Num>}/>
                    <Row label="Opened"  value={<Num size={12}>{ticket.openedAt}</Num>}/>
                    <Row label="Response" value={<span style={{ fontSize: 12, color: "var(--fg)" }}>{ticket.responseResponsibility}</span>}/>
                  </div>
                </section>
              )}

              {rail === "property" && (
                <section>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Num size={11} color="var(--fg-subtle)">{property?.code}</Num>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{property?.name}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>
                    {property?.city}
                  </div>
                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <Tile label="SQ FT" value={property?.sqft.toLocaleString()}/>
                    <Tile label="UNITS" value={property?.units}/>
                  </div>
                </section>
              )}
            </div>
          </aside>
        )}

        <nav style={{
          width: 48, flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg)",
          display: "flex", flexDirection: "column",
        }}>
          <RailTab icon={<Icon.Reply size={16}/>}    label="Reply"         active={rail === "reply"}   badge={true} onClick={() => toggleTab("reply")}/>
          <RailTab icon={<Icon.Sparkles size={16}/>} label="AI Concierge"  active={rail === "ai"}      badge={aiPanelVisible} onClick={() => toggleTab("ai")}/>
          <div style={{ height: 1, background: "var(--border)", margin: "0 8px" }}/>
          <RailTab icon={<Icon.Flag size={16}/>}     label="Details"       active={rail === "details"} onClick={() => toggleTab("details")}/>
          <RailTab icon={<Icon.User size={16}/>}     label="Tenant"        active={rail === "tenant"}  onClick={() => toggleTab("tenant")}/>
          <RailTab icon={<Icon.Building size={16}/>} label="Property"      active={rail === "property"} onClick={() => toggleTab("property")}/>
          <div style={{ flex: 1 }}/>
        </nav>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Num size={10} color="var(--fg-subtle)" style={{ width: 72, letterSpacing: "0.04em" }}>{label.toUpperCase()}</Num>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 3, padding: "8px 10px" }}>
      <Num size={10} color="var(--fg-subtle)" style={{ letterSpacing: "0.04em" }}>{label}</Num>
      <div style={{ marginTop: 2 }}><Num size={14} color="var(--fg)">{value}</Num></div>
    </div>
  );
}

// ---------- Inbox Screen (coordinates panes) ----------
function InboxScreen({ viewKey, onViewChange, tickets, properties, selectedId, onSelect, timelineMap, onSend, onTriage, aiPanelVisible, density, viewsCollapsed, onToggleViewsCollapsed, user }) {
  const views = LIRE_DATA.views;
  const active = viewKey;
  const filtered = tickets.filter(t => {
    if (active === "all") return true;
    if (active.startsWith("ch-")) {
      const ch = active.replace("ch-", "");
      return t.channel === ch;
    }
    return t.views.includes(active);
  });
  const selectedTicket = tickets.find(t => t.id === selectedId);
  const property = selectedTicket ? properties.find(p => p.id === selectedTicket.property) : null;
  const timeline = timelineMap[selectedId] || [];
  const viewLabel = views.find(v => v.key === active)?.label || "Inbox";

  // Keyboard nav within list
  useEffectI(() => {
    const handler = (e) => {
      if (e.target && ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = filtered.findIndex(t => t.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(idx + 1, filtered.length - 1);
        if (next >= 0) onSelect(filtered[next].id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(idx - 1, 0);
        if (next >= 0) onSelect(filtered[next].id);
      } else if (e.key === "g") {
        e.preventDefault();
        if (filtered[0]) onSelect(filtered[0].id);
      } else if (e.key === "G") {
        e.preventDefault();
        if (filtered.length) onSelect(filtered[filtered.length - 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedId, onSelect]);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <ViewsPane views={views} active={active} onPick={onViewChange} density={density}
        collapsed={viewsCollapsed} onToggleCollapsed={onToggleViewsCollapsed}/>
      <ListPane tickets={filtered} properties={properties} selectedId={selectedId}
        onSelect={onSelect} density={density} viewLabel={viewLabel}/>
      <DetailPane ticket={selectedTicket} property={property} timeline={timeline}
        aiPanelVisible={aiPanelVisible} user={user}
        onSend={onSend} onTriage={onTriage}/>
    </div>
  );
}

Object.assign(window, { InboxScreen });
