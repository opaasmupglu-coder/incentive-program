"use client";
import { useEffect, useState } from "react";
import { freshnessText, useSnapshot } from "@/components/useSnapshot";

type Field = { key: string; label: string; kind: "text" | "pct" | "num"; step?: string };

const NAME_FIELDS: Field[] = [
  { key: "validator1", label: "Validator 1", kind: "text" },
  { key: "validator2", label: "Validator 2", kind: "text" },
  { key: "validator3", label: "Validator 3", kind: "text" },
];
const WEIGHT_FIELDS: Field[] = [
  { key: "flRes", label: "Frontline — Resolution %", kind: "pct" },
  { key: "flColl", label: "Frontline — Collection %", kind: "pct" },
  { key: "flGpr", label: "Frontline — GPR %", kind: "pct" },
  { key: "flTime", label: "Frontline — Timeliness %", kind: "pct" },
  { key: "nflRes", label: "Non-frontline — Resolution %", kind: "pct" },
  { key: "nflColl", label: "Non-frontline — Collection %", kind: "pct" },
  { key: "nflGpr", label: "Non-frontline — GPR %", kind: "pct" },
  { key: "nflTime", label: "Non-frontline — Timeliness %", kind: "pct" },
];
const MIX_FIELDS: Field[] = [{ key: "finalInitialWeight", label: "Initial result weight %", kind: "pct" }];
const RULE_FIELDS: Field[] = [
  { key: "sampleConstant", label: "Sample-size constant", kind: "num", step: "0.01" },
  { key: "minFormsFL", label: "Minimum forms — Frontline", kind: "num" },
  { key: "minFormsNFL", label: "Minimum forms — Non-frontline", kind: "num" },
  { key: "gprMax", label: "GPR scale (max score)", kind: "num" },
  { key: "validatorScale", label: "Validator rating scale (max)", kind: "num" },
];
const TIME_FIELDS: Field[] = [
  { key: "time1", label: "1 to 3 days", kind: "num", step: "0.1" },
  { key: "time2", label: "4 to 5 days", kind: "num", step: "0.1" },
  { key: "time3", label: "6 to 7 days", kind: "num", step: "0.1" },
  { key: "time4", label: "8 to 10 days", kind: "num", step: "0.1" },
  { key: "time5", label: "11 to 15 days", kind: "num", step: "0.1" },
  { key: "time6", label: "16+ days / unsubmitted", kind: "num", step: "0.1" },
];
const ITEM_FIELDS: Field[] = [
  { key: "itemCar", label: "CAR %", kind: "pct" },
  { key: "itemOnsite", label: "Onsite Visit %", kind: "pct" },
  { key: "itemBest", label: "Best Practices %", kind: "pct" },
  { key: "itemInterview", label: "Interview %", kind: "pct" },
  { key: "itemCcArta", label: "CC & ARTA %", kind: "pct" },
  { key: "itemInnovation", label: "Innovation %", kind: "pct" },
  { key: "itemResponsive", label: "Responsiveness %", kind: "pct" },
  { key: "itemProfessionalism", label: "Professionalism %", kind: "pct" },
  { key: "itemCommunication", label: "Communication %", kind: "pct" },
];

const ALL_FIELDS = [...NAME_FIELDS, ...WEIGHT_FIELDS, ...MIX_FIELDS, ...RULE_FIELDS, ...TIME_FIELDS, ...ITEM_FIELDS];

