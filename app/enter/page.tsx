"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MONTHS } from "@/lib/types";
import { fmtPct, useSnapshot } from "@/components/useSnapshot";
import { useCalendar } from "@/components/useCalendar";
import { countWorkingDays } from "@/lib/working-days";
import { resolutionRate, collectionRate, timelinessScore } from "@/lib/compute";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
  SectionHead,
} from "@/components/ui";
import Icon from "@/components/Icon";
type Criterion = "resolution" | "collection" | "gpr" | "timeliness";
const criteria = [
  {
    key: "resolution" as const,
    label: "Action plans resolved",
    first: "Acted upon",
    second: "With action plans",
    hint: "How many feedback items were acted upon, out of those with action plans?",
  },
  {
    key: "collection" as const,
    label: "Forms & visitors",
    first: "Forms collected",
    second: "Visitors / clients",
    hint: "Enter forms collected and total clients. The collection rate is calculated for you.",
  },
  {
    key: "gpr" as const,
    label: "Overall rating",
    first: "Overall rating (%)",
    second: null,
    hint: "Enter the office’s General Average Rating as a percentage, for example 95.63.",
  },
  {
    key: "timeliness" as const,
    label: "Submission dates",
    first: "Working days",
    second: null,
    hint: "Enter this office’s release and received dates. Working days and the timeliness score are calculated automatically.",
  },
];
const blankDates = () =>
  Array.from({ length: 10 }, () => ({ released: "", received: "" }));
