"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSnapshot, freshnessText, fmtPct } from "@/components/useSnapshot";
import { ErrorState, LoadingState, NotConnected } from "@/components/ui";
import Icon from "@/components/Icon";
import { usePreferences } from "@/components/Preferences";

export default function OverviewPage() {
  const { snap, loading, error, lastSynced, refresh } = useSnapshot();
  const { preferences } = usePreferences();
  const [track, setTrack] = useState("All offices");
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const allRows = useMemo(
    () => (snap ? [...snap.initialFL, ...snap.initialNFL] : []),
    [snap],
  );
  const filtered = useMemo(
    () =>
      (snap?.offices || []).filter(
        (o) =>
          (track === "All offices" || o.track === track) &&
          `${o.name} ${o.code} ${o.focal}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [snap, track, query],
  );
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState />;
  const total = snap.offices.length;
  const complete = allRows.filter((r) => r.total !== null).length;
  const started = allRows.filter((r) =>
    [r.resolution, r.collection, r.gpr, r.timeliness].some((v) => v !== null),
  ).length;
  const top5 = snap.validatorAvg.filter((r) => r.code).length;
  const rated =
    snap.validators.filter((r) => r.officeRated).length +
    snap.validators.filter((r) => r.focalRated).length;
  const expectedRatings = snap.validators.length * 2;
  const finalCount = [...snap.finalFL.offices, ...snap.finalNFL.offices].filter(
    (r) => r.finalTotal !== null,
  ).length;
  const next =
    complete < total || total === 0
      ? {
          title: "Continue entering monthly scores",
          description:
            "Choose an office and a month. Enter one category at a time; calculations are automatic.",
          href: "/enter",
          action: "Enter monthly scores",
          icon: "edit",
        }
      : expectedRatings > rated || top5 === 0
        ? {
            title: "Rate the qualifying offices",
            description:
              "Review the top offices, then enter each validator’s office and focal-person ratings.",
            href: "/scores",
            action: "Enter validator ratings",
            icon: "check",
          }
        : {
            title: "Review the final results",
            description:
              "Monthly scores and validator ratings have been tallied. Review the final standings for both tracks.",
            href: "/finals",
            action: "View final results",
            icon: "trophy",
          };
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  const currentPage = Math.min(page, pageCount);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="lede">
            Track office progress and see what needs your attention.
          </p>
        </div>
        <button
          className="btn secondary small"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            try {
              await refresh();
            } finally {
              setSyncing(false);
            }
          }}
        >
          <Icon name="refresh" size={15} />
          {syncing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {!snap.connected && <NotConnected missingEnv={snap.missingEnv} />}
      <section className="next-task" aria-labelledby="next-task-title">
        <span className="next-task-icon">
          <Icon name={next.icon} size={23} />
        </span>
        <div>
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h2 id="next-task-title">{next.title}</h2>
          <p>{next.description}</p>
        </div>
        <Link className="btn" href={next.href}>
          {next.action}
          <Icon name="arrow" size={15} />
        </Link>
      </section>
      <div className="overview-metrics" aria-label="Program totals">
        <div>
          <span>Participating offices</span>
          <strong>{snap.connected ? total : "—"}</strong>
          <small>
            {snap.offices.filter((o) => o.track === "Frontline").length}{" "}
            frontline ·{" "}
            {snap.offices.filter((o) => o.track === "Non-frontline").length}{" "}
            non-frontline
          </small>
        </div>
        <div>
          <span>Initial scores complete</span>
          <strong>
            {snap.connected ? complete : "—"}
            <small> / {total}</small>
          </strong>
          <small>All four categories have data</small>
        </div>
        <div>
          <span>Final results ready</span>
          <strong>
            {snap.connected ? finalCount : "—"}
            <small> / {top5}</small>
          </strong>
          <small>{rated} validator ratings submitted</small>
        </div>
      </div>
      {preferences.showOffices && (
        <section
          className="section office-progress-panel"
          aria-labelledby="offices-title"
        >
          <div className="section-head">
            <div>
              <h3 id="offices-title">Office progress</h3>
              <p className="section-description">
                Check an office’s progress or continue entering its scores.
              </p>
            </div>
            <Link className="text-link" href="/offices">
              Edit focal persons <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="toolbar">
            <div className="segmented" aria-label="Filter offices by track">
              {["All offices", "Frontline", "Non-frontline"].map((t) => (
                <button
                  key={t}
                  className={track === t ? "selected" : ""}
                  aria-pressed={track === t}
                  onClick={() => {
                    setTrack(t);
                    setPage(1);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="search-field">
              <Icon name="search" size={16} />
              <input
                type="text"
                aria-label="Search offices or focal persons"
                placeholder="Find an office or person"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Office</th>
                  <th>Monthly categories</th>
                  <th className="num">Initial score</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice((currentPage - 1) * 6, currentPage * 6)
                  .map((o) => {
                    const r = allRows.find((row) => row.code === o.code);
                    const count = r
                      ? [
                          r.resolution,
                          r.collection,
                          r.gpr,
                          r.timeliness,
                        ].filter((v) => v !== null).length
                      : 0;
                    return (
                      <tr key={o.code}>
                        <td>
                          <div className="office-cell">
                            <span className="office-icon">
                              <Icon name="building" size={17} />
                            </span>
                            <div>
                              <b>{o.name}</b>
                              <small>
                                {o.track}
                                {o.focal ? ` · ${o.focal}` : ""}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="category-progress">
                            <span
                              className={`badge ${count === 4 ? "green" : count ? "amber" : "neutral"}`}
                            >
                              {count === 4
                                ? "Complete"
                                : count
                                  ? `${count} of 4 entered`
                                  : "No data yet"}
                            </span>
                            <div
                              className="category-dots"
                              aria-label={`${count} of 4 categories entered`}
                            >
                              {Array.from({ length: 4 }, (_, i) => (
                                <i
                                  className={i < count ? "filled" : ""}
                                  key={i}
                                />
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="num">
                          <b>{fmtPct(r?.total)}</b>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/enter?office=${encodeURIComponent(o.code)}`}
                            aria-label={`Enter scores for ${o.name}`}
                          >
                            Enter scores
                            <Icon name="arrow" size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <b>{query ? "No matching offices" : "No offices to show"}</b>
              {query
                ? "Try another office name or focal person."
                : "Your offices will appear when program data is connected."}
            </div>
          )}
          <div className="table-foot">
            <span>
              {filtered.length
                ? `${(currentPage - 1) * 6 + 1}–${Math.min(currentPage * 6, filtered.length)} of ${filtered.length} offices`
                : "0 offices"}
            </span>
            <div className="pagination">
              <button
                className="btn small secondary"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                {currentPage} / {pageCount}
              </span>
              <button
                className="btn small secondary"
                disabled={currentPage === pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
      {preferences.showProgress && (
        <details className="section overview-guide">
          <summary>
            <Icon name="help" size={18} />
            <span>How does the program work?</span>
            <Icon name="down" size={15} />
          </summary>
          <ol>
            <li>
              <Link href="/enter">Enter monthly scores</Link>
              <p>
                Record action plans, forms and visitors, overall ratings, and
                submission dates. {started} offices have started.
              </p>
            </li>
            <li>
              <Link href="/rankings">Review office rankings</Link>
              <p>
                Offices with all four categories are ranked within their track.
                The top five proceed to validation.
              </p>
            </li>
            <li>
              <Link href="/scores">Enter validator ratings</Link>
              <p>
                Validators rate each qualifying office and its focal person.{" "}
                {rated} of {expectedRatings} ratings are complete.
              </p>
            </li>
            <li>
              <Link href="/finals">View final results</Link>
              <p>
                Final scores combine the initial evaluation with validator
                ratings.
              </p>
            </li>
          </ol>
        </details>
      )}
      {preferences.showChecks && (
        <details className="section overview-guide">
          <summary>
            <Icon name="check" size={18} />
            <span>Program data checks</span>
            <Icon name="down" size={15} />
          </summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Result</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {snap.checks.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td>{c.result}</td>
                    <td>{c.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="sync-note">
        <span className={snap.connected ? "connected-dot" : ""} />
        {snap.connected ? "Connected" : "Database setup needed"} ·{" "}
        {freshnessText(lastSynced)}
      </p>
    </>
  );
}
