"use client";
import { useMemo, useState } from "react";
import { FOCAL_ITEMS, OFFICE_ITEMS } from "@/lib/types";
import { fmtNum, freshnessText, useSnapshot } from "@/components/useSnapshot";
import { ErrorState, LoadingState, NotConnected, PageHead, SectionHead } from "@/components/ui";

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label style={{ margin: "6px 0 2px", fontSize: 13 }}>{label}</label>
      <select
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ScoresPage() {
  const { snap, loading, error, lastSynced, refresh, setSaving } = useSnapshot();
  const [track, setTrack] = useState<"Frontline" | "Non-frontline">("Frontline");
  const [drafts, setDrafts] = useState<Record<number, { office: (number | null)[]; focal: (number | null)[] }>>({});
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ row: number; text: string; ok: boolean } | null>(null);

  const avgRows = useMemo(
    () => (snap ? (track === "Frontline" ? snap.validatorAvg.slice(0, 5) : snap.validatorAvg.slice(5, 10)) : []),
    [snap, track]
  );
  const top5 = useMemo(() => avgRows.filter((r) => r.code), [avgRows]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState what="No data yet" />;
  if (!snap.connected) {
    return (
      <>
        <PageHead
          kicker="Section 04"
          title="Validator scores"
          description="Score the top 5 offices, 1–5 per item. Blank items stay blank — they don't count as zero."
          right={<span className="freshness">{freshnessText(lastSynced)}</span>}
        />
        <NotConnected missingEnv={snap.missingEnv} />
      </>
    );
  }

  const validatorNames = (snap.settings?.validatorNames || []).filter(Boolean);

  function draftFor(sheetRow: number, v: { officeScores: (number | null)[]; focalScores: (number | null)[] }) {
    return (
      drafts[sheetRow] || {
        office: [...v.officeScores],
        focal: [...v.focalScores],
      }
    );
  }

  function setDraft(sheetRow: number, kind: "office" | "focal", idx: number, val: number | null) {
    setDrafts((prev) => {
      const base = prev[sheetRow] || { office: [null, null, null, null], focal: [null, null, null, null, null] };
      const next = { office: [...base.office], focal: [...base.focal] };
      next[kind][idx] = val;
      return { ...prev, [sheetRow]: next };
    });
  }

  async function saveRow(v: {
    sheetRow: number;
    rank: number | null;
    validator: string;
    officeScores: (number | null)[];
    focalScores: (number | null)[];
  }) {
    if (v.rank === null) return;
    setBusyRow(v.sheetRow);
    setSaving(true);
    setMsg(null);
    const d = draftFor(v.sheetRow, v);
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        track,
        rank: v.rank,
        validator: v.validator,
        officeScores: d.office,
        focalScores: d.focal,
      }),
    });
    setBusyRow(null);
    setSaving(false);
    if (res.ok) {
      setMsg({ row: v.sheetRow, text: "Saved to the sheet.", ok: true });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[v.sheetRow];
        return next;
      });
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ row: v.sheetRow, text: data.error || "Could not save.", ok: false });
    }
  }

  return (
    <>
      <PageHead
        kicker="Section 04"
        title="Validator scores"
        description="Score the top 5 offices, 1–5 per item. Blank items stay blank — they don't count as zero."
        right={<span className="freshness">{freshnessText(lastSynced)}</span>}
      />

      <section className="section" aria-labelledby="pick-track">
        <SectionHead num="01" title="Pick a track" />
        <div className="section-body">
          <label htmlFor="track">Track</label>
          <select id="track" value={track} onChange={(e) => setTrack(e.target.value as typeof track)} style={{ maxWidth: 260 }}>
            <option value="Frontline">Frontline</option>
            <option value="Non-frontline">Non-frontline</option>
          </select>
        </div>
      </section>

      {top5.length === 0 && (
        <div className="notice" role="status">
          <span className="notice-kicker">Top 5 not ready</span>
          The top 5 {track === "Frontline" ? "Frontline" : "Non-frontline"} offices aren&apos;t determined yet — enter
          monthly numbers first so the Initial totals can rank the offices.
        </div>
      )}

      {top5.map((avg, idx) => {
        const rank = avgRows.indexOf(avg) + 1;
        const rows = snap.validators.filter(
          (v) => v.code === avg.code && (track === "Frontline" ? v.sheetRow <= 18 : v.sheetRow >= 19)
        );
        return (
          <section className="section" key={avg.code} aria-labelledby={`office-${avg.code}`}>
            <SectionHead
              num={String(idx + 2).padStart(2, "0")}
              title={`#${rank} — ${avg.name}`}
              note={`Office average ${avg.officeAvg !== null ? fmtNum(avg.officeAvg) : "—"} (${avg.officeRatedCount ?? 0}/3 rated) · Focal average ${avg.focalAvg !== null ? fmtNum(avg.focalAvg) : "—"} (${avg.focalRatedCount ?? 0}/3 rated)`}
            />
            <div className="section-body">
              {rows.map((v) => {
                const d = draftFor(v.sheetRow, v);
                return (
                  <div className="score-block" key={v.sheetRow}>
                    <b>{v.validator || "Validator"}</b>{" "}
                    <span className="sub">
                      Office total: {v.officeTotal !== null ? fmtNum(v.officeTotal) : "—"} · Focal total:{" "}
                      {v.focalTotal !== null ? fmtNum(v.focalTotal) : "—"}
                    </span>
                    <div className="score-grid">
                      {OFFICE_ITEMS.map((label, i) => (
                        <ScoreSelect
                          key={label}
                          label={`Office — ${label}`}
                          value={d.office[i]}
                          onChange={(val) => setDraft(v.sheetRow, "office", i, val)}
                        />
                      ))}
                      {FOCAL_ITEMS.map((label, i) => (
                        <ScoreSelect
                          key={label}
                          label={`Focal — ${label}`}
                          value={d.focal[i]}
                          onChange={(val) => setDraft(v.sheetRow, "focal", i, val)}
                        />
                      ))}
                    </div>
                    {msg && msg.row === v.sheetRow && (
                      <div className={`notice ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>
                        <span className="notice-kicker">{msg.ok ? "Saved" : "Error"}</span>
                        {msg.text}
                      </div>
                    )}
                    <button className="btn small" disabled={busyRow === v.sheetRow} onClick={() => saveRow(v)}>
                      {busyRow === v.sheetRow ? "Saving…" : `Save ${v.validator || "validator"} scores`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {snap.prevScores.length > 0 && (
        <section className="section" aria-labelledby="prev-scores">
          <SectionHead num="07" title="Previous round's scores (reference only)" />
          <div className="section-body">
            <p className="muted">These came from the old file and are not used by any formula.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Validator</th>
                    <th>Office</th>
                    <th className="num">CAR</th>
                    <th className="num">Onsite</th>
                    <th className="num">Best</th>
                    <th className="num">Interview</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.prevScores
                    .filter((p) => validatorNames.length === 0 || validatorNames.includes(p.validator))
                    .slice(0, 36)
                    .map((p, i) => (
                      <tr key={`${p.validator}-${p.code}-${i}`}>
                        <td>{p.validator}</td>
                        <td>{p.office}</td>
                        {p.scores.slice(0, 4).map((s, j) => (
                          <td key={j} className="num">
                            {s ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
