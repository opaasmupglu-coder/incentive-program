"use client";
import { useMemo } from "react";
import Link from "next/link";
import { freshnessText, useSnapshot } from "@/components/useSnapshot";
import { ErrorState, LoadingState, NotConnected, PageHead, SectionHead } from "@/components/ui";

export default function OverviewPage() {
  const { snap, loading, error, lastSynced, refresh } = useSnapshot();

  const progress = useMemo(() => {
    if (!snap) return null;
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
    return { filledInputs, completeFL, completeNFL, top5FL, top5NFL, ratedOffice, ratedFocal, finalsFL, finalsNFL };
  }, [snap]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState what="No data yet" />;
  if (!snap.connected) {
    return (
      <>
        <PageHead
          kicker="Incentive Program · 2026"
          title="Overview"
          description="Where the 2026 Incentive Program stands, step by step."
          right={<span className="freshness">{freshnessText(lastSynced)}</span>}
        />
        <NotConnected missingEnv={snap.missingEnv} />
      </>
    );
  }

  const p = progress!;
  const steps = [
    {
      title: "Monthly numbers entered",
      desc: `${p.filledInputs} monthly values on the sheet so far.`,
      done: p.filledInputs > 0,
    },
    {
      title: "Initial totals complete",
      desc: `${p.completeFL} of 17 Frontline and ${p.completeNFL} of 11 Non-frontline offices have all four criteria.`,
      done: p.completeFL + p.completeNFL > 0,
    },
    {
      title: "Top 5 determined",
      desc: `${p.top5FL} of 5 Frontline and ${p.top5NFL} of 5 Non-frontline slots filled — these offices go to validation.`,
      done: p.top5FL === 5 && p.top5NFL === 5,
    },
    {
      title: "Validators rated",
      desc: `${p.ratedOffice} of 30 office ratings and ${p.ratedFocal} of 30 focal ratings done.`,
      done: p.ratedOffice === 30 && p.ratedFocal === 30,
    },
    {
      title: "Final results ready",
      desc: `${p.finalsFL} of 5 Frontline and ${p.finalsNFL} of 5 Non-frontline finals computed.`,
      done: p.finalsFL === 5 && p.finalsNFL === 5,
    },
  ];

  return (
    <>
      <PageHead
        kicker="Incentive Program · 2026"
        title="Overview"
        description="Where the 2026 Incentive Program stands, step by step."
        right={
          <>
            <span className="freshness">{freshnessText(lastSynced)} · </span>
            <button className="btn small secondary" onClick={() => refresh()}>
              Sync now
            </button>
          </>
        }
      />

      <section className="section" aria-labelledby="next-step">
        <SectionHead num="01" title="Your next step" />
        <div className="section-body">
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.title} className={s.done ? "done" : ""}>
                <span className="step-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="step-body">
                  <b>{s.title}</b>
                  <p>{s.desc}</p>
                </span>
                <span className="step-state">{s.done ? "Done" : `Step ${i + 1}`}</span>
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
      </section>

      <section className="section" aria-labelledby="checks">
        <SectionHead num="02" title="Workbook checks" />
        <div className="section-body">
          <div className="table-wrap">
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
        </div>
      </section>
    </>
  );
}
