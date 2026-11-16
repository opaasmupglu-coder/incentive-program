"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { downloadCsv } from "@/lib/export";
import { initialCriteria, initialPreview } from "@/lib/initial-preview";
import { fmtPct, useSnapshot } from "@/components/useSnapshot";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
} from "@/components/ui";

export default function RankingsPage() {
  const { snap, loading, error } = useSnapshot();
  const [track, setTrack] = useState("Frontline");
  const [query, setQuery] = useState("");
  const previews = useMemo(() => {
    const flWeights = snap?.settings?.flWeights || [0.35, 0.3, 0.2, 0.15];
    const nflWeights = snap?.settings?.nflWeights || [0.3, 0.2, 0.35, 0.15];
    const scale = snap?.settings?.gprMax || 100;
    return {
      frontline: initialPreview(snap?.initialFL || [], flWeights, scale),
      nonFrontline: initialPreview(snap?.initialNFL || [], nflWeights, scale),
    };
  }, [snap]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState />;
  const weights = (track === "Frontline"
    ? snap.settings?.flWeights
    : snap.settings?.nflWeights) || [0, 0, 0, 0];
  const rows =
    track === "Frontline" ? previews.frontline : previews.nonFrontline;
  const filtered = rows.filter((r) =>
    `${r.name} ${r.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  const provisional = rows.some((r) => r.provisional);
  const gprScale = snap.settings?.gprMax || 100;
  const completed = rows.filter((r) => r.total !== null).length;
  const pctNumber = (n: number | null) =>
    n === null ? null : Math.round(n * 1000000) / 10000;
  function exportRankings() {
    const data = [
      {
        track: "Frontline",
        rows: previews.frontline,
        weights: snap?.settings?.flWeights || [0, 0, 0, 0],
      },
      {
        track: "Non-frontline",
        rows: previews.nonFrontline,
        weights: snap?.settings?.nflWeights || [0, 0, 0, 0],
      },
    ].flatMap((group) =>
      group.rows.map((r) => {
        const criteria = initialCriteria(r, group.weights, gprScale);
        return [
          group.track,
          r.displayRank,
          r.name,
          pctNumber(r.displayTotal),
          r.provisional ? "Provisional" : "Complete",
          ...criteria.flatMap((c) => [
            pctNumber(c.weighted),
            pctNumber(c.actual),
          ]),
          r.entered,
          r.previewTop5 ? "Yes" : "No",
        ];
      }),
    );
    downloadCsv("initial-rankings-2026.csv", [
      [
        "Track",
        "Preview rank",
        "Office",
        "Running initial total (%)",
        "Status",
        "Resolution weighted (%)",
        "Resolution actual (%)",
        "Collection weighted (%)",
        "Collection actual (%)",
        "GPR weighted (%)",
        "GPR actual (%)",
        "Timeliness weighted (%)",
        "Timeliness actual (%)",
        "Criteria entered",
        "Preview top 5",
      ],
      ...data,
    ]);
  }
  return (
    <>
      <PageHead
        kicker="Initial evaluation"
        title="Initial rankings & Top 5"
        description="See running initial scores as monthly data comes in. Totals with missing criteria are provisional."
        right={
          <button
            className="btn secondary"
            onClick={exportRankings}
            disabled={!snap.connected}
          >
            <Icon name="download" size={15} />
            Export rankings
          </button>
        }
      />
      {!snap.connected ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <div className="toolbar rankings-toolbar">
            <div className="segmented" aria-label="Ranking track">
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
            <div className="search-field">
              <Icon name="search" size={16} />
              <input
                type="text"
                aria-label="Search rankings"
                placeholder="Find an office"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <p className="rankings-explanation">
            <strong>How to read the scores:</strong> weighted score{" "}
            <span className="actual-percentage">(actual average)</span>. Missing
            criteria stay blank and are omitted from the running total.
          </p>
          <section
            className="section ranking-results"
            aria-label={`${track} rankings`}
          >
            <div className="section-head">
              <h3>{track} initial rankings</h3>
              <p>
                {completed} of {rows.length} offices have all four criteria
              </p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">Rank</th>
                    <th>Office</th>
                    <th className="num">Initial total</th>
                    {["Resolution", "Collection", "GPR", "Timeliness"].map(
                      (name, i) => (
                        <th key={name} className="num">
                          {name}
                          <span className="criterion-weight">
                            {fmtPct(weights[i], 0)} weight
                          </span>
                        </th>
                      ),
                    )}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const criteria = initialCriteria(r, weights, gprScale);
                    const months = [
                      r.resolutionMonths,
                      r.collectionMonths,
                      r.gprMonths,
                      r.timelinessMonths,
                    ];
                    return (
                      <tr
                        key={r.code}
                        className={r.previewTop5 ? "top5-row" : ""}
                      >
                        <td className="num">
                          <span className="rank-num">
                            {r.displayRank === null ? (
                              "—"
                            ) : (
                              <>
                                <span className="hash">#</span>
                                {r.displayRank}
                              </>
                            )}
                          </span>
                        </td>
                        <td>
                          <b>{r.name}</b>
                          {r.previewTop5 && (
                            <span className="top5-mark">
                              {provisional ? "Top 5 · preview" : "Top 5"}
                            </span>
                          )}
                        </td>
                        <td className="num running-total">
                          <b>{fmtPct(r.displayTotal)}</b>
                          {r.provisional && r.displayTotal !== null && (
                            <span className="provisional-note">
                              Provisional
                            </span>
                          )}
                        </td>
                        {criteria.map((criterion, i) => (
                          <td
                            key={i}
                            className="num criterion-result"
                            title={`Based on ${months[i] ?? 0} reporting months`}
                          >
                            {criterion.actual === null ? (
                              "—"
                            ) : (
                              <>
                                <b>{fmtPct(criterion.weighted)}</b>{" "}
                                <span className="actual-percentage">
                                  ({fmtPct(criterion.actual)})
                                </span>
                              </>
                            )}
                          </td>
                        ))}
                        <td>
                          <span
                            className={`badge ${!r.provisional ? "green" : r.entered ? "amber" : "neutral"}`}
                          >
                            {!r.provisional
                              ? "Complete"
                              : r.entered === 4
                                ? "Pending monthly counts"
                                : `${r.entered} of 4 criteria`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="empty-state">No offices match your search.</div>
            )}
            <div className="table-foot">
              <span>{filtered.length} offices shown</span>
              <span>
                Highlighted: current {provisional ? "provisional " : ""}Top 5
              </span>
            </div>
          </section>
          {provisional && (
            <div className="rankings-footnote">
              <Icon name="help" size={17} />
              <p>
                This preview updates as you enter scores. An office still needs
                all four criteria before it qualifies for validator ratings.{" "}
                <Link href="/enter">Continue entering monthly scores →</Link>
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
