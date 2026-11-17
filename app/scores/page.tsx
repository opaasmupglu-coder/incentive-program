"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OFFICE_ITEMS, FOCAL_ITEMS } from "@/lib/types";
import { officeTotal, focalTotal } from "@/lib/compute";
import { fmtPct, useSnapshot } from "@/components/useSnapshot";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
} from "@/components/ui";
import Icon from "@/components/Icon";
type Draft = { office: (number | null)[]; focal: (number | null)[] };
export default function ScoresPage() {
  const { snap, loading, error, refresh, setSaving } = useSnapshot();
  const [track, setTrack] = useState<"Frontline" | "Non-frontline">(
    "Frontline",
  );
  const [selectedOffice, setSelectedOffice] = useState("");
  const [selectedValidator, setSelectedValidator] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState />;
  const top5 = snap.validatorAvg.filter((row) =>
    snap.offices.some((o) => o.code === row.code && o.track === track),
  );
  const office = top5.find((o) => o.code === selectedOffice) || top5[0];
  const validatorNames = snap.settings?.validatorNames.filter(Boolean) || [];
  const validator = validatorNames.includes(selectedValidator)
    ? selectedValidator
    : validatorNames[0];
  const row = snap.validators.find(
    (v) => v.code === office?.code && v.validator === validator,
  );
  const key = `${office?.code}|${validator}`;
  const draft = drafts[key] || {
    office: row?.officeScores || Array(4).fill(null),
    focal: row?.focalScores || Array(5).fill(null),
  };
  const filled = [...draft.office, ...draft.focal].filter(
    (v) => v !== null,
  ).length;
  const liveOffice = officeTotal(
    draft.office,
    snap.settings?.officeItemWeights || [0.1, 0.1, 0.1, 0.1],
    snap.settings?.validatorScale || 5,
  );
  const liveFocal = focalTotal(
    draft.focal,
    snap.settings?.focalItemWeights || [0.1, 0.1, 0.1, 0.05, 0.05],
    snap.settings?.validatorScale || 5,
  );
  function setScore(
    kind: "office" | "focal",
    index: number,
    value: number | null,
  ) {
    setDrafts((p) => ({
      ...p,
      [key]: {
        office: [...draft.office],
        focal: [...draft.focal],
        [kind]: draft[kind].map((v, i) => (i === index ? value : v)),
      },
    }));
    setMessage(null);
  }
  async function save() {
    if (!row || row.rank === null) return;
    setBusy(true);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track,
          rank: row.rank,
          code: office.code,
          validator,
          officeScores: draft.office,
          focalScores: draft.focal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save scores.");
      await refresh();
      setDrafts((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      setMessage({
        text: `${validator}’s scores saved for ${office?.name}. Progress and final results have been updated.`,
        ok: true,
      });
    } catch (e) {
      setMessage({
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
        kicker="Final evaluation"
        title="Validator ratings"
        description="Select an office and validator, then click a score from 1 to 5."
        right={
          <Link className="btn secondary" href="/finals">
            View final results <Icon name="arrow" size={14} />
          </Link>
        }
      />
      {!snap.connected ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <section
            className="section validator-picker"
            aria-label="Choose evaluation"
          >
            <div className="score-picker-row">
              <span className="score-picker-label">Track</span>
              <div className="score-options" role="group" aria-label="Track">
                {(["Frontline", "Non-frontline"] as const).map((t) => (
                  <button
                    key={t}
                    disabled={busy}
                    aria-pressed={track === t}
                    className={track === t ? "selected" : ""}
                    onClick={() => {
                      setTrack(t);
                      setSelectedOffice("");
                      setMessage(null);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="score-picker-row">
              <span className="score-picker-label">Top 5 office</span>
              <div
                className="score-options office-options"
                role="group"
                aria-label="Top 5 office"
              >
                {!top5.length && <p>No offices ready yet</p>}
                {top5.map((o, i) => (
                  <button
                    key={o.code}
                    disabled={busy}
                    aria-pressed={office?.code === o.code}
                    className={office?.code === o.code ? "selected" : ""}
                    title={o.name}
                    onClick={() => {
                      setSelectedOffice(o.code);
                      setMessage(null);
                    }}
                  >
                    <span className="office-option-rank">{i + 1}</span>
                    {snap.offices.find((item) => item.code === o.code)?.short ||
                      o.name}
                    {Object.keys(drafts).some((key) =>
                      key.startsWith(`${o.code}|`),
                    ) && (
                      <span
                        className="draft-dot"
                        aria-label="Unsaved ratings"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="score-picker-row">
              <span className="score-picker-label">Validator</span>
              <div
                className="score-options"
                role="group"
                aria-label="Validator"
              >
                {!validatorNames.length && (
                  <p>Add validators in Program settings to begin.</p>
                )}
                {validatorNames.map((v) => (
                  <button
                    key={v}
                    disabled={busy}
                    aria-pressed={validator === v}
                    className={validator === v ? "selected" : ""}
                    onClick={() => {
                      setSelectedValidator(v);
                      setMessage(null);
                    }}
                  >
                    {v}
                    {drafts[`${office?.code}|${v}`] && (
                      <span
                        className="draft-dot"
                        aria-label="Unsaved ratings"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>
          {!office ? (
            <div className="empty-state section">
              <Icon name="check" size={32} />
              <b>The next stage starts with monthly scores.</b>
              <p>
                The current Top 5 appear here as initial scores are entered.
              </p>
              <Link className="btn" href="/enter">
                Enter monthly scores <Icon name="arrow" size={15} />
              </Link>
            </div>
          ) : (
            <>
              <div className="panel-title" style={{ margin: "24px 0 16px" }}>
                <div>
                  <h3>{office.name}</h3>
                  <p>
                    {snap.offices.find((o) => o.code === office.code)?.focal ||
                      "No focal person assigned"}{" "}
                    · {validator}
                  </p>
                </div>
                <span className={`badge ${filled === 9 ? "green" : "amber"}`}>
                  {filled}/9 items rated
                </span>
              </div>
              <div className="rating-panels validator-rating-panels">
                {[
                  {
                    kind: "office" as const,
                    title: "Office evaluation",
                    icon: "building",
                    items: OFFICE_ITEMS,
                    total: liveOffice,
                  },
                  {
                    kind: "focal" as const,
                    title: "Focal person evaluation",
                    icon: "people",
                    items: FOCAL_ITEMS,
                    total: liveFocal,
                  },
                ].map((group) => (
                  <section className="section" key={group.kind}>
                    <div className="section-head">
                      <Icon name={group.icon} size={17} />
                      <h3>{group.title}</h3>
                      <p>{fmtPct(group.total)} weighted score</p>
                    </div>
                    <div className="section-body">
                      <div className="rating-legend">
                        <span>1 · Lowest</span>
                        <span>5 · Highest</span>
                      </div>
                      {group.items.map((item, i) => (
                        <fieldset className="rating-item" key={item}>
                          <legend>{item}</legend>
                          <div className="rating-buttons">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                disabled={busy || !row}
                                aria-label={`${group.kind === "office" ? "Office" : "Focal person"} ${item}: ${n}`}
                                aria-pressed={draft[group.kind][i] === n}
                                className={
                                  draft[group.kind][i] === n ? "selected" : ""
                                }
                                onClick={() => setScore(group.kind, i, n)}
                              >
                                {n}
                              </button>
                            ))}
                            <button
                              className="clear-score"
                              disabled={busy || draft[group.kind][i] === null}
                              aria-label={`Clear ${group.kind} ${item} score`}
                              onClick={() => setScore(group.kind, i, null)}
                            >
                              <Icon name="close" size={13} />
                            </button>
                          </div>
                        </fieldset>
                      ))}
                      <div className="tip">
                        <Icon name="help" size={16} />
                        <p>
                          Unrated items stay blank. They count as missing, never
                          as zero.
                        </p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
              {message && (
                <div
                  className={`notice ${message.ok ? "ok" : "error"}`}
                  role={message.ok ? "status" : "alert"}
                >
                  {message.text}
                </div>
              )}
              <div className="save-bar">
                <p>
                  {drafts[key]
                    ? "Unsaved ratings · you can save a partial evaluation and return later."
                    : "Drafts stay here when you switch offices or validators. Save each evaluation when ready."}
                </p>
                <button
                  className="btn"
                  disabled={busy || !drafts[key] || !row}
                  onClick={save}
                >
                  <Icon name="check" size={15} />
                  {busy ? "Saving…" : "Save validator scores"}
                </button>
              </div>
              <details className="section overview-guide">
                <summary>
                  <Icon name="check" size={17} />
                  <span>View validation progress · {track}</span>
                  <Icon name="down" size={15} />
                </summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Office</th>
                        {validatorNames.map((v) => (
                          <th key={v}>{v}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {top5.map((o) => (
                        <tr key={o.code}>
                          <td>
                            <b>{o.name}</b>
                          </td>
                          {validatorNames.map((v) => {
                            const r = snap.validators.find(
                              (r) => r.code === o.code && r.validator === v,
                            );
                            const count = [
                              ...(r?.officeScores || []),
                              ...(r?.focalScores || []),
                            ].filter((v) => v !== null).length;
                            return (
                              <td key={v}>
                                <button
                                  className={`progress-rating ${count === 9 ? "complete" : ""}`}
                                  disabled={busy}
                                  onClick={() => {
                                    setSelectedOffice(o.code);
                                    setSelectedValidator(v);
                                    setMessage(null);
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }}
                                >
                                  {count}/9 rated{" "}
                                  <Icon name="arrow" size={12} />
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </>
  );
}
