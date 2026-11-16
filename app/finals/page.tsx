"use client";
import { memo, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { downloadCsv } from "@/lib/export";
import {
  fmtNum,
  fmtPct,
  freshnessText,
  useSnapshot,
} from "@/components/useSnapshot";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
  SectionHead,
} from "@/components/ui";
import type { FinalRow } from "@/lib/types";

const sortFinals = (rows: FinalRow[]) =>
  [...rows].sort((a, b) => {
    if (a.finalTotal === null && b.finalTotal === null) return 0;
    if (a.finalTotal === null) return 1;
    if (b.finalTotal === null) return -1;
    return b.finalTotal - a.finalTotal;
  });

const FinalTable = memo(function FinalTable({
  rows,
  kind,
  initialWeight,
}: {
  rows: FinalRow[];
  kind: "office" | "focal";
  initialWeight: number;
}) {
  if (rows.length === 0) {
    return <p className="muted">No final results in this group yet.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="num">Rank</th>
            <th>{kind === "office" ? "Office" : "Focal person"}</th>
            <th className="num">Final total</th>
            <th className="num">Initial total</th>
            <th className="num">
              Initial × {Math.round(initialWeight * 100)}%
            </th>
            <th className="num">Validator average</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="num">
                {r.rank !== null ? (
                  <span className="rank-num">
                    <span className="hash">#</span>
                    {r.rank}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <b>{r.name}</b>
                {r.officeName && <span className="sub">{r.officeName}</span>}
              </td>
              <td className="num">
                <b>{r.finalTotal !== null ? fmtPct(r.finalTotal) : "—"}</b>
              </td>
              <td className="num">{fmtPct(r.initialTotal)}</td>
              <td className="num">
                {r.initial60 !== null ? fmtNum(r.initial60) : "—"}
              </td>
              <td className="num">
                {r.validatorAvg !== null ? fmtNum(r.validatorAvg) : "—"}
              </td>
              <td>
                {r.finalTotal !== null ? (
                  <span className="status-done">Final</span>
                ) : (
                  <span className="status-wait">{r.status || "Waiting"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default function FinalsPage() {
  const { snap, loading, error, lastSynced } = useSnapshot();
  const [track, setTrack] = useState("Frontline");
  const [kind, setKind] = useState("Offices");

  const flOffices = useMemo(
    () => (snap ? sortFinals(snap.finalFL.offices) : []),
    [snap],
  );
  const flFocals = useMemo(
    () => (snap ? sortFinals(snap.finalFL.focals) : []),
    [snap],
  );
  const nflOffices = useMemo(
    () => (snap ? sortFinals(snap.finalNFL.offices) : []),
    [snap],
  );
  const nflFocals = useMemo(
    () => (snap ? sortFinals(snap.finalNFL.focals) : []),
    [snap],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState what="No data yet" />;
  if (!snap.connected) {
    return (
      <>
        <PageHead
          kicker="Section 05"
          title="Final results"
          description="60% Initial + validator score, ranked among the top 5. Offices and focal persons are scored separately."
          right={<span className="freshness">{freshnessText(lastSynced)}</span>}
        />
        <NotConnected missingEnv={snap.missingEnv} />
      </>
    );
  }

  return (
    <>
      <PageHead
        kicker="Section 05"
        title="Final results"
        description={`${Math.round((snap.settings?.finalInitialWeight ?? 0.6) * 100)}% initial evaluation + weighted validator scores. Recognizing the top offices and focal persons in each track.`}
        right={
          <button
            className="btn secondary"
            onClick={() =>
              downloadCsv("final-results-2026.csv", [
                [
                  "Track",
                  "Category",
                  "Rank",
                  "Office / focal person",
                  "Initial score",
                  "Weighted initial",
                  "Validator average",
                  "Final score",
                  "Status",
                ],
                ...[
                  { track: "Frontline", kind: "Office", rows: flOffices },
                  { track: "Frontline", kind: "Focal person", rows: flFocals },
                  { track: "Non-frontline", kind: "Office", rows: nflOffices },
                  {
                    track: "Non-frontline",
                    kind: "Focal person",
                    rows: nflFocals,
                  },
                ].flatMap((g) =>
                  g.rows.map((r) => [
                    g.track,
                    g.kind,
                    r.rank,
                    r.name,
                    r.initialTotal,
                    r.initial60,
                    r.validatorAvg,
                    r.finalTotal,
                    r.status,
                  ]),
                ),
              ])
            }
          >
            <Icon name="download" size={15} />
            Export results
          </button>
        }
      />
      <div
        className="toolbar"
        style={{
          background: "white",
          border: "1px solid var(--line)",
          borderRadius: 9,
        }}
      >
        <div className="segmented">
          {["Frontline", "Non-frontline"].map((t) => (
            <button
              key={t}
              aria-pressed={track === t}
              className={track === t ? "selected" : ""}
              onClick={() => setTrack(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="segmented">
          {["Offices", "Focal persons"].map((k) => (
            <button
              key={k}
              aria-pressed={kind === k}
              className={kind === k ? "selected" : ""}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      {track === "Frontline" && kind === "Offices" && (
        <section className="section" aria-label="Frontline office results">
          <SectionHead num="01" title="Frontline — Offices" />
          <div className="section-body">
            <FinalTable
              rows={flOffices}
              kind="office"
              initialWeight={snap.settings?.finalInitialWeight ?? 0.6}
            />
          </div>
        </section>
      )}

      {track === "Frontline" && kind === "Focal persons" && (
        <section
          className="section"
          aria-label="Frontline focal person results"
        >
          <SectionHead num="02" title="Frontline — Focal persons" />
          <div className="section-body">
            <FinalTable
              rows={flFocals}
              kind="focal"
              initialWeight={snap.settings?.finalInitialWeight ?? 0.6}
            />
          </div>
        </section>
      )}

      {track === "Non-frontline" && kind === "Offices" && (
        <section className="section" aria-label="Non-frontline office results">
          <SectionHead num="03" title="Non-frontline — Offices" />
          <div className="section-body">
            <FinalTable
              rows={nflOffices}
              kind="office"
              initialWeight={snap.settings?.finalInitialWeight ?? 0.6}
            />
          </div>
        </section>
      )}

      {track === "Non-frontline" && kind === "Focal persons" && (
        <section
          className="section"
          aria-label="Non-frontline focal person results"
        >
          <SectionHead num="04" title="Non-frontline — Focal persons" />
          <div className="section-body">
            <FinalTable
              rows={nflFocals}
              kind="focal"
              initialWeight={snap.settings?.finalInitialWeight ?? 0.6}
            />
          </div>
        </section>
      )}
    </>
  );
}
