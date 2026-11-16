"use client";
import { memo, useMemo } from "react";
import { fmtNum, fmtPct, freshnessText, useSnapshot } from "@/components/useSnapshot";
import { ErrorState, LoadingState, NotConnected, PageHead, SectionHead } from "@/components/ui";
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
}: {
  rows: FinalRow[];
  kind: "office" | "focal";
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
            <th className="num">Initial × 60%</th>
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
              </td>
              <td className="num">
                <b>{r.finalTotal !== null ? fmtPct(r.finalTotal) : "—"}</b>
              </td>
              <td className="num">{fmtPct(r.initialTotal)}</td>
              <td className="num">{r.initial60 !== null ? fmtNum(r.initial60) : "—"}</td>
              <td className="num">{r.validatorAvg !== null ? fmtNum(r.validatorAvg) : "—"}</td>
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

  const flOffices = useMemo(() => (snap ? sortFinals(snap.finalFL.offices) : []), [snap]);
  const flFocals = useMemo(() => (snap ? sortFinals(snap.finalFL.focals) : []), [snap]);
  const nflOffices = useMemo(() => (snap ? sortFinals(snap.finalNFL.offices) : []), [snap]);
  const nflFocals = useMemo(() => (snap ? sortFinals(snap.finalNFL.focals) : []), [snap]);

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
        description="60% Initial + validator score, ranked among the top 5. Offices and focal persons are scored separately."
        right={<span className="freshness">{freshnessText(lastSynced)}</span>}
      />

      <section className="section" aria-labelledby="final-fl-o">
        <SectionHead num="01" title="Frontline — Offices" />
        <div className="section-body">
          <FinalTable rows={flOffices} kind="office" />
        </div>
      </section>

      <section className="section" aria-labelledby="final-fl-f">
        <SectionHead num="02" title="Frontline — Focal persons" />
        <div className="section-body">
          <FinalTable rows={flFocals} kind="focal" />
        </div>
      </section>

      <section className="section" aria-labelledby="final-nfl-o">
        <SectionHead num="03" title="Non-frontline — Offices" />
        <div className="section-body">
          <FinalTable rows={nflOffices} kind="office" />
        </div>
      </section>

      <section className="section" aria-labelledby="final-nfl-f">
        <SectionHead num="04" title="Non-frontline — Focal persons" />
        <div className="section-body">
          <FinalTable rows={nflFocals} kind="focal" />
        </div>
      </section>
    </>
  );
}
