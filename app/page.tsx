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
  const expectedRatings = top5 * 3 * 2;
  const finalCount = [...snap.finalFL.offices, ...snap.finalNFL.offices].filter(
    (r) => r.finalTotal !== null,
  ).length;
  const steps = [
    {
      label: "Enter monthly numbers",
      desc: `${started} of ${total} offices have monthly data`,
      done: total > 0 && complete === total,
      href: "/enter",
    },
    {
      label: "Review initial rankings",
      desc: `${complete} offices with all four criteria complete`,
      done: total > 0 && complete === total && top5 > 0,
      href: "/rankings",
    },
    {
      label: "Validate the top 5",
      desc: `${rated} of ${expectedRatings} office and focal ratings submitted`,
      done: expectedRatings > 0 && rated === expectedRatings,
      href: "/scores",
    },
    {
      label: "Celebrate the results",
      desc: `${finalCount} final office scores ready`,
      done: top5 > 0 && finalCount === top5,
      href: "/finals",
    },
  ];
  const next = steps.find((s) => !s.done) || steps[3];
  const doneCount = steps.filter((s) => s.done).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  const currentPage = Math.min(page, pageCount);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Program overview</h1>
          <p className="lede">
            A clearer picture of your progress. A better experience for every
            citizen.
          </p>
        </div>
        <div className="page-actions">
          <button
            className="icon-btn"
            aria-label="Refresh program data"
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
            <Icon name="refresh" size={16} />
          </button>
          <Link className="btn" href="/enter">
            <Icon name="edit" size={15} /> Enter monthly scores
          </Link>
        </div>
      </div>
      {!snap.connected && <NotConnected missingEnv={snap.missingEnv} />}
      <section className="welcome-banner" aria-labelledby="welcome-title">
        <div>
          <p className="kicker">2026 CUSTOMER FEEDBACK INCENTIVE PROGRAM</p>
          <h3 id="welcome-title">Great service deserves recognition.</h3>
          <p>
            Bring your monthly data, office evaluations, and final results
            together in one simple workspace.
          </p>
          <Link className="btn small" href={next.href}>
            {started === 0 ? "Let’s get started" : next.label}
            <Icon name="arrow" size={14} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-sheet">
            <span />
            <span style={{ width: 30 }} />
            <div className="art-bars">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="art-badge">
            <Icon name="check" size={24} />
          </div>
        </div>
      </section>
      <div className="stat-grid">
        {[
          {
            title: "Participating offices",
            value: total,
            suffix: "",
            icon: "building",
            detail: `${snap.offices.filter((o) => o.track === "Frontline").length} frontline · ${snap.offices.filter((o) => o.track === "Non-frontline").length} non-frontline`,
          },
          {
            title: "Initial evaluations",
            value: complete,
            suffix: `/ ${total}`,
            icon: "chart",
            detail: `${total ? Math.round((complete / total) * 100) : 0}% of offices complete`,
          },
          {
            title: "Validation ratings",
            value: rated,
            suffix: `/ ${expectedRatings}`,
            icon: "check",
            detail: `${top5} offices selected for validation`,
          },
          {
            title: "Final results ready",
            value: finalCount,
            suffix: `/ ${top5}`,
            icon: "trophy",
            detail: finalCount
              ? "Ready to review final standings"
              : "Waiting for complete evaluations",
          },
        ].map((stat) => (
          <div className="stat-card" key={stat.title}>
            <div className="stat-top">
              <span>{stat.title}</span>
              <span className="stat-icon">
                <Icon name={stat.icon} size={16} />
              </span>
            </div>
            <div className="big-number">
              {snap.connected ? stat.value : "—"}
              <small>{snap.connected && stat.suffix}</small>
            </div>
            <p>
              {snap.connected
                ? stat.detail
                : "Connect your program to get started"}
            </p>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        {preferences.showProgress && (
          <section className="section" aria-labelledby="progress-title">
            <div className="section-body">
              <div className="panel-title">
                <div>
                  <h3 id="progress-title">Your program, step by step</h3>
                  <p>Everything you need to move the program forward.</p>
                </div>
                <div className="mini-progress">
                  <span>{doneCount}/4</span>
                  <div className="progress-track">
                    <span style={{ width: `${(doneCount / 4) * 100}%` }} />
                  </div>
                </div>
              </div>
              <ol className="flow-list">
                {steps.map((step, i) => (
                  <li
                    key={step.label}
                    className={
                      step.done ? "done" : step === next ? "current" : ""
                    }
                  >
                    <span className="flow-number">
                      {step.done ? (
                        <Icon name="check" size={14} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <div className="flow-body">
                      <Link href={step.href}>
                        <b>{step.label}</b>
                      </Link>
                      <p>{step.desc}</p>
                    </div>
                    <span
                      className={`badge ${step.done ? "green" : step === next ? "amber" : "neutral"}`}
                    >
                      {step.done
                        ? "Complete"
                        : step === next
                          ? "Next up"
                          : "Upcoming"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
        <section
          className="section"
          aria-labelledby="quick-title"
          style={
            !preferences.showProgress ? { gridColumn: "1 / -1" } : undefined
          }
        >
          <div className="section-body">
            <div className="panel-title">
              <div>
                <h3 id="quick-title">A little less clicking</h3>
                <p>Your most-used tools, right here.</p>
              </div>
              <Icon name="grid" size={16} style={{ color: "var(--muted)" }} />
            </div>
            <div className="quick-actions">
              {[
                {
                  href: "/enter",
                  icon: "edit",
                  title: "Enter monthly numbers",
                  desc: "Update an office’s four evaluation criteria",
                },
                {
                  href: "/offices",
                  icon: "people",
                  title: "Manage focal persons",
                  desc: "Edit names and positions in one place",
                },
                {
                  href: "/rankings",
                  icon: "chart",
                  title: "Explore the rankings",
                  desc: "See who’s leading in each track",
                },
              ].map((a) => (
                <Link className="quick-action" key={a.href} href={a.href}>
                  <span>
                    <Icon name={a.icon} size={17} />
                  </span>
                  <span>
                    <b>{a.title}</b>
                    <small>{a.desc}</small>
                  </span>
                  <Icon name="arrow" size={15} />
                </Link>
              ))}
            </div>
            <div className="tip">
              <Icon name="help" size={17} />
              <p>
                <b>A workspace that feels like yours.</b>
                <br />
                Use Customize above to change colors, density, and the sections
                you see here.
              </p>
            </div>
          </div>
        </section>
      </div>
      {preferences.showOffices && (
        <section className="section" aria-labelledby="offices-title">
          <div className="section-head">
            <h3 id="offices-title">Office overview</h3>
            <p>
              <Link className="text-link" href="/offices">
                Manage offices <Icon name="arrow" size={13} />
              </Link>
            </p>
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
              <Icon name="search" size={15} />
              <input
                type="text"
                aria-label="Search offices or focal persons"
                placeholder="Search offices or people…"
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
                  <th>Track</th>
                  <th>Focal person</th>
                  <th>Criteria complete</th>
                  <th className="num">Initial score</th>
                  <th>Status</th>
                  <th />
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
                              {o.short?.slice(0, 4) || o.code.slice(0, 3)}
                            </span>
                            <div>
                              <b>{o.name}</b>
                              <small>{o.code}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${o.track === "Frontline" ? "green" : "blue"}`}
                          >
                            {o.track}
                          </span>
                        </td>
                        <td>
                          {o.focal || <span className="sub">Unassigned</span>}
                        </td>
                        <td>
                          <div className="progress-cell">
                            <div className="progress-track">
                              <span style={{ width: `${count * 25}%` }} />
                            </div>
                            <span>{count}/4</span>
                          </div>
                        </td>
                        <td className="num">
                          <b>{fmtPct(r?.total)}</b>
                        </td>
                        <td>
                          <span
                            className={`badge ${count === 4 ? "green" : count ? "amber" : "neutral"}`}
                          >
                            {count === 4
                              ? "Complete"
                              : count
                                ? "In progress"
                                : "Not started"}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/enter?office=${encodeURIComponent(o.code)}`}
                            aria-label={`Enter scores for ${o.name}`}
                          >
                            <Icon name="arrow" size={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">
              <Icon name="building" size={28} />
              <b>{query ? "No matching offices" : "No offices to show yet"}</b>
              {query
                ? "Try another office name or focal person."
                : "Offices will appear here once your program data is connected."}
            </div>
          )}
          <div className="table-foot">
            <span>
              {filtered.length
                ? `Showing ${(currentPage - 1) * 6 + 1}–${Math.min(currentPage * 6, filtered.length)} of ${filtered.length} offices`
                : "0 offices"}
            </span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
      {preferences.showChecks && (
        <section className="section">
          <div className="section-head">
            <h3>Program data checks</h3>
            <p>Calculated from your saved data</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Result</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                {snap.checks.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td>
                      <b>{c.result}</b>
                    </td>
                    <td>{c.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!snap.checks.length && (
            <div className="empty-state">
              Checks will appear when program data is available.
            </div>
          )}
        </section>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--muted)",
          marginTop: 20,
        }}
      >
        <span>
          <span
            style={{
              color: snap.connected ? "var(--accent)" : "var(--muted)",
              marginRight: 6,
            }}
          >
            ●
          </span>
          {snap.connected
            ? "Connected to your program database"
            : "Database setup needed"}
        </span>
        <span>{freshnessText(lastSynced)} · Updates automatically</span>
      </div>
    </>
  );
}
