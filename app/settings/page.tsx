"use client";
import { useEffect, useState } from "react";
import { useSnapshot } from "@/components/useSnapshot";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
  SectionHead,
} from "@/components/ui";

type Field = {
  key: string;
  label: string;
  kind: "text" | "pct" | "num";
  step?: string;
};

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
const MIX_FIELDS: Field[] = [
  { key: "finalInitialWeight", label: "Initial result weight %", kind: "pct" },
];
const RULE_FIELDS: Field[] = [
  {
    key: "sampleConstant",
    label: "Sample-size constant",
    kind: "num",
    step: "0.01",
  },
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

const ALL_FIELDS = [
  ...NAME_FIELDS,
  ...WEIGHT_FIELDS,
  ...MIX_FIELDS,
  ...RULE_FIELDS,
  ...TIME_FIELDS,
  ...ITEM_FIELDS,
];
const GROUPS: { num: string; title: string; fields: Field[] }[] = [
  { num: "01", title: "Validators — who rates the top 5", fields: NAME_FIELDS },
  { num: "02", title: "Initial evaluation weights", fields: WEIGHT_FIELDS },
  { num: "03", title: "Final mix", fields: MIX_FIELDS },
  { num: "04", title: "Rules", fields: RULE_FIELDS },
  {
    num: "05",
    title: "Timeliness — days to submit → score",
    fields: TIME_FIELDS,
  },
  { num: "06", title: "Validator item weights", fields: ITEM_FIELDS },
];

export default function SettingsPage() {
  const { snap, loading, error, refresh, setSaving } = useSnapshot();
  const [values, setValues] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Validators");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!snap?.settings || loaded) return;
    const s = snap.settings;
    const pct = (v: number | null) =>
      v === null ? "" : String(Math.round(v * 1000) / 10);
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
  useEffect(() => {
    if (loaded && Object.keys(original).length === 0) setOriginal(values);
  }, [loaded, values, original]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState />;
  const dirty = JSON.stringify(values) !== JSON.stringify(original);
  const groups =
    tab === "Validators"
      ? GROUPS.filter((g) => g.num === "01")
      : tab === "Evaluation weights"
        ? GROUPS.filter((g) => ["02", "03", "06"].includes(g.num))
        : GROUPS.filter((g) => ["04", "05"].includes(g.num));
  async function save() {
    const numeric = ALL_FIELDS.filter((f) => f.kind !== "text");
    if (
      numeric.some(
        (f) =>
          values[f.key]?.trim() === "" ||
          !Number.isFinite(Number(values[f.key])) ||
          Number(values[f.key]) < 0,
      )
    ) {
      setMsg({
        text: "Complete every numeric setting with a non-negative value.",
        ok: false,
      });
      return;
    }
    if (
      ALL_FIELDS.some((f) => f.kind === "pct" && Number(values[f.key]) > 100)
    ) {
      setMsg({ text: "Percentages must be between 0 and 100.", ok: false });
      return;
    }
    for (const prefix of ["fl", "nfl"]) {
      const sum = ["Res", "Coll", "Gpr", "Time"].reduce(
        (s, k) => s + Number(values[prefix + k]),
        0,
      );
      if (Math.abs(sum - 100) > 0.001) {
        setMsg({
          text: `${prefix === "fl" ? "Frontline" : "Non-frontline"} evaluation weights must total 100% (currently ${sum}%).`,
          ok: false,
        });
        return;
      }
    }
    if (
      Number(values.sampleConstant) <= 0 ||
      Number(values.gprMax) !== 100 ||
      Number(values.validatorScale) !== 5
    ) {
      setMsg({
        text: "The sample constant must be positive. This program uses a GPR scale of 100 and validator scale of 5.",
        ok: false,
      });
      return;
    }
    const names = NAME_FIELDS.map((f) => values[f.key].trim());
    if (names.some((v) => !v) || new Set(names).size !== names.length) {
      setMsg({ text: "Enter three different validator names.", ok: false });
      return;
    }
    const initial = Number(values.finalInitialWeight);
    for (const fields of [ITEM_FIELDS.slice(0, 4), ITEM_FIELDS.slice(4)]) {
      const total = fields.reduce((s, f) => s + Number(values[f.key]), 0);
      if (Math.abs(initial + total - 100) > 0.001) {
        setMsg({
          text: `Each validator group’s item weights plus the initial result weight must total 100%. Current total: ${initial + total}%.`,
          ok: false,
        });
        return;
      }
    }
    if (TIME_FIELDS.some((f) => Number(values[f.key]) > 1)) {
      setMsg({
        text: "Timeliness band scores must be from 0 to 1.",
        ok: false,
      });
      return;
    }
    setBusy(true);
    setSaving(true);
    setMsg(null);
    try {
      const cells = ALL_FIELDS.map((f) => ({
        key: f.key,
        value:
          f.kind === "text"
            ? values[f.key].trim()
            : Number(values[f.key]) / (f.kind === "pct" ? 100 : 1),
      }));
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save settings.");
      await refresh();
      setOriginal(values);
      setMsg({
        text: "Program settings saved. Scores and rankings now use these values.",
        ok: true,
      });
    } catch (e) {
      setMsg({
        text:
          e instanceof Error ? e.message : "Could not save. Please try again.",
        ok: false,
      });
    } finally {
      setBusy(false);
      setSaving(false);
    }
  }
  return (
    <>
      <PageHead
        kicker="Make it work for your program"
        title="Program settings"
        description="Manage validators, evaluation weights, and scoring rules. Your changes apply across the program."
      />
      {!snap.connected || !snap.settings ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <div className="settings-help">
            <b>Looking for focal persons or working days?</b>
            <p>
              <a href="/offices">Manage offices & people →</a> ·{" "}
              <a href="/calendar">View the working-day calendar →</a>
            </p>
          </div>
          <div className="tabs" style={{ marginTop: 22 }}>
            {["Validators", "Evaluation weights", "Scoring rules"].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {groups.map((g) => (
            <section className="section" key={g.num}>
              <SectionHead num={g.num} title={g.title} />
              <div className="section-body">
                <div className="field-row">
                  {g.fields.map((f) => (
                    <div key={f.key}>
                      <label htmlFor={f.key}>{f.label}</label>
                      <input
                        id={f.key}
                        disabled={
                          busy || ["validatorScale", "gprMax"].includes(f.key)
                        }
                        type={f.kind === "text" ? "text" : "number"}
                        min={f.kind === "text" ? undefined : 0}
                        max={f.kind === "pct" ? 100 : undefined}
                        step={f.step || "any"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => {
                          setValues((p) => ({ ...p, [f.key]: e.target.value }));
                          setMsg(null);
                        }}
                      />
                    </div>
                  ))}
                </div>
                {g.num === "02" && (
                  <p
                    className="muted"
                    style={{ fontSize: 11, margin: "18px 0 0" }}
                  >
                    Each track must total 100%. Frontline:{" "}
                    {["Res", "Coll", "Gpr", "Time"].reduce(
                      (s, k) => s + Number(values["fl" + k] || 0),
                      0,
                    )}
                    % · Non-frontline:{" "}
                    {["Res", "Coll", "Gpr", "Time"].reduce(
                      (s, k) => s + Number(values["nfl" + k] || 0),
                      0,
                    )}
                    %
                  </p>
                )}
              </div>
            </section>
          ))}
          {msg && (
            <div
              className={`notice ${msg.ok ? "ok" : "error"}`}
              role={msg.ok ? "status" : "alert"}
            >
              {msg.text}
            </div>
          )}
          <div className="save-bar">
            <p>
              {dirty
                ? "You have unsaved program settings."
                : "Your program settings are up to date."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn secondary"
                disabled={busy || !dirty}
                onClick={() => {
                  setValues(original);
                  setMsg(null);
                }}
              >
                Discard changes
              </button>
              <button className="btn" disabled={busy || !dirty} onClick={save}>
                {busy ? "Saving…" : "Save program settings"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
