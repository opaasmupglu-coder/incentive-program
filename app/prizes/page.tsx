"use client";
import { freshnessText, useSnapshot } from "@/components/useSnapshot";

export default function PrizesPage() {
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

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Prizes</h2>
          <p>Tablet and TV tracker, read-only. It is edited on the sheet.</p>
        </div>
        <span className="freshness">{freshnessText(lastSynced)}</span>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Office</th>
              <th>Tablet</th>
              <th>Tablet focal</th>
              <th>TV</th>
              <th>TV focal</th>
              <th>Focal person</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {snap.prizes.map((p, i) => (
              <tr key={`${p.office}-${i}`}>
                <td>{p.office}</td>
                <td>{p.tablet || "—"}</td>
                <td>{p.tabletFocal || "—"}</td>
                <td>{p.tv || "—"}</td>
                <td>{p.tvFocal || "—"}</td>
                <td>
                  {p.focalPerson || "—"}
                  {p.focalPosition ? ` — ${p.focalPosition}` : ""}
                </td>
                <td>{p.notes || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
