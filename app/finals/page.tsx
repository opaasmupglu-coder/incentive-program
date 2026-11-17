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
  validatorWeight,
}: {
  rows: FinalRow[];
  kind: "office" | "focal";
  initialWeight: number;
  validatorWeight: number;
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
            <th className="num">
              Initial Result ({Math.round(initialWeight * 100)}%)
            </th>
            <th className="num">
              Validator Score ({Math.round(validatorWeight * 100)}%)
            </th>
            <th className="num">Final Rating</th>
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
              <td className="num criterion-result">
                {r.initial60 === null ? (
                  "—"
                ) : (
                  <>
                    <b>{fmtPct(r.initial60)}</b>{" "}
                    <span className="actual-percentage">
                      ({fmtPct(r.initialTotal)})
                    </span>
                    {r.initialProvisional && (
                      <span className="criterion-weight">Provisional</span>
                    )}
                  </>
                )}
              </td>
              <td className="num criterion-result">
                {r.validatorAvg === null ? (
                  "—"
                ) : (
                  <>
                    <b>{fmtPct(r.validatorAvg)}</b>{" "}
                    <span className="actual-percentage">
                      (
                      {fmtPct(
                        validatorWeight > 0
                          ? r.validatorAvg / validatorWeight
                          : null,
                      )}
                      )
                    </span>
                  </>
                )}
              </td>
              <td className="num">
                <b>{fmtPct(r.finalTotal)}</b>
              </td>
              <td>
                {r.finalTotal !== null && !r.initialProvisional ? (
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

  const initialWeight = snap.settings?.finalInitialWeight ?? 0.6;
  const officeWeight = snap.settings?.officeSubtotal ?? 0.4;
  const focalWeight = snap.settings?.focalSubtotal ?? 0.4;
  const validatorWeight = kind === "Offices" ? officeWeight : focalWeight;
  const percentNumber = (value: number | null) =>
    value === null ? null : Math.round(value * 1000000) / 10000;

  return (
    <>
      <PageHead
        kicker="Section 05"
        title="Final results"
        description={`${Math.round(initialWeight * 100)}% initial result + ${Math.round(validatorWeight * 100)}% validator score = final rating.`}
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
                  "Initial result weighted (%)",
                  "Initial result actual (%)",
                  "Validator score weighted (%)",
                  "Validator score actual (%)",
                  "Final rating (%)",
                  "Status",
                ],
                ...[
                  {
                    track: "Frontline",
                    kind: "Office",
                    rows: flOffices,
                    validatorWeight: officeWeight,
                  },
                  {
                    track: "Frontline",
                    kind: "Focal person",
                    rows: flFocals,
                    validatorWeight: focalWeight,
                  },
                  {
                    track: "Non-frontline",
                    kind: "Office",
                    rows: nflOffices,
                    validatorWeight: officeWeight,
                  },
                  {
                    track: "Non-frontline",
                    kind: "Focal person",
                    rows: nflFocals,
                    validatorWeight: focalWeight,
                  },
                ].flatMap((g) =>
                  g.rows.map((r) => [
                    g.track,
                    g.kind,
                    r.rank,
                    r.name,
                    percentNumber(r.initial60),
                    percentNumber(r.initialTotal),
                    percentNumber(r.validatorAvg),
                    percentNumber(
                      r.validatorAvg !== null && g.validatorWeight > 0
                        ? r.validatorAvg / g.validatorWeight
                        : null,
                    ),
                    percentNumber(r.finalTotal),
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
      <p className="rankings-explanation">
        <b>How to read the scores:</b> weighted contribution (actual score). The
        two weighted contributions add up to the final rating. Missing ratings
        stay blank.
      </p>
      {track === "Frontline" && kind === "Offices" && (
        <section className="section" aria-label="Frontline office results">
          <SectionHead num="01" title="Frontline — Offices" />
          <div className="section-body">
            <FinalTable
              rows={flOffices}
              kind="office"
              initialWeight={initialWeight}
              validatorWeight={officeWeight}
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
              initialWeight={initialWeight}
              validatorWeight={focalWeight}
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
              initialWeight={initialWeight}
              validatorWeight={officeWeight}
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
              initialWeight={initialWeight}
              validatorWeight={focalWeight}
            />
          </div>
        </section>
      )}
    </>
  );
}
