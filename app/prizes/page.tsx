"use client";
import { memo } from "react";
import { freshnessText, useSnapshot } from "@/components/useSnapshot";
import { ErrorState, LoadingState, NotConnected, PageHead, SectionHead } from "@/components/ui";

const PrizeTable = memo(function PrizeTable({
  prizes,
}: {
  prizes: NonNullable<ReturnType<typeof useSnapshot>["snap"]>["prizes"];
}) {
  if (prizes.length === 0) {
    return <p className="muted">No prizes tracked yet.</p>;
  }
  return (
    <div className="table-wrap">
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
          {prizes.map((p, i) => (
            <tr key={`${p.office}-${i}`}>
              <td>
                <b>{p.office}</b>
              </td>
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
  );
});

export default function PrizesPage() {
  const { snap, loading, error, lastSynced } = useSnapshot();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState what="No data yet" />;
  if (!snap.connected) {
    return (
      <>
        <PageHead
          kicker="Section 07"
          title="Prizes"
          description="Tablet and TV tracker, read-only. It is edited on the sheet."
          right={<span className="freshness">{freshnessText(lastSynced)}</span>}
        />
        <NotConnected missingEnv={snap.missingEnv} />
      </>
    );
  }

  return (
    <>
      <PageHead
        kicker="Section 07"
        title="Prizes"
        description="Tablet and TV tracker, read-only. It is edited on the sheet."
        right={<span className="freshness">{freshnessText(lastSynced)}</span>}
      />

      <section className="section" aria-labelledby="prizes">
        <SectionHead num="01" title="Prize tracker" note={`${snap.prizes.length} entries`} />
        <div className="section-body">
          <PrizeTable prizes={snap.prizes} />
        </div>
      </section>
    </>
  );
}
