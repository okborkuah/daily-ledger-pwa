import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const C = {
  bg: "#F0F4FA",
  card: "#FFFFFF",
  navy: "#1B2B5E",
  sale: "#1AAF74",
  saleSoft: "#E6F9F1",
  purchase: "#E0445E",
  purchaseSoft: "#FDEEF1",
  muted: "#8892A4",
  border: "#E4E9F2",
  text: "#1A2133",
};

const CATS = {
  sale: ["Product", "Service", "Subscription", "Consulting", "Other"],
  purchase: ["Inventory", "Equipment", "Rent", "Utilities", "Salary", "Marketing", "Other"],
};
const ALL_CATS = ["Product", "Service", "Subscription", "Consulting", "Inventory", "Equipment", "Rent", "Utilities", "Salary", "Marketing", "Other"];

const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtFull = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const todayStr = () => new Date().toISOString().slice(0, 10);

const dayLabel = (d) => {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (d === today) return "Today";
  if (d === yesterday) return "Yesterday";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getWeekDates = (offset = 0) => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
};

const getMonthDates = (offset = 0) => {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
  const dates = [];
  while (d <= end) { dates.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return dates;
};

const getWeekLabel = (offset = 0) => {
  const dates = getWeekDates(offset);
  const s = new Date(dates[0] + "T00:00:00");
  const e = new Date(dates[6] + "T00:00:00");
  const o = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", o)} – ${e.toLocaleDateString("en-US", o)}`;
};

const getMonthLabel = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const firstOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

// ── Reusable field component ──────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

const inputStyle = {
  display: "block", width: "100%", padding: "12px 14px", borderRadius: 12,
  border: `1px solid ${C.border}`, fontSize: 15, color: C.text, outline: "none",
  boxSizing: "border-box", background: C.bg,
};

// ── Custom Tooltip for chart ──────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}`, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.name === "Sales" ? C.sale : C.purchase, marginBottom: 2 }}>
          {p.name}: {fmtFull(p.value)}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
export default function App() {
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("daily");

  // Daily
  const [filterDate, setFilterDate] = useState(todayStr());
  const [catFilter, setCatFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [entryType, setEntryType] = useState("sale");
  const [form, setForm] = useState({ description: "", amount: "", category: "", date: todayStr() });
  const [formError, setFormError] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  // Summary
  const [summaryMode, setSummaryMode] = useState("weekly");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Export
  const [exportFrom, setExportFrom] = useState(firstOfMonth);
  const [exportTo, setExportTo] = useState(todayStr);
  const [exportType, setExportType] = useState("all");
  const [exportCat, setExportCat] = useState("All");
  const [exportDone, setExportDone] = useState(false);

  // ── Storage ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("records");
        if (r?.value) setRecords(JSON.parse(r.value));
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("records", JSON.stringify(records)).catch(() => {});
  }, [records, loaded]);

  // ── Save entry ───────────────────────────────────────────
  const save = () => {
    if (!form.description.trim()) return setFormError("Please enter a description.");
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) return setFormError("Enter a valid amount.");
    if (!form.category) return setFormError("Please select a category.");
    setRecords(r => [{
      id: Date.now().toString(), type: entryType,
      description: form.description.trim(), amount: amt,
      category: form.category, date: form.date,
    }, ...r]);
    setForm({ description: "", amount: "", category: "", date: filterDate });
    setFormError("");
    setShowAdd(false);
  };

  const deleteRecord = (id) => { setRecords(r => r.filter(x => x.id !== id)); setDeleteId(null); };

  // ── Daily computations ───────────────────────────────────
  const dayRecords = records.filter(r => r.date === filterDate);
  const dayCategories = ["All", ...new Set(dayRecords.map(r => r.category))];
  const visibleRecords = catFilter === "All" ? dayRecords : dayRecords.filter(r => r.category === catFilter);
  const daySales = dayRecords.filter(r => r.type === "sale").reduce((s, r) => s + r.amount, 0);
  const dayPurchases = dayRecords.filter(r => r.type === "purchase").reduce((s, r) => s + r.amount, 0);
  const dayNet = daySales - dayPurchases;

  // ── Summary computations ─────────────────────────────────
  const weekDates = getWeekDates(weekOffset);
  const monthDates = getMonthDates(monthOffset);
  const periodDates = summaryMode === "weekly" ? weekDates : monthDates;
  const periodRecs = records.filter(r => periodDates.includes(r.date));
  const periodSales = periodRecs.filter(r => r.type === "sale").reduce((a, r) => a + r.amount, 0);
  const periodPurchases = periodRecs.filter(r => r.type === "purchase").reduce((a, r) => a + r.amount, 0);
  const periodNet = periodSales - periodPurchases;

  const weekChartData = weekDates.map(date => {
    const recs = records.filter(r => r.date === date);
    return {
      name: new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }),
      Sales: recs.filter(r => r.type === "sale").reduce((a, r) => a + r.amount, 0),
      Purchases: recs.filter(r => r.type === "purchase").reduce((a, r) => a + r.amount, 0),
    };
  });

  const monthChartData = [1, 2, 3, 4, 5].map(w => {
    const inWeek = monthDates.filter(d => Math.ceil(new Date(d + "T00:00:00").getDate() / 7) === w);
    if (!inWeek.length) return null;
    const recs = records.filter(r => inWeek.includes(r.date));
    return {
      name: `Wk ${w}`,
      Sales: recs.filter(r => r.type === "sale").reduce((a, r) => a + r.amount, 0),
      Purchases: recs.filter(r => r.type === "purchase").reduce((a, r) => a + r.amount, 0),
    };
  }).filter(Boolean);

  const catBreakdown = ALL_CATS.map(cat => {
    const recs = periodRecs.filter(r => r.category === cat);
    const sales = recs.filter(r => r.type === "sale").reduce((a, r) => a + r.amount, 0);
    const purchases = recs.filter(r => r.type === "purchase").reduce((a, r) => a + r.amount, 0);
    return { cat, sales, purchases, total: sales + purchases };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // ── Export ───────────────────────────────────────────────
  const exportRows = records.filter(r => {
    if (r.date < exportFrom || r.date > exportTo) return false;
    if (exportType !== "all" && r.type !== exportType) return false;
    if (exportCat !== "All" && r.category !== exportCat) return false;
    return true;
  });

  const doExport = () => {
    if (!exportRows.length) return;
    const sorted = [...exportRows].sort((a, b) => a.date.localeCompare(b.date));
    const header = "Date,Type,Description,Category,Amount";
    const lines = sorted.map(r =>
      `${r.date},${r.type},"${r.description.replace(/"/g, '""')}",${r.category},${r.amount.toFixed(2)}`
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${exportFrom}-to-${exportTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ color: C.muted }}>Loading…</div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 420, margin: "0 auto", position: "relative", paddingBottom: 80 }}>

      {/* ═══ DAILY TAB ═══════════════════════════════════════ */}
      {tab === "daily" && <>
        {/* Header */}
        <div style={{ background: C.navy, padding: "28px 20px 20px", borderRadius: "0 0 24px 24px" }}>
          <div style={{ fontSize: 11, color: "#8FA6D8", fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>Daily Ledger</div>
          <input type="date" value={filterDate}
            onChange={e => { setFilterDate(e.target.value); setCatFilter("All"); }}
            style={{ background: "transparent", border: "none", color: "#fff", fontSize: 22, fontWeight: 700, cursor: "pointer", outline: "none", padding: 0, width: "100%" }} />
          <div style={{ fontSize: 13, color: "#8FA6D8", marginTop: 2 }}>{dayLabel(filterDate)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 18 }}>
            {[
              { label: "Sales", value: daySales, color: "#1AAF74" },
              { label: "Purchases", value: dayPurchases, color: "#E0445E" },
              { label: "Net", value: dayNet, color: dayNet >= 0 ? "#1AAF74" : "#E0445E" },
            ].map(c => (
              <div key={c.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#8FA6D8", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Filter Chips */}
        {dayRecords.length > 0 && (
          <div style={{ padding: "14px 16px 0" }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {dayCategories.map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  style={{ whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: catFilter === cat ? C.navy : C.card,
                    color: catFilter === cat ? "#fff" : C.muted,
                    boxShadow: catFilter === cat ? "0 2px 8px rgba(27,43,94,0.25)" : "0 1px 3px rgba(0,0,0,0.06)" }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Records List */}
        <div style={{ padding: "14px 16px 0" }}>
          {visibleRecords.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 50 }}>
              <div style={{ fontSize: 40 }}>📋</div>
              <div style={{ color: C.muted, marginTop: 12, fontSize: 15 }}>
                {dayRecords.length === 0 ? "No records for this day" : "No records in this category"}
              </div>
              {dayRecords.length === 0 && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Tap + to add your first entry</div>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleRecords.map(r => (
                <div key={r.id} style={{ background: C.card, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: r.type === "sale" ? C.saleSoft : C.purchaseSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: r.type === "sale" ? C.sale : C.purchase, fontWeight: 700 }}>
                    {r.type === "sale" ? "↑" : "↓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{r.category}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: r.type === "sale" ? C.sale : C.purchase }}>
                      {r.type === "sale" ? "+" : "−"}{fmtFull(r.amount)}
                    </div>
                    <div onClick={() => setDeleteId(r.id)} style={{ fontSize: 11, color: C.muted, marginTop: 3, cursor: "pointer", userSelect: "none" }}>Delete</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAB */}
        <button onClick={() => { setShowAdd(true); setFormError(""); setForm({ description: "", amount: "", category: "", date: filterDate }); }}
          style={{ position: "fixed", bottom: 76, right: "50%", transform: "translateX(50%)", maxWidth: 388, width: "calc(100% - 32px)", padding: "15px", borderRadius: 16, border: "none", background: C.navy, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(27,43,94,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 10 }}>
          <span style={{ fontSize: 20 }}>+</span> Add Entry
        </button>
      </>}

      {/* ═══ SUMMARY TAB ══════════════════════════════════════ */}
      {tab === "summary" && (
        <div style={{ padding: "28px 16px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 18 }}>Summary</div>

          {/* Toggle */}
          <div style={{ display: "flex", background: C.card, borderRadius: 12, padding: 4, marginBottom: 18, border: `1px solid ${C.border}` }}>
            {["weekly", "monthly"].map(m => (
              <button key={m} onClick={() => setSummaryMode(m)}
                style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14,
                  background: summaryMode === m ? C.navy : "transparent",
                  color: summaryMode === m ? "#fff" : C.muted }}>
                {m === "weekly" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>

          {/* Period Navigator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 14, padding: "12px 16px", marginBottom: 16, border: `1px solid ${C.border}` }}>
            <button onClick={() => summaryMode === "weekly" ? setWeekOffset(w => w - 1) : setMonthOffset(m => m - 1)}
              style={{ background: C.bg, border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 20, color: C.navy, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.text, textAlign: "center" }}>
              {summaryMode === "weekly" ? getWeekLabel(weekOffset) : getMonthLabel(monthOffset)}
            </div>
            <button
              onClick={() => summaryMode === "weekly" ? setWeekOffset(w => w + 1) : setMonthOffset(m => m + 1)}
              disabled={(summaryMode === "weekly" && weekOffset >= 0) || (summaryMode === "monthly" && monthOffset >= 0)}
              style={{ background: C.bg, border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 20, color: C.navy, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", opacity: ((summaryMode === "weekly" && weekOffset >= 0) || (summaryMode === "monthly" && monthOffset >= 0)) ? 0.25 : 1 }}>›</button>
          </div>

          {/* Period Totals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Sales", value: periodSales, color: C.sale },
              { label: "Purchases", value: periodPurchases, color: C.purchase },
              { label: "Net", value: periodNet, color: periodNet >= 0 ? C.sale : C.purchase },
            ].map(c => (
              <div key={c.label} style={{ background: C.card, borderRadius: 14, padding: "14px 10px", textAlign: "center", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          <div style={{ background: C.card, borderRadius: 16, padding: "18px 8px 14px", border: `1px solid ${C.border}`, marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 12, paddingLeft: 10 }}>
              {summaryMode === "weekly" ? "Daily Breakdown" : "Weekly Breakdown"}
            </div>
            {periodRecs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: C.muted, fontSize: 14 }}>No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={summaryMode === "weekly" ? weekChartData : monthChartData} barCategoryGap="28%" barGap={3}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="Sales" fill={C.sale} radius={[5, 5, 0, 0]} />
                  <Bar dataKey="Purchases" fill={C.purchase} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 10 }}>
              {[["Sales", C.sale], ["Purchases", C.purchase]].map(([label, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> {label}
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          {catBreakdown.length > 0 && (
            <div style={{ background: C.card, borderRadius: 16, padding: "18px 16px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 16 }}>Category Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {catBreakdown.map(({ cat, sales, purchases, total }) => (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cat}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(total)}</div>
                    </div>
                    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: C.bg }}>
                      {sales > 0 && <div style={{ width: `${(sales / total) * 100}%`, background: C.sale }} />}
                      {purchases > 0 && <div style={{ width: `${(purchases / total) * 100}%`, background: C.purchase }} />}
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 5 }}>
                      {sales > 0 && <div style={{ fontSize: 11, color: C.sale }}>↑ Sales {fmtFull(sales)}</div>}
                      {purchases > 0 && <div style={{ fontSize: 11, color: C.purchase }}>↓ Cost {fmtFull(purchases)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ EXPORT TAB ═══════════════════════════════════════ */}
      {tab === "export" && (
        <div style={{ padding: "28px 16px 0" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Export CSV</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>Download your records as a spreadsheet-ready file.</div>

          <Field label="Date Range">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>From</div>
                <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>To</div>
                <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </Field>

          <Field label="Shortcuts">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "This Week", action: () => { const d = getWeekDates(0); setExportFrom(d[0]); setExportTo(d[6]); } },
                { label: "Last Week", action: () => { const d = getWeekDates(-1); setExportFrom(d[0]); setExportTo(d[6]); } },
                { label: "This Month", action: () => { const d = getMonthDates(0); setExportFrom(d[0]); setExportTo(d[d.length - 1]); } },
                { label: "Last Month", action: () => { const d = getMonthDates(-1); setExportFrom(d[0]); setExportTo(d[d.length - 1]); } },
                { label: "All Time", action: () => { setExportFrom("2000-01-01"); setExportTo(todayStr()); } },
              ].map(({ label, action }) => (
                <button key={label} onClick={action}
                  style={{ padding: "7px 13px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.card, fontSize: 12, fontWeight: 600, color: C.navy, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Type">
            <div style={{ display: "flex", gap: 8 }}>
              {[["all", "All"], ["sale", "Sales"], ["purchase", "Purchases"]].map(([val, label]) => (
                <button key={val} onClick={() => setExportType(val)}
                  style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `1px solid ${exportType === val ? C.navy : C.border}`, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: exportType === val ? C.navy : C.card,
                    color: exportType === val ? "#fff" : C.muted }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Category">
            <select value={exportCat} onChange={e => setExportCat(e.target.value)} style={{ ...inputStyle, background: C.card, appearance: "none" }}>
              <option value="All">All categories</option>
              {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Preview card */}
          <div style={{ background: C.card, borderRadius: 14, padding: "16px", border: `1px solid ${C.border}`, marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 32 }}>📄</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                {exportRows.length} record{exportRows.length !== 1 ? "s" : ""} ready
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>ledger-{exportFrom}-to-{exportTo}.csv</div>
              {exportRows.length > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {fmtFull(exportRows.filter(r => r.type === "sale").reduce((a, r) => a + r.amount, 0))} sales · {fmtFull(exportRows.filter(r => r.type === "purchase").reduce((a, r) => a + r.amount, 0))} purchases
                </div>
              )}
            </div>
          </div>

          <button onClick={doExport} disabled={exportRows.length === 0}
            style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", fontSize: 16, fontWeight: 700, cursor: exportRows.length === 0 ? "default" : "pointer", transition: "background 0.2s",
              background: exportRows.length === 0 ? C.border : exportDone ? C.sale : C.navy,
              color: exportRows.length === 0 ? C.muted : "#fff" }}>
            {exportDone ? "✓ Downloaded!" : exportRows.length === 0 ? "No records matched" : "Download CSV"}
          </button>
        </div>
      )}

      {/* ═══ DELETE CONFIRM ═══════════════════════════════════ */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, margin: "0 16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.text, marginBottom: 8 }}>Delete this record?</div>
            <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: 13, borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", fontSize: 15, cursor: "pointer", color: C.text }}>Cancel</button>
              <button onClick={() => deleteRecord(deleteId)} style={{ flex: 1, padding: 13, borderRadius: 12, border: "none", background: C.purchase, fontSize: 15, cursor: "pointer", color: "#fff", fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD ENTRY MODAL ══════════════════════════════════ */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", zIndex: 300 }}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 420, margin: "0 auto", padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: C.text }}>New Entry</div>
              <button onClick={() => { setShowAdd(false); setFormError(""); }}
                style={{ background: C.border, border: "none", borderRadius: 20, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: C.muted }}>✕</button>
            </div>

            <div style={{ display: "flex", background: C.bg, borderRadius: 12, padding: 4, marginBottom: 18 }}>
              {["sale", "purchase"].map(t => (
                <button key={t} onClick={() => { setEntryType(t); setForm(f => ({ ...f, category: "" })); }}
                  style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14,
                    background: entryType === t ? (t === "sale" ? C.sale : C.purchase) : "transparent",
                    color: entryType === t ? "#fff" : C.muted }}>
                  {t === "sale" ? "💚 Sale" : "🔴 Purchase"}
                </button>
              ))}
            </div>

            <Field label="Description">
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={entryType === "sale" ? "e.g. Product sold to John" : "e.g. Office supplies"}
                style={inputStyle} />
            </Field>

            <Field label="Amount ($)">
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" style={inputStyle} />
            </Field>

            <Field label="Category">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ ...inputStyle, color: form.category ? C.text : C.muted, appearance: "none" }}>
                <option value="">Select category</option>
                {CATS[entryType].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Date">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </Field>

            {formError && <div style={{ color: C.purchase, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>⚠ {formError}</div>}

            <button onClick={save}
              style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: entryType === "sale" ? C.sale : C.purchase, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Save {entryType === "sale" ? "Sale" : "Purchase"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ BOTTOM TAB BAR ═══════════════════════════════════ */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 50, boxShadow: "0 -4px 20px rgba(0,0,0,0.07)" }}>
        {[
          { key: "daily", label: "Daily", icon: "📅" },
          { key: "summary", label: "Summary", icon: "📊" },
          { key: "export", label: "Export", icon: "📤" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: "12px 0 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: tab === t.key ? C.navy : C.muted }}>{t.label}</span>
            {tab === t.key && <div style={{ width: 20, height: 3, borderRadius: 2, background: C.navy }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