export default function EnterPage() {
  const { snap, loading, error, refresh, setSaving } = useSnapshot();
  const [track, setTrack] = useState("Frontline");
  const [officeCode, setOfficeCode] = useState("");
  const [criterion, setCriterion] = useState<Criterion>("resolution");
  const [month, setMonth] = useState(0);
  const [manualDays, setManualDays] = useState(false);
  const [first, setFirst] = useState<string[]>(Array(10).fill(""));
  const [second, setSecond] = useState<string[]>(Array(10).fill(""));
  const [dates, setDates] = useState(blankDates);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [pending, setPending] = useState<(() => void) | null>(null);
  const discardDialog = useRef<HTMLDialogElement>(null);
  const {
    days,
    dates: savedDates,
    error: calendarError,
    loading: calendarLoading,
    loadedOffice,
  } = useCalendar(officeCode);
  const prefillKey = useRef("");
  const datesKey = useRef("");
  const initialSelection = useRef(false);
  useEffect(() => {
    if (!snap?.offices.length || initialSelection.current) return;
    initialSelection.current = true;
    const code = new URLSearchParams(window.location.search).get("office");
    const office = snap.offices.find((o) => o.code === code);
    if (office) {
      setTrack(office.track);
      setOfficeCode(office.code);
    } else setOfficeCode(snap.offices[0].code);
  }, [snap]);
  useEffect(() => {
    if (!snap || !officeCode) return;
    const key = `${officeCode}|${criterion}`;
    if (prefillKey.current === key) return;
    prefillKey.current = key;
    const rows =
      criterion === "resolution"
        ? snap.inputResolution
        : criterion === "collection"
          ? snap.inputCollection
          : criterion === "gpr"
            ? snap.inputGpr
            : snap.inputTimeliness;
    const row = rows.find((r) => r.code === officeCode);
    setFirst(
      row?.first.map((v) => (v === null ? "" : String(v))) ||
        Array(10).fill(""),
    );
    setSecond(
      row?.second.map((v) => (v === null ? "" : String(v))) ||
        Array(10).fill(""),
    );
    setDirty(false);
    setMessage(null);
  }, [snap, officeCode, criterion]);
  useEffect(() => {
    if (
      calendarLoading ||
      loadedOffice !== officeCode ||
      datesKey.current === officeCode
    )
      return;
    datesKey.current = officeCode;
    setDates(
      blankDates().map((d, i) => {
        const saved = savedDates.find((r) => r.month === i + 1);
        return saved
          ? { released: saved.released, received: saved.received }
          : d;
      }),
    );
  }, [savedDates, officeCode, calendarLoading, loadedOffice]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (pending) discardDialog.current?.showModal();
    else discardDialog.current?.close();
  }, [pending]);
  function navigate(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  function updateDate(i: number, key: "released" | "received", value: string) {
    const next = dates.map((d, j) => (j === i ? { ...d, [key]: value } : d));
    setDates(next);
    const count = countWorkingDays(days, next[i].released, next[i].received);
    setFirst((p) =>
      p.map((v, j) => (j === i ? (count === null ? "" : String(count)) : v)),
    );
    setDirty(true);
    setMessage(null);
  }
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState />;
  const crit = criteria.find((c) => c.key === criterion)!;
  const office = snap.offices.find((o) => o.code === officeCode);
  const completeMonths = first.filter(
    (v, i) => v !== "" && (!crit.second || second[i] !== ""),
  ).length;
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const liveScore = (i: number) => {
    const a = num(first[i]),
      b = num(second[i]);
    if (criterion === "resolution") return fmtPct(resolutionRate(a, b));
    if (criterion === "collection")
      return fmtPct(
        collectionRate(
          a,
          b,
          snap.settings?.sampleConstant || 384.16,
          track === "Frontline"
            ? (snap.settings?.minFormsFL ?? 20)
            : (snap.settings?.minFormsNFL ?? 10),
        ),
      );
    if (criterion === "gpr") return a === null ? "—" : `${a}/100`;
    return (
      timelinessScore(
        a,
        snap.settings?.timelinessBands || [1, 0.8, 0.6, 0.4, 0.2, 0],
      )?.toFixed(2) ?? "—"
    );
  };
  async function save() {
    const values = [...first, ...(crit.second ? second : [])]
      .filter((v) => v !== "")
      .map(Number);
    if (
      values.some(
        (v) =>
          !Number.isFinite(v) ||
          v < 0 ||
          (criterion !== "gpr" && !Number.isInteger(v)),
      )
    ) {
      setMessage({
        text:
          criterion === "gpr"
            ? "Enter a rating between 0 and 100."
            : "Enter non-negative whole numbers for every value.",
        ok: false,
      });
      return;
    }
    if (criterion === "gpr" && values.some((v) => v > 100)) {
      setMessage({
        text: "Performance ratings must be between 0 and 100.",
        ok: false,
      });
      return;
    }
    if (
      criterion === "resolution" &&
      first.some(
        (v, i) => v !== "" && second[i] !== "" && Number(v) > Number(second[i]),
      )
    ) {
      setMessage({
        text: "Acted-upon items cannot exceed items with action plans.",
        ok: false,
      });
      return;
    }
    if (
      criterion === "timeliness" &&
      dates.some(
        (d) =>
          (d.released || d.received) &&
          countWorkingDays(days, d.released, d.received) === null,
      )
    ) {
      setMessage({
        text: "Complete each release and received date pair using valid 2026 dates, or clear both to enter a day count.",
        ok: false,
      });
      return;
    }
    setBusy(true);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: officeCode,
          criterion,
          first: first.map(num),
          second: crit.second ? second.map(num) : [],
          ...(criterion === "timeliness" ? { dates } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      await refresh();
      setDirty(false);
      setMessage({
        text: "Monthly scores saved. Your progress and rankings are up to date.",
        ok: true,
      });
    } catch (e) {
      setMessage({
        text:
          e instanceof Error
            ? e.message
            : "Could not save. Your entries are still here; please try again.",
        ok: false,
      });
    } finally {
      setBusy(false);
      setSaving(false);
    }
  }
  return (
    <>
      <PageHead
        kicker="Monthly evaluation"
        title="Enter monthly scores"
        description="Select an office and reporting month, then choose what to update."
      />
      {!snap.connected ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <section
            className="section entry-selection"
            aria-label="Office and reporting month"
          >
            <div className="section-body">
              <div className="field-row">
                <div style={{ flexGrow: 2 }}>
                  <label htmlFor="office">Office</label>
                  <select
                    id="office"
                    disabled={busy}
                    value={officeCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      navigate(() => {
                        setOfficeCode(value);
                        setTrack(
                          snap.offices.find((o) => o.code === value)?.track ||
                            "Frontline",
                        );
                        setManualDays(false);
                        setDirty(false);
                      });
                    }}
                  >
                    {["Frontline", "Non-frontline"].map((group) => (
                      <optgroup key={group} label={group}>
                        {snap.offices
                          .filter((o) => o.track === group)
                          .map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="month-selector">
                  <label htmlFor="reporting-month">Reporting month</label>
                  <select
                    id="reporting-month"
                    disabled={busy}
                    value={month}
                    onChange={(e) => {
                      setMonth(Number(e.target.value));
                      setManualDays(false);
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>
                        {m} 2026
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="entry-focal">
                <Icon name="people" size={14} /> Focal person:{" "}
                <b>{office?.focal || "Not assigned"}</b>
                {office?.focalPosition ? ` · ${office.focalPosition}` : ""}{" "}
                <Link href="/offices" style={{ marginLeft: 8 }}>
                  Edit focal person
                </Link>
              </p>
            </div>
          </section>
          <div className="entry-category">
            <label htmlFor="entry-category">What are you updating?</label>
            <select
              id="entry-category"
              value={criterion}
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value as Criterion;
                navigate(() => {
                  setCriterion(value);
                  setManualDays(false);
                  setDirty(false);
                });
              }}
            >
              {criteria.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="entry-category-note">
              One category at a time. Save before switching categories.
            </span>
          </div>
          <section className="section focused-entry">
            <SectionHead
              num="02"
              title={`${crit.label}`}
              note={`${MONTHS[month]} 2026`}
            />
            <div className="section-body">
              <div className="entry-office-context">
                <Icon name="building" size={17} />
                <span>
                  <strong>{office?.name || "Select an office"}</strong>
                  <small>
                    These entries apply only to this office and reporting month.
                  </small>
                </span>
              </div>
              <p className="entry-hint">{crit.hint}</p>
              {criterion === "timeliness" && calendarError && (
                <ErrorState error={calendarError} />
              )}
              <div className="month-grid">
                {[month].map((i) => {
                  const m = MONTHS[i];
                  return (
                    <div className="month-cell" key={m}>
                      {criterion === "timeliness" && (
                        <>
                          <div
                            className="entry-mode"
                            role="group"
                            aria-label="How to enter timeliness"
                          >
                            <button
                              className={!manualDays ? "selected" : ""}
                              aria-pressed={!manualDays}
                              disabled={busy}
                              onClick={() => setManualDays(false)}
                            >
                              Use dates
                            </button>
                            <button
                              className={manualDays ? "selected" : ""}
                              aria-pressed={manualDays}
                              disabled={
                                busy ||
                                Boolean(dates[i].released || dates[i].received)
                              }
                              onClick={() => setManualDays(true)}
                            >
                              Enter days manually
                            </button>
                          </div>
                          {!manualDays && (
                            <div className="date-pair">
                              <div>
                                <label htmlFor={`release-${i}`}>
                                  Date released
                                </label>
                                <input
                                  disabled={busy || calendarLoading}
                                  id={`release-${i}`}
                                  type="date"
                                  min="2026-01-01"
                                  max="2026-12-31"
                                  value={dates[i].released}
                                  onChange={(e) =>
                                    updateDate(i, "released", e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <label htmlFor={`receive-${i}`}>
                                  Date received
                                </label>
                                <input
                                  disabled={busy || calendarLoading}
                                  id={`receive-${i}`}
                                  type="date"
                                  min={dates[i].released || "2026-01-01"}
                                  max="2026-12-31"
                                  value={dates[i].received}
                                  onChange={(e) =>
                                    updateDate(i, "received", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {(criterion !== "timeliness" || manualDays) && (
                        <div className="entry-number-fields">
                          <div>
                            <label htmlFor={`f-${i}`}>{crit.first}</label>
                            <input
                              disabled={
                                busy ||
                                (criterion === "timeliness" &&
                                  Boolean(
                                    dates[i].released || dates[i].received,
                                  ))
                              }
                              id={`f-${i}`}
                              aria-label={`${m} ${crit.first}`}
                              type="number"
                              min={0}
                              max={criterion === "gpr" ? 100 : undefined}
                              step={criterion === "gpr" ? "0.01" : "1"}
                              value={first[i]}
                              placeholder="—"
                              onChange={(e) => {
                                setFirst((p) =>
                                  p.map((v, j) =>
                                    j === i ? e.target.value : v,
                                  ),
                                );
                                setDirty(true);
                                setMessage(null);
                              }}
                            />
                          </div>
                          {crit.second && (
                            <div>
                              <label htmlFor={`s-${i}`}>{crit.second}</label>
                              <input
                                disabled={busy}
                                id={`s-${i}`}
                                aria-label={`${m} ${crit.second}`}
                                type="number"
                                min={0}
                                step={1}
                                value={second[i]}
                                placeholder="—"
                                onChange={(e) => {
                                  setSecond((p) =>
                                    p.map((v, j) =>
                                      j === i ? e.target.value : v,
                                    ),
                                  );
                                  setDirty(true);
                                  setMessage(null);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {criterion === "timeliness" && manualDays && (
                        <p className="field-help">
                          Enter 99 if the plan was due but not submitted. Leave
                          blank if no plan was due.
                        </p>
                      )}
                      {criterion === "timeliness" &&
                        !manualDays &&
                        first[i] !== "" &&
                        !dates[i].released &&
                        !dates[i].received && (
                          <p className="field-help">
                            A day count is already recorded. Choose “Enter days
                            manually” to edit it, or enter dates to replace it.
                          </p>
                        )}
                      {criterion === "timeliness" &&
                        Boolean(dates[i].released || dates[i].received) && (
                          <button
                            className="clear-date-link"
                            disabled={busy}
                            onClick={() => {
                              setDates((p) =>
                                p.map((d, j) =>
                                  j === i ? { released: "", received: "" } : d,
                                ),
                              );
                              setFirst((p) =>
                                p.map((v, j) => (j === i ? "" : v)),
                              );
                              setDirty(true);
                              setMessage(null);
                            }}
                          >
                            Clear dates for this month
                          </button>
                        )}
                      <div className="entry-calculation" aria-live="polite">
                        <div>
                          <span>
                            {criterion === "timeliness"
                              ? "Working days elapsed"
                              : criterion === "gpr"
                                ? "Overall rating"
                                : "Calculated rate"}
                          </span>
                          <strong>
                            {criterion === "timeliness"
                              ? first[i] === ""
                                ? "—"
                                : first[i]
                              : liveScore(i)}
                          </strong>
                        </div>
                        {criterion === "timeliness" && (
                          <div>
                            <span>Timeliness score</span>
                            <strong>{liveScore(i)}</strong>
                          </div>
                        )}
                        <p>
                          {criterion === "timeliness"
                            ? "Weekends and non-working days are excluded. Both dates are included."
                            : "Calculated from your entries. Rankings update when you save."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="month-navigation">
                <button
                  className="btn secondary small"
                  disabled={busy || month === 0}
                  onClick={() => {
                    setMonth((m) => m - 1);
                    setManualDays(false);
                  }}
                >
                  ← Previous month
                </button>
                <span>
                  {month + 1} of {MONTHS.length} months
                </span>
                <button
                  className="btn secondary small"
                  disabled={busy || month === MONTHS.length - 1}
                  onClick={() => {
                    setMonth((m) => m + 1);
                    setManualDays(false);
                  }}
                >
                  Next month →
                </button>
              </div>
            </div>
          </section>
          {message && (
            <div
              className={`notice ${message.ok ? "ok" : "error"}`}
              role={message.ok ? "status" : "alert"}
            >
              {message.text}
            </div>
          )}
          <div className="save-bar">
            <p>
              {dirty
                ? "Unsaved changes for this office and category."
                : "All changes saved. You can move to another month."}
            </p>
            <button
              className="btn"
              disabled={
                busy ||
                !officeCode ||
                !dirty ||
                (criterion === "timeliness" && calendarLoading)
              }
              onClick={save}
            >
              <Icon name="check" size={15} />
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
          <details className="section month-summary">
            <summary>
              <span>View all months</span>
              <span>
                {completeMonths} of {MONTHS.length} entered
              </span>
              <Icon name="down" size={15} />
            </summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reporting month</th>
                    {criterion === "timeliness" ? (
                      <>
                        <th>Released</th>
                        <th>Received</th>
                        <th>Working days</th>
                      </>
                    ) : (
                      <>
                        <th>{crit.first}</th>
                        {crit.second && <th>{crit.second}</th>}
                      </>
                    )}
                    <th>{criterion === "timeliness" ? "Score" : "Result"}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((m, i) => (
                    <tr
                      key={m}
                      className={month === i ? "selected-month-row" : ""}
                    >
                      <td>{m} 2026</td>
                      {criterion === "timeliness" ? (
                        <>
                          <td>{dates[i].released || "—"}</td>
                          <td>{dates[i].received || "—"}</td>
                          <td>{first[i] || "—"}</td>
                        </>
                      ) : (
                        <>
                          <td>{first[i] || "—"}</td>
                          {crit.second && <td>{second[i] || "—"}</td>}
                        </>
                      )}
                      <td>{liveScore(i)}</td>
                      <td>
                        <button
                          className="summary-edit"
                          disabled={busy}
                          onClick={() => {
                            setMonth(i);
                            setManualDays(false);
                            document
                              .querySelector(".focused-entry")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        >
                          Edit<span className="sr-only"> {m}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <dialog
        ref={discardDialog}
        className="customize-dialog"
        onCancel={() => setPending(null)}
        aria-labelledby="discard-title"
      >
        <h2 id="discard-title">Keep your changes?</h2>
        <p className="muted">
          Save your monthly scores before switching, or discard these unsaved
          entries.
        </p>
        <div className="dialog-actions">
          <button className="btn secondary" onClick={() => setPending(null)}>
            Keep editing
          </button>
          <button
            className="btn"
            onClick={() => {
              pending?.();
              setPending(null);
            }}
          >
            Discard & continue
          </button>
        </div>
      </dialog>
    </>
  );
}