export default function SettingsPage() {
  const { snap, loading, error, lastSynced, refresh, setSaving } = useSnapshot();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!snap?.settings || loaded) return;
    const s = snap.settings;
    const pct = (v: number | null) => (v === null ? "" : String(Math.round(v * 1000) / 10));
    const num = (v: number | null) => (v === null ? "" : String(v));
    setValues({
      validator1: s.validatorNames[0] || "",
      validator2: s.validatorNames[1] || "",
      validator3: s.validatorNames[2] || "",
      flRes: pct(s.flWeights[0]),
      flColl: pct(s.flWeights[1]),
      flGpr: pct(s.flWeights[2]),
      flTime: pct(s.flWeights[3]),
      nflRes: pct(s.nflWeights[0]),
      nflColl: pct(s.nflWeights[1]),
      nflGpr: pct(s.nflWeights[2]),
      nflTime: pct(s.nflWeights[3]),
      finalInitialWeight: pct(s.finalInitialWeight),
      sampleConstant: num(s.sampleConstant),
      minFormsFL: num(s.minFormsFL),
      minFormsNFL: num(s.minFormsNFL),
      gprMax: num(s.gprMax),
      validatorScale: num(s.validatorScale),
      time1: num(s.timelinessBands[0]),
      time2: num(s.timelinessBands[1]),
      time3: num(s.timelinessBands[2]),
      time4: num(s.timelinessBands[3]),
      time5: num(s.timelinessBands[4]),
      time6: num(s.timelinessBands[5]),
      itemCar: pct(s.officeItemWeights[0]),
      itemOnsite: pct(s.officeItemWeights[1]),
      itemBest: pct(s.officeItemWeights[2]),
      itemInterview: pct(s.officeItemWeights[3]),
      itemCcArta: pct(s.focalItemWeights[0]),
      itemInnovation: pct(s.focalItemWeights[1]),
      itemResponsive: pct(s.focalItemWeights[2]),
      itemProfessionalism: pct(s.focalItemWeights[3]),
      itemCommunication: pct(s.focalItemWeights[4]),
    });
    setLoaded(true);
  }, [snap, loaded]);

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="notice error">{error}</div>;
  if (!snap) return <p>No data yet.</p>;
  if (!snap.connected || !snap.settings) {
    return (
      <div className="notice">
        <b>Not connected to the database yet.</b> Add <code>TURSO_DATABASE_URL</code> and{" "}
        <code>TURSO_AUTH_TOKEN</code> in Vercel and redeploy.
      </div>
    );
  }

  async function save() {
    setBusy(true);
    setSaving(true);
    setMsg(null);
    const cells: { key: string; value: string | number }[] = [];
    for (const f of ALL_FIELDS) {
      const raw = (values[f.key] ?? "").trim();
      if (raw === "") continue;
      if (f.kind === "text") cells.push({ key: f.key, value: raw });
      else {
        const n = parseFloat(raw);
        if (!Number.isFinite(n)) continue;
        cells.push({ key: f.key, value: f.kind === "pct" ? n / 100 : n });
      }
    }
    if (cells.length === 0) {
      setMsg({ text: "Nothing to save.", ok: false });
      setBusy(false);
      setSaving(false);
      return;
    }
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cells }),
    });
    setBusy(false);
    setSaving(false);
    if (res.ok) {
      setMsg({ text: "Settings saved to the sheet. Every formula follows the new values.", ok: true });
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ text: data.error || "Could not save.", ok: false });
    }
  }

  function FieldGroup({ title, fields }: { title: string; fields: Field[] }) {
    return (
      <div className="card">
        <h3>{title}</h3>
        <div className="field-row">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type={f.kind === "text" ? "text" : "number"}
                step={f.step || "any"}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p>Change a value once and every formula on the sheet follows. Weights are percentages; each track must total 100%.</p>
        </div>
        <span className="freshness">{freshnessText(lastSynced)}</span>
      </div>

      <FieldGroup title="Validators — who rates the top 5" fields={NAME_FIELDS} />
      <FieldGroup title="Initial evaluation weights" fields={WEIGHT_FIELDS} />
      <FieldGroup title="Final mix" fields={MIX_FIELDS} />
      <FieldGroup title="Rules" fields={RULE_FIELDS} />
      <FieldGroup title="Timeliness — days to submit → score" fields={TIME_FIELDS} />
      <FieldGroup title="Validator item weights" fields={ITEM_FIELDS} />

      {msg && <div className={`notice ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      <button className="btn" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save settings to sheet"}
      </button>

      <div className="card">
        <h3>Offices</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Office</th>
              <th>Track</th>
              <th>Focal person</th>
            </tr>
          </thead>
          <tbody>
            {snap.offices.map((o) => (
              <tr key={o.code}>
                <td>{o.code}</td>
                <td>{o.name}</td>
                <td>{o.track}</td>
                <td>
                  {o.focal || "—"}
                  {o.focalPosition ? ` — ${o.focalPosition}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
