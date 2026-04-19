// LIRE Help — Concierge tabs: Knowledge · Learning · Guardrails · Activity · Try it

const { useState: useStateCT, useEffect: useEffectCT, useRef: useRefCT, useCallback: useCallbackCT } = React;

function iconByName(n) {
  return { FileText: Icon.FileText, Hammer: Icon.Hammer, Inbox: Icon.Inbox,
           Shield: Icon.Shield, Layers: Icon.Layers, Warehouse: Icon.Warehouse,
           Upload: Icon.Upload, Hash: Icon.Hash }[n] || Icon.FileText;
}

// ---------- Knowledge ----------
function KnowledgeTab({ config, onNavLibrary }) {
  return (
    <div>
      <SectionHeader
        eyebrow="Knowledge base"
        title="What the Concierge knows"
        desc="The agent's live index. Source documents live in Library — this view shows what's indexed, how fresh it is, and where coverage is thin."
        right={<Btn variant="secondary" size="md" icon={<Icon.FileText size={13}/>} onClick={() => onNavLibrary && onNavLibrary()} iconRight={<Icon.ArrowRight size={11}/>}>Open Library</Btn>}
      />
      {/* Distinction callout */}
      <div style={{
        marginBottom: 14, padding: "10px 14px",
        border: "1px solid var(--border)", borderLeft: "2px solid var(--accent)",
        background: "var(--surface)", borderRadius: 3,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
          <span style={{ color: "var(--fg)", fontWeight: 600 }}>Two places, one source of truth.</span>{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "var(--fg)" }}>LIBRARY</span> is where you upload and manage raw documents — leases, manuals, contracts.{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "var(--fg)" }}>KNOWLEDGE</span> is this view: the subset the Concierge has indexed and can cite.
        </div>
        <Btn size="sm" variant="ghost" onClick={() => onNavLibrary && onNavLibrary()} iconRight={<Icon.ArrowRight size={11}/>}>Manage documents</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {config.knowledge.map(k => {
          const Ic = iconByName(k.icon);
          const off = k.offline;
          return (
            <div key={k.key} style={{
              background: "var(--surface)", border: "1px solid " + (k.gap ? "rgba(234,179,8,0.35)" : "var(--border)"),
              borderRadius: 4, padding: "14px 16px",
              opacity: off ? 0.6 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 3, background: "var(--surface-2)",
                  display: "grid", placeItems: "center", color: "var(--fg)",
                }}><Ic size={14}/></div>
                <div style={{ flex: 1, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                  {k.label}
                </div>
                {k.gap && <Chip tone="warning" size="sm">GAP</Chip>}
                {off && <Chip tone="muted" size="sm">OFFLINE</Chip>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                <Num size={20} weight={500} color="var(--fg)" style={{ letterSpacing: "-0.02em" }}>{k.items}</Num>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--fg-muted)" }}>items indexed</span>
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--fg-muted)", marginBottom: 2 }}>
                {k.covers}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)", letterSpacing: "0.04em" }}>
                LAST INDEXED · {k.lastIndexed.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Learning ----------
function LearningTab({ config }) {
  const L = config.learning;
  const [plays, setPlays] = useStateCT(L.plays);
  const update = (id, status) => setPlays(plays.map(p => p.id === id ? { ...p, status } : p));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Plays queue */}
      <section>
        <SectionHeader
          eyebrow="Learning loop · plays"
          title="Should this become a play?"
          desc="After every resolved ticket, the Concierge proposes a reusable play. You approve what gets learned."
        />
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
          {plays.map((p, i) => (
            <div key={p.id} style={{
              padding: "14px 18px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
              display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <Num size={11} color="var(--fg-subtle)">{p.from}</Num>
                  <Chip tone={p.confidence > 0.9 ? "success" : "neutral"} size="sm">
                    {Math.round(p.confidence * 100)}% CONFIDENCE
                  </Chip>
                  {p.status === "approved" && <Chip tone="success" size="sm">APPROVED</Chip>}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  {p.question}
                </div>
                <div style={{ marginTop: 3, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.45 }}>
                  {p.summary}
                </div>
              </div>
              {p.status === "pending" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" variant="secondary" onClick={() => update(p.id, "rejected")}>Reject</Btn>
                  <Btn size="sm" variant="primary" onClick={() => update(p.id, "approved")} icon={<Icon.Check size={12}/>}>Approve</Btn>
                </div>
              ) : (
                <Num size={11} color="var(--fg-subtle)">{p.status.toUpperCase()}</Num>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Two-column: Preferences + Gaps */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <Eyebrow>Silently learned preferences</Eyebrow>
            <div style={{ marginTop: 2, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>
              The rhythm of each property
            </div>
          </div>
          {L.preferences.map((pr, i) => (
            <div key={i} style={{ padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>{pr.subject}</div>
              <div style={{ marginTop: 2, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)" }}>{pr.pref}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <Eyebrow>Content gaps</Eyebrow>
            <div style={{ marginTop: 2, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>
              Questions I couldn't answer
            </div>
          </div>
          {L.gaps.map((g, i) => (
            <div key={g.id} style={{ padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : "none",
              display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>{g.question}</div>
                <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)", letterSpacing: "0.04em" }}>
                  ASKED {g.asked}× · LAST {g.last.toUpperCase()}
                </div>
              </div>
              <Btn size="sm" variant="secondary" icon={<Icon.Plus size={11}/>}>Answer</Btn>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly digest */}
      <section style={{ background: "var(--fg)", color: "#FAFAFA", borderRadius: 4 }}>
        <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon.Sparkles size={14} color="var(--accent)"/>
          <div style={{ flex: 1 }}>
            <Eyebrow style={{ color: "rgba(255,255,255,0.6)" }}>Weekly digest · {L.weeklyDigest.period}</Eyebrow>
            <div style={{ marginTop: 2, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "#FAFAFA" }}>
              Here's what I learned this week
            </div>
          </div>
          <Btn size="sm" variant="primary">Approve all</Btn>
        </div>
        <div>
          {L.weeklyDigest.items.map((it, i) => {
            const tone = it.kind === "learned" ? "var(--success)" : it.kind === "gap" ? "var(--warning)" : "var(--accent)";
            return (
              <div key={i} style={{ padding: "10px 22px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", display: "grid", gridTemplateColumns: "100px 1fr", gap: 16, alignItems: "center" }}>
                <Num size={10} color={tone} style={{ letterSpacing: "0.06em" }}>{it.kind.toUpperCase()}</Num>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#FAFAFA" }}>{it.text}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ---------- Guardrails ----------
function GuardrailsTab({ config }) {
  const G = config.guardrails;
  const modeMeta = {
    auto:     { label: "Autonomous",      tone: "success", desc: "Acts without asking" },
    propose:  { label: "Propose",         tone: "neutral", desc: "Drafts; human approves" },
    escalate: { label: "Escalate",        tone: "warning", desc: "Pages a human" },
    blocked:  { label: "Blocked",         tone: "error",   desc: "Never handled by Concierge" },
  };
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <SectionHeader
          eyebrow="Autonomy matrix"
          title="What it can do on its own"
          desc="Click a row to rewrite the policy. Changes take effect immediately."
        />
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr", padding: "10px 18px", borderBottom: "2px solid var(--fg)", background: "var(--surface-2)" }}>
            <Eyebrow style={{ fontSize: 10 }}>Topic</Eyebrow>
            <Eyebrow style={{ fontSize: 10 }}>Mode</Eyebrow>
            <Eyebrow style={{ fontSize: 10 }}>Note</Eyebrow>
          </div>
          {G.autonomyMatrix.map((row, i) => {
            const m = modeMeta[row.mode];
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr", padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{row.topic}</div>
                <div><Chip tone={m.tone} size="sm">{m.label.toUpperCase()}</Chip></div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)" }}>{row.note || m.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <Eyebrow>Hard escalation triggers</Eyebrow>
            <div style={{ marginTop: 2, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>
              Always page a human when…
            </div>
          </div>
          {G.triggers.map((t, i) => (
            <label key={t.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg)" }}>{t.label}</div>
              <div style={{
                width: 34, height: 20, borderRadius: 10, padding: 2,
                background: t.on ? "var(--accent)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: t.on ? "flex-end" : "flex-start",
                transition: "all 140ms var(--ease)",
              }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff" }}/>
              </div>
            </label>
          ))}
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon.Lock size={13} color="var(--error)"/>
              <Eyebrow>Legal & no-go zones</Eyebrow>
            </div>
            <div style={{ marginTop: 2, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>
              Concierge will never touch these
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {G.nogo.map((n, i) => (
              <div key={i} style={{ padding: "8px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <Icon.X size={12} color="var(--error)"/>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg)" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------- Activity ----------
function ActivityTab({ config }) {
  const A = config.activity;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "18px 20px" }}>
          <Eyebrow>Tenant satisfaction (proxy)</Eyebrow>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
            <Num size={40} weight={500} color="var(--fg)" style={{ letterSpacing: "-0.02em" }}>{A.csatProxy}</Num>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--fg-muted)" }}>%</span>
          </div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)" }}>
            Resolved threads with no re-open inside 48h. Last 30 days.
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "18px 20px" }}>
          <Eyebrow>Time to first response</Eyebrow>
          <div style={{ marginTop: 8 }}>
            <Num size={40} weight={500} color="var(--fg)" style={{ letterSpacing: "-0.02em" }}>{A.ttfr}</Num>
          </div>
          <div style={{ marginTop: 4, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)" }}>
            Across all channels. Human-only benchmark: 11m 20s.
          </div>
        </div>
      </div>

      <SectionHeader eyebrow="Audit log" title="Everything the Concierge did today"
        desc="Every action is logged with source, model version, and the policies invoked."/>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4 }}>
        {A.log.map((e, i) => {
          const tone = { action: "var(--accent)", message: "var(--fg)", learn: "var(--success)", escalate: "var(--warning)" }[e.kind];
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 90px 1fr", padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--border)" : "none", alignItems: "center", gap: 12 }}>
              <Num size={11} color="var(--fg-subtle)">{e.at}</Num>
              <Chip tone={e.kind === "escalate" ? "warning" : e.kind === "learn" ? "success" : "neutral"} size="sm">
                {e.kind.toUpperCase()}
              </Chip>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg)" }}>{e.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Try it (live chat against /api/chat) ----------
function ChatBubble({ role, content, escalate, muted }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "82%", padding: "10px 14px", borderRadius: 6,
        background: isUser ? "var(--accent)" : "var(--surface-2)",
        color: isUser ? "#fff" : "var(--fg)",
        fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.55,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        opacity: muted ? 0.6 : 1,
        border: isUser ? "none" : "1px solid var(--border)",
      }}>
        {content}
        {escalate && (
          <div style={{ marginTop: 8 }}>
            <Chip tone="warning" size="sm">ESCALATION FLAGGED</Chip>
          </div>
        )}
      </div>
    </div>
  );
}

function TryItTab({ config }) {
  const [messages, setMessages] = useStateCT([]);
  const [input, setInput] = useStateCT("");
  const [sending, setSending] = useStateCT(false);
  const [error, setError] = useStateCT(null);
  const listRef = useRefCT(null);
  const sessionIdRef = useRefCT(`concierge-demo-${Math.random().toString(36).slice(2, 10)}`);

  useEffectCT(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const send = useCallbackCT(async (override) => {
    const body = (override != null ? override : input).trim();
    if (!body || sending) return;
    const next = [...messages, { role: "user", content: body }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          sessionId: sessionIdRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data && data.error ? String(data.error) : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response || "(empty response)",
        escalate: !!data.escalate,
      }]);
    } catch (err) {
      setError(err && err.message ? err.message : "Something broke — try again.");
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  const suggestions = [
    "What are the dock hours at Oakland Distribution Center?",
    "Freezer temp alert just came in — who gets dispatched?",
    "When does CAM get reconciled and how do late fees work?",
    "Is Unit 11 at Fremont Flex available to tour this week?",
  ];

  return (
    <div>
      <SectionHeader
        eyebrow="Try it · live"
        title="Talk to the Concierge as a tenant would"
        desc="Live connection to Claude Haiku 4.5, grounded in the platform knowledge base. Responses are real — escalation flags and access-control prompts behave the same way they would in the Inbox."
      />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 16, alignItems: "start" }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4,
          display: "flex", flexDirection: "column", height: 620, minWidth: 0,
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 3, background: "var(--fg)",
              display: "grid", placeItems: "center", color: "#FAFAFA",
            }}><Icon.Bot size={14}/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                LIRE Concierge
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", color: "var(--fg-subtle)" }}>
                {config.state.toUpperCase()} · AUTONOMY {config.autonomyPct}% · {messages.length} MSG
              </div>
            </div>
            {messages.length > 0 && (
              <Btn size="sm" variant="ghost" onClick={() => { setMessages([]); setError(null); }}>
                Clear
              </Btn>
            )}
          </div>

          <div ref={listRef} style={{
            flex: 1, overflowY: "auto", padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {messages.length === 0 && !sending && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 360 }}>
                <Icon.Sparkles size={20} color="var(--accent)"/>
                <div style={{
                  marginTop: 10, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--fg)",
                }}>Start a conversation</div>
                <div style={{
                  marginTop: 6, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.55,
                }}>
                  Type anything a tenant might ask — dock logistics, vendor escalations, lease questions. Or tap a suggestion on the right.
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} escalate={m.escalate}/>
            ))}
            {sending && <ChatBubble role="assistant" content="Drafting…" muted/>}
            {error && (
              <div style={{
                padding: "8px 12px", border: "1px solid var(--error)",
                background: "rgba(220,38,38,0.08)", borderRadius: 3,
                fontFamily: "var(--font-body)", fontSize: 12, color: "var(--error)",
              }}>{error}</div>
            )}
          </div>

          <div style={{
            borderTop: "1px solid var(--border)", padding: "10px 12px",
            display: "flex", gap: 8, alignItems: "flex-end",
          }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Message the Concierge…  (⌘+Enter to send)"
              rows={2}
              style={{
                flex: 1, resize: "none", minWidth: 0,
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3,
                padding: "8px 10px", outline: "none",
                fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg)",
                lineHeight: 1.5,
              }}
            />
            <Btn
              variant="primary"
              size="md"
              icon={<Icon.Send size={12}/>}
              onClick={() => send()}
              disabled={sending || !input.trim()}
            >
              Send
            </Btn>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "14px 16px" }}>
            <Eyebrow>Try one of these</Eyebrow>
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  disabled={sending}
                  style={{
                    textAlign: "left", padding: "9px 11px",
                    border: "1px solid var(--border)", background: "var(--bg)",
                    borderRadius: 3, cursor: sending ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg)",
                    lineHeight: 1.45,
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, padding: "14px 16px" }}>
            <Eyebrow>How it works</Eyebrow>
            <div style={{ marginTop: 8, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.55 }}>
              The same agent that handles live tenant threads in the Inbox. It's grounded in uploaded leases, manuals, vendor SLAs, and past resolved tickets — and will ask for unit verification before sharing sensitive details.
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", color: "var(--fg-subtle)" }}>
              MODEL · CLAUDE HAIKU 4.5<br/>
              KB · PLATFORM KNOWLEDGE TABLE<br/>
              ESCALATION · [ESCALATE] TAG
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main screen ----------
function ConciergeScreen({ heroVariant = "A", onNavLibrary }) {
  const [config, setConfig] = useStateCT(LIRE_DATA.concierge);
  const [tab, setTab] = useStateCT("overview");
  const onState = (s) => setConfig({ ...config, state: s });

  const tabs = [
    { k: "overview",   label: "Overview" },
    { k: "tryit",      label: "Try it" },
    { k: "knowledge",  label: "Knowledge" },
    { k: "learning",   label: "Learning" },
    { k: "guardrails", label: "Guardrails" },
    { k: "activity",   label: "Activity" },
  ];

  return (
    <div style={{ padding: "24px 28px", background: "var(--bg)", minHeight: "100%", width: "100%", overflow: "auto" }}>
      {tab === "overview" && (heroVariant === "B"
        ? <HeroMeet config={config} onState={onState}/>
        : <HeroControlRoom config={config} onState={onState}/>)}

      <div style={{ marginTop: tab === "overview" ? 8 : 0, marginBottom: 16, borderBottom: "1px solid var(--border)", display: "flex", gap: 0 }}>
        {tabs.map(t => {
          const active = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: "12px 18px 14px", border: 0, background: "transparent",
              borderBottom: "2px solid " + (active ? "var(--fg)" : "transparent"),
              marginBottom: -1, cursor: "pointer",
              fontFamily: "var(--font-body)", fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? "var(--fg)" : "var(--fg-muted)",
            }}>{t.label}</button>
          );
        })}
      </div>

      {tab === "overview"   && <OverviewBody config={config} onState={onState}/>}
      {tab === "tryit"      && <TryItTab config={config}/>}
      {tab === "knowledge"  && <KnowledgeTab config={config} onNavLibrary={onNavLibrary}/>}
      {tab === "learning"   && <LearningTab config={config}/>}
      {tab === "guardrails" && <GuardrailsTab config={config}/>}
      {tab === "activity"   && <ActivityTab config={config}/>}
    </div>
  );
}

Object.assign(window, { ConciergeScreen, KnowledgeTab, LearningTab, GuardrailsTab, ActivityTab, TryItTab });
