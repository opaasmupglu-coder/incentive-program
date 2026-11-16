"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MONTHS } from "@/lib/types";
import { fmtPct, freshnessText, useSnapshot } from "@/components/useSnapshot";
import { ErrorState, LoadingState, NotConnected, PageHead, SectionHead } from "@/components/ui";

type Criterion = "resolution" | "collection" | "gpr" | "timeliness";

const CRITERIA: { key: Criterion; label: string; firstLabel: string; secondLabel: string | null; hint: string }[] = [
  { key: "resolution", label: "Resolution", firstLabel: "Acted upon", secondLabel: "Total with action plans", hint: "Whole numbers. The rate is computed by the sheet." },
  { key: "collection", label: "Collection", firstLabel: "Forms collected", secondLabel: "Total clients", hint: "Whole numbers. The rate is computed by the sheet." },
  { key: "gpr", label: "General Performance Rating", firstLabel: "GPR (0–100)", secondLabel: null, hint: "A score from 0 to 100." },
  { key: "timeliness", label: "Action Plan Timeliness", firstLabel: "Days to submit", secondLabel: null, hint: "Leave blank if no plan was due. Type 99 if a plan was due but never submitted." },
];

export default function EnterPage() {
  const { snap, loading, error, lastSynced, refresh, setSaving } = useSnapshot();
  const [track, setTrack] = useState<"Frontline" | "Non-frontline">("Frontline");
  const [officeCode, setOfficeCode] = useState("");
  const [criterion, setCriterion] = useState<Criterion>("resolution");
  const [first, setFirst] = useState<(string)[]>(Array(10).fill(""));
  const [second, setSecond] = useState<(string)[]>(Array(10).fill(""));
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const offices = useMemo(
    () => (snap ? snap.offices.filter((o) => o.track === track) : []),
    [snap, track]
  );

  const prefillKey = useRef<string>("");

  // Prefill only when the office or criterion changes — never on the
  // 30-second background refresh, so in-progress typing is never wiped.
  useEffect(() => {
    if (!snap || !officeCode) return;
    const key = `${officeCode}|${criterion}`;
    if (prefillKey.current === key) return;
    prefillKey.current = key;
    const rows =
      criterion === "resolution"
        ? snap.inputResolution
        : criterion === "collection"
          ? snap.inputCollection
          : criterion === "gpr"
            ? snap.inputGpr
            : snap.inputTimeliness;
    const row = rows.find((r) => r.code === officeCode);
    if (!row) return;
    setFirst(row.first.map((v) => (v === null ? "" : String(v))));
    setSecond(row.second.map((v) => (v === null ? "" : String(v))));
  }, [snap, officeCode, criterion]);

  useEffect(() => {
    if (offices.length > 0 && !offices.some((o) => o.code === officeCode)) {
      setOfficeCode(offices[0].code);
    }
  }, [offices, officeCode]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState what="No data yet" />;
  if (!snap.connected) {
    return (
      <>
        <PageHead
          kicker="Section 02"
          title="Enter monthly numbers"
          description="Pick an office and a criterion, then fill in the months. Blank months keep what is already on the sheet."
          right={<span className="freshness">{freshnessText(lastSynced)}</span>}
        />
        <NotConnected missingEnv={snap.missingEnv} />
      </>
    );
  }

  const crit = CRITERIA.find((c) => c.key === criterion)!;
  const rows =
    criterion === "resolution"
      ? snap.inputResolution
      : criterion === "collection"
        ? snap.inputCollection
        : criterion === "gpr"
          ? snap.inputGpr
          : snap.inputTimeliness;
  const currentRow = rows.find((r) => r.code === officeCode);
  const office = snap.offices.find((o) => o.code === officeCode);

  async function save() {
    setBusy(true);
    setSaving(true);
    setSavedMsg(null);
    setSaveError(null);
    const toNum = (v: string): number | null => {
      if (v.trim() === "") return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const res = await fetch("/api/monthly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: officeCode,
        criterion,
        first: first.map(toNum),
        second: crit.secondLabel ? second.map(toNum) : [],
      }),
    });
    setBusy(false);
    setSaving(false);
    if (res.ok) {
      setSavedMsg("Saved to the sheet. Refreshing the numbers…");
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error || "Could not save.");
    }
  }

  return (
    <>
      <PageHead
        kicker="Section 02"
        title="Enter monthly numbers"
        description="Pick an office and a criterion, then fill in the months. Blank months keep what is already on the sheet."
        right={<span className="freshness">{freshnessText(lastSynced)}</span>}
      />

      <section className="section" aria-labelledby="pick-office">
        <SectionHead num="01" title="Pick an office" />
        <div className="section-body">
          <div className="field-row">
            <div>
              <label htmlFor="track">Track</label>
              <select id="track" value={track} onChange={(e) => setTrack(e.target.value as typeof track)}>
                <option value="Frontline">Frontline</option>
                <option value="Non-frontline">Non-frontline</option>
              </select>
            </div>
            <div>
              <label htmlFor="office">Office</label>
              <select id="office" value={officeCode} onChange={(e) => setOfficeCode(e.target.value)}>
                {offices.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="criterion">Criterion</label>
              <select id="criterion" value={criterion} onChange={(e) => setCriterion(e.target.value as Criterion)}>
                {CRITERIA.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {office && (
            <p>
              Focal person: <b>{office.focal || "—"}</b>
              {office.focalPosition ? ` — ${office.focalPosition}` : ""}
            </p>
          )}
          <p className="muted">{crit.hint}</p>
        </div>
      </section>

      <section className="section" aria-labelledby="months">
        <SectionHead num="02" title={`${office?.name || "Office"} — ${crit.label}`} />
        <div className="section-body">
          <div className="month-grid">
            {MONTHS.map((m, i) => (
              <div className="month-cell" key={m}>
                <b>{m.slice(0, 3)}</b>
                <label htmlFor={`f-${i}`} style={{ margin: "4px 0 2px", fontSize: 13 }}>
                  {crit.firstLabel}
                </label>
                <input
                  id={`f-${i}`}
                  type="number"
                  min={0}
                  value={first[i]}
                  onChange={(e) => setFirst((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                />
                {crit.secondLabel && (
                  <>
                    <label htmlFor={`s-${i}`} style={{ margin: "8px 0 2px", fontSize: 13 }}>
                      {crit.secondLabel}
                    </label>
                    <input
                      id={`s-${i}`}
                      type="number"
                      min={0}
                      value={second[i]}
                      onChange={(e) => setSecond((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                  </>
                )}
                {criterion !== "gpr" && currentRow && currentRow.computed[i] !== null && (
                  <div className="computed">
                    {criterion === "timeliness"
                      ? `Score: ${currentRow.computed[i]!.toFixed(2)}`
                      : `Rate: ${fmtPct(currentRow.computed[i])}`}
                  </div>
                )}
              </div>
            ))}
          </div>
          {savedMsg && (
            <div className="notice ok" role="status">
              <span className="notice-kicker">Saved</span>
              {savedMsg}
            </div>
          )}
          {saveError && (
            <div className="notice error" role="alert">
              <span className="notice-kicker">Error</span>
              {saveError}
            </div>
          )}
          <button className="btn" onClick={save} disabled={busy || !officeCode}>
            {busy ? "Saving…" : "Save to sheet"}
          </button>
        </div>
      </section>
    </>
  );
}
