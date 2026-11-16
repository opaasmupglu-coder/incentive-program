"use client";
import { memo, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { downloadCsv } from "@/lib/export";
import { fmtPct, freshnessText, useSnapshot } from "@/components/useSnapshot";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
  SectionHead,
} from "@/components/ui";
import type { InitialRow } from "@/lib/types";

const sortRows = (rows: InitialRow[]) =>
  [...rows].sort((a, b) => {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return b.total - a.total;
  });

const RankingTable = memo(function RankingTable({
  rows,
  top5,
}: {
  rows: InitialRow[];
  top5: Set<string>;
}) {
  if (rows.length === 0) {
    return <p className="muted">No offices in this track yet.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="num">Rank</th>
            <th>Office</th>
            <th className="num">Total</th>
            <th className="num">Resolution</th>
            <th className="num">Collection</th>
            <th className="num">GPR</th>
            <th className="num">Timeliness</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const complete = r.status.startsWith("✓");
            const isTop5 = top5.has(r.code);
            return (
              <tr key={r.code} className={isTop5 ? "top5-row" : undefined}>
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
                  {isTop5 && (
                    <>
                      {" "}
                      <span className="top5-mark">Top 5</span>
                    </>
                  )}
                </td>
                <td className="num">
                  <b>{r.total !== null ? fmtPct(r.total) : "—"}</b>
                </td>
                <td className="num">
                  {fmtPct(r.resolution)}{" "}
                  <span className="sub">· {r.resolutionMonths ?? "—"} mo</span>
                </td>
                <td className="num">
                  {fmtPct(r.collection)}{" "}
                  <span className="sub">· {r.collectionMonths ?? "—"} mo</span>
                </td>
                <td className="num">
                  {r.gpr !== null ? r.gpr.toFixed(1) : "—"}{" "}
                  <span className="sub">· {r.gprMonths ?? "—"} mo</span>
                </td>
                <td className="num">
                  {r.timeliness !== null ? r.timeliness.toFixed(2) : "—"}{" "}
                  <span className="sub">· {r.timelinessMonths ?? "—"} mo</span>
                </td>
                <td>
                  {complete ? (
                    <span className="status-done">Complete</span>
                  ) : (
                    <span className="status-wait">{r.status}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default function RankingsPage() {
  const { snap, loading, error, lastSynced } = useSnapshot();
  const [track, setTrack] = useState("Frontline");
  const [query, setQuery] = useState("");

  const sortedFL = useMemo(
    () => (snap ? sortRows(snap.initialFL) : []),
    [snap],
  );
  const sortedNFL = useMemo(
    () => (snap ? sortRows(snap.initialNFL) : []),
    [snap],
  );
  const top5FL = useMemo(
    () =>
      new Set(
        snap
          ? snap.validatorAvg
              .slice(0, 5)
              .map((r) => r.code)
              .filter(Boolean)
          : [],
      ),
    [snap],
  );
  const top5NFL = useMemo(
    () =>
      new Set(
        snap
          ? snap.validatorAvg
              .slice(5, 10)
              .map((r) => r.code)
              .filter(Boolean)
          : [],
      ),
    [snap],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState what="No data yet" />;
  if (!snap.connected) {
    return (
      <>
        <PageHead
          kicker="Section 03"
          title="Rankings & Top 5"
          description="Initial results for every office. The top 5 per track go to validation."
          right={<span className="freshness">{freshnessText(lastSynced)}</span>}
        />
        <NotConnected missingEnv={snap.missingEnv} />
      </>
    );
  }

  return (
    <>
      <PageHead
        kicker="Section 03"
        title="Rankings & Top 5"
        description="Initial results for every office. The top 5 per track go to validation."
        right={
          <button
            className="btn secondary"
            onClick={() =>
              downloadCsv("initial-rankings-2026.csv", [
                [
                  "Track",
                  "Rank",
                  "Office",
                  "Initial score",
                  "Resolution",
                  "Collection",
                  "GPR",
                  "Timeliness",
                  "Status",
                ],
                ...[
                  ...sortedFL.map((r) => ({ ...r, track: "Frontline" })),
                  ...sortedNFL.map((r) => ({ ...r, track: "Non-frontline" })),
                ].map((r) => [
                  r.track,
                  r.rank,
                  r.name,
                  r.total,
                  r.resolution,
                  r.collection,
                  r.gpr,
                  r.timeliness,
                  r.status,
                ]),
              ])
            }
          >
            <Icon name="download" size={15} />
            Export rankings
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
        <div className="search-field">
          <Icon name="search" size={15} />
          <input
            type="text"
            aria-label="Search rankings"
            placeholder="Find an office…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {track === "Frontline" && (
        <section className="section" aria-label="Frontline rankings">
          <SectionHead
            num="01"
            title="Frontline rankings"
            note="Highlighted offices qualify for validation"
          />
          <div className="section-body">
            <RankingTable
              rows={sortedFL.filter((r) =>
                `${r.name} ${r.code}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )}
              top5={top5FL}
            />
          </div>
        </section>
      )}

      {track === "Non-frontline" && (
        <section className="section" aria-label="Non-frontline rankings">
          <SectionHead
            num="02"
            title="Non-frontline rankings"
            note="Highlighted offices qualify for validation"
          />
          <div className="section-body">
            <RankingTable
              rows={sortedNFL.filter((r) =>
                `${r.name} ${r.code}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )}
              top5={top5NFL}
            />
          </div>
        </section>
      )}
    </>
  );
}
