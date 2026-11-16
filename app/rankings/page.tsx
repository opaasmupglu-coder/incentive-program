"use client";
import { fmtPct, freshnessText, useSnapshot } from "@/components/useSnapshot";
import type { InitialRow } from "@/lib/types";

function OfficeCard({ row, isTop5 }: { row: InitialRow; isTop5: boolean }) {
  const complete = row.status.startsWith("✓");
  return (
    <div className={`card${isTop5 ? " top5" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{row.name}</h3>
        {row.rank !== null && <span className="rank-badge">#{row.rank}</span>}
      </div>
      <div className="big-number">{row.total !== null ? fmtPct(row.total) : "—"}</div>
      <p>
        {complete ? <span className="pill ok">✓ Complete</span> : <span className="pill warn">{row.status}</span>}{" "}
        {isTop5 && <span className="pill ok">TOP 5</span>}
      </p>
      <table>
        <tbody>
          <tr>
            <td>Resolution</td>
            <td className="num">{fmtPct(row.resolution)}</td>
            <td className="num">{row.resolutionMonths ?? "—"} mo</td>
          </tr>
          <tr>
            <td>Collection</td>
            <td className="num">{fmtPct(row.collection)}</td>
            <td className="num">{row.collectionMonths ?? "—"} mo</td>
          </tr>
          <tr>
            <td>General Performance</td>
            <td className="num">{row.gpr !== null ? row.gpr.toFixed(1) : "—"}</td>
            <td className="num">{row.gprMonths ?? "—"} mo</td>
          </tr>
          <tr>
            <td>Timeliness</td>
            <td className="num">{row.timeliness !== null ? row.timeliness.toFixed(2) : "—"}</td>
            <td className="num">{row.timelinessMonths ?? "—"} mo</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function RankingsPage() {
  const { snap, loading, error, lastSynced } = useSnapshot();

  if (loading) return <p>Loading…</p>;
  if (error) return <div className="notice error">{error}</div>;
  if (!snap) return <p>No data yet.</p>;
  if (!snap.connected) {
    return (
      <div className="notice">
        <b>Not connected to the database yet.</b> Add <code>TURSO_DATABASE_URL</code> and{" "}
        <code>TURSO_AUTH_TOKEN</code> in Vercel and redeploy.
      </div>
    );
  }

  const sortRows = (rows: InitialRow[]) =>
    [...rows].sort((a, b) => {
      if (a.total === null && b.total === null) return 0;
      if (a.total === null) return 1;
      if (b.total === null) return -1;
      return b.total - a.total;
    });

  const top5FL = new Set(snap.validatorAvg.slice(0, 5).map((r) => r.code).filter(Boolean));
  const top5NFL = new Set(snap.validatorAvg.slice(5, 10).map((r) => r.code).filter(Boolean));

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Rankings &amp; Top 5</h2>
          <p>Initial results for every office. The top 5 per track go to validation.</p>
        </div>
        <span className="freshness">{freshnessText(lastSynced)}</span>
      </div>

      <h3 style={{ color: "var(--navy)", marginTop: 20 }}>Frontline</h3>
      <div className="grid">
        {sortRows(snap.initialFL).map((r) => (
          <OfficeCard key={r.code} row={r} isTop5={top5FL.has(r.code)} />
        ))}
      </div>

      <h3 style={{ color: "var(--navy)", marginTop: 28 }}>Non-frontline</h3>
      <div className="grid">
        {sortRows(snap.initialNFL).map((r) => (
          <OfficeCard key={r.code} row={r} isTop5={top5NFL.has(r.code)} />
        ))}
      </div>
    </>
  );
}
