"use client";
import Link from "next/link";
import { freshnessText, useSnapshot } from "@/components/useSnapshot";

export default function OverviewPage() {
  const { snap, loading, error, lastSynced, refresh } = useSnapshot();

  if (loading) return <p>Loading the latest numbers from the sheet…</p>;
  if (error) return <div className="notice error">{error}</div>;
  if (!snap) return <p>No data yet.</p>;

  if (!snap.connected) {
    return (
      <>
        <div className="page-head">
          <h2>Overview</h2>
          <span className="freshness">{freshnessText(lastSynced)}</span>
        </div>
        <div className="notice">
          <b>Not connected to the database yet.</b>
          <p>
            Add these environment variables in Vercel (Project → Settings → Environment Variables), then redeploy:
          </p>
          <ul>
            {snap.missingEnv.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
          <p>
            <code>TURSO_DATABASE_URL</code> is the Turso database URL and <code>TURSO_AUTH_TOKEN</code> is its auth
            token.
          </p>
        </div>
      </>
    );
  }

  const filledInputs = [...snap.inputResolution, ...snap.inputCollection, ...snap.inputGpr, ...snap.inputTimeliness]
    .flatMap((r) => [...r.first, ...r.second])
    .filter((v) => v !== null).length;
  const completeFL = snap.initialFL.filter((r) => r.status.startsWith("✓")).length;
  const completeNFL = snap.initialNFL.filter((r) => r.status.startsWith("✓")).length;
  const top5FL = snap.validatorAvg.slice(0, 5).filter((r) => r.code).length;
  const top5NFL = snap.validatorAvg.slice(5, 10).filter((r) => r.code).length;
  const ratedOffice = snap.validators.filter((v) => v.officeRated).length;
  const ratedFocal = snap.validators.filter((v) => v.focalRated).length;
  const finalsFL = snap.finalFL.offices.filter((r) => r.finalTotal !== null).length;
  const finalsNFL = snap.finalNFL.offices.filter((r) => r.finalTotal !== null).length;

  const steps = [
    {
      title: "Monthly numbers entered",
      desc: `${filledInputs} monthly values on the sheet so far.`,
      done: filledInputs > 0,
    },
    {
      title: "Initial totals complete",
      desc: `${completeFL} of 17 Frontline and ${completeNFL} of 11 Non-frontline offices have all four criteria.`,
      done: completeFL + completeNFL > 0,
    },
    {
      title: "Top 5 determined",
      desc: `${top5FL} of 5 Frontline and ${top5NFL} of 5 Non-frontline slots filled — these offices go to validation.`,
      done: top5FL === 5 && top5NFL === 5,
    },
    {
      title: "Validators rated",
      desc: `${ratedOffice} of 30 office ratings and ${ratedFocal} of 30 focal ratings done.`,
      done: ratedOffice === 30 && ratedFocal === 30,
    },
    {
      title: "Final results ready",
      desc: `${finalsFL} of 5 Frontline and ${finalsNFL} of 5 Non-frontline finals computed.`,
      done: finalsFL === 5 && finalsNFL === 5,
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Overview</h2>
          <p>Where the 2026 Incentive Program stands, step by step.</p>
        </div>
        <div>
          <span className="freshness">{freshnessText(lastSynced)} · </span>
          <button className="btn small secondary" onClick={() => refresh()}>
            Sync now
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Your next step</h3>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title} className={s.done ? "done" : ""}>
              <span className="step-dot">{s.done ? "✓" : i + 1}</span>
              <span className="step-body">
                <b>{s.title}</b>
                <p>{s.desc}</p>
              </span>
            </li>
          ))}
        </ol>
        <p>
          <Link href="/enter">Enter monthly numbers →</Link>
          {" · "}
          <Link href="/scores">Enter validator scores →</Link>
          {" · "}
          <Link href="/finals">See final results →</Link>
        </p>
      </div>

      <div className="card">
        <h3>Workbook checks</h3>
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th className="num">Result</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            {snap.checks.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td className="num">
                  <b>{c.result}</b>
                </td>
                <td>{c.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
