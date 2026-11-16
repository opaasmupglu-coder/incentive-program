"use client";
import { fmtNum, fmtPct, freshnessText, useSnapshot } from "@/components/useSnapshot";
import type { FinalRow } from "@/lib/types";

function FinalCard({ row, kind }: { row: FinalRow; kind: "office" | "focal" }) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{row.name}</h3>
        {row.rank !== null && <span className="rank-badge">#{row.rank}</span>}
      </div>
      <div className="big-number">{row.finalTotal !== null ? fmtPct(row.finalTotal) : "—"}</div>
      <p>
        {row.finalTotal !== null ? (
          <span className="pill ok">✓ Final</span>
        ) : (
          <span className="pill warn">{row.status || "Waiting"}</span>
        )}
      </p>
      <table>
        <tbody>
          <tr>
            <td>Initial total</td>
            <td className="num">{fmtPct(row.initialTotal)}</td>
          </tr>
          <tr>
            <td>Initial × 60%</td>
            <td className="num">{row.initial60 !== null ? fmtNum(row.initial60) : "—"}</td>
          </tr>
          <tr>
            <td>Validator {kind === "office" ? "office" : "focal"} average</td>
            <td className="num">{row.validatorAvg !== null ? fmtNum(row.validatorAvg) : "—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function FinalsPage() {
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

  const sortFinals = (rows: FinalRow[]) =>
    [...rows].sort((a, b) => {
      if (a.finalTotal === null && b.finalTotal === null) return 0;
      if (a.finalTotal === null) return 1;
      if (b.finalTotal === null) return -1;
      return b.finalTotal - a.finalTotal;
    });

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Final results</h2>
          <p>60% Initial + validator score, ranked among the top 5. Offices and focal persons are scored separately.</p>
        </div>
        <span className="freshness">{freshnessText(lastSynced)}</span>
      </div>

      <h3 style={{ color: "var(--navy)", marginTop: 20 }}>Frontline — Offices</h3>
      <div className="grid">
        {sortFinals(snap.finalFL.offices).map((r) => (
          <FinalCard key={`fl-o-${r.code}`} row={r} kind="office" />
        ))}
      </div>
      <h3 style={{ color: "var(--navy)", marginTop: 28 }}>Frontline — Focal persons</h3>
      <div className="grid">
        {sortFinals(snap.finalFL.focals).map((r) => (
          <FinalCard key={`fl-f-${r.code}`} row={r} kind="focal" />
        ))}
      </div>

      <h3 style={{ color: "var(--navy)", marginTop: 28 }}>Non-frontline — Offices</h3>
      <div className="grid">
        {sortFinals(snap.finalNFL.offices).map((r) => (
          <FinalCard key={`nf-o-${r.code}`} row={r} kind="office" />
        ))}
      </div>
      <h3 style={{ color: "var(--navy)", marginTop: 28 }}>Non-frontline — Focal persons</h3>
      <div className="grid">
        {sortFinals(snap.finalNFL.focals).map((r) => (
          <FinalCard key={`nf-f-${r.code}`} row={r} kind="focal" />
        ))}
      </div>
    </>
  );
}
