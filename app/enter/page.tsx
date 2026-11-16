"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MONTHS } from "@/lib/types";
import { fmtPct, useSnapshot } from "@/components/useSnapshot";
import { useCalendar } from "@/components/useCalendar";
import { countWorkingDays } from "@/lib/working-days";
import {
  resolutionRate,
  collectionRate,
  timelinessScore,
  gprRate,
} from "@/lib/compute";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
} from "@/components/ui";
import Icon from "@/components/Icon";
type Criterion = "resolution" | "collection" | "gpr" | "timeliness";
const criteria = [
  {
    key: "resolution" as const,
    label: "Action plans resolved",
    first: "Total Acted Upon",
    second: "Total Negative Comments + Suggestions",
    hint: "Resolution rate = Total Acted Upon ÷ combined negative comments and suggestions. Include both types in the acted-upon count.",
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
    first: "Recorded GAR (%)",
    second: null,
    hint: "Enter the office’s General Average Rating as a percentage, for example 95.63.",
  },
  {
    key: "timeliness" as const,
    label: "Submission dates",
    first: "Working days",
    second: null,
    hint: "Enter this office’s release and received dates. Counting starts the day after release and includes the received date, using the working-day calendar.",
  },
];
const blankDates = () =>
  Array.from({ length: 10 }, () => ({ released: "", received: "" }));
export default function EnterPage() {
  const { snap, loading, error, refresh, setSaving } = useSnapshot();
  const [track, setTrack] = useState("Frontline");
  const [officeCode, setOfficeCode] = useState("");
  const [criterion, setCriterion] = useState<Criterion>("resolution");
  const [editAll, setEditAll] = useState(false);
  const [editedMonth, setEditedMonth] = useState<number | null>(null);
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
  // Preserve the API's numerator/denominator order while showing the combined count first.
  const inputFields = [
    { key: "first", label: crit.first, values: first, setValues: setFirst },
    ...(crit.second
      ? [
          {
            key: "second",
            label: crit.second,
            values: second,
            setValues: setSecond,
          },
        ]
      : []),
  ];
  if (criterion === "resolution") inputFields.reverse();
  const office = snap.offices.find((o) => o.code === officeCode);
  const minForms =
    track === "Frontline"
      ? (snap.settings?.minFormsFL ?? 20)
      : (snap.settings?.minFormsNFL ?? 10);
  const recordedForms = (i: number) =>
    snap.inputCollection.find((r) => r.code === officeCode)?.first[i] ?? null;
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const noSubmissionRequired = (i: number) =>
    snap.inputTimeliness.find((r) => r.code === officeCode)?.second[i] === 0;
  const liveScore = (i: number) => {
    const a = num(first[i]),
      b = num(second[i]);
    if (criterion === "resolution") return fmtPct(resolutionRate(a, b));
    if (criterion === "collection")
      return fmtPct(
        collectionRate(a, b, snap.settings?.sampleConstant || 384.16, minForms),
      );
    if (criterion === "gpr")
      return fmtPct(gprRate(a, recordedForms(i), minForms));
    if (noSubmissionRequired(i)) return "1.00";
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
        text: "Total Acted Upon cannot exceed Total Negative Comments + Suggestions.",
        ok: false,
      });
      return;
    }
    if (
      criterion === "timeliness" &&
      dates.some(
        (d, i) =>
          !noSubmissionRequired(i) &&
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
      setEditAll(false);
      setEditedMonth(null);
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
        description="Choose an office and category. Review all months, edit one row, or edit all at once."
      />
      {!snap.connected ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <section className="section entry-selection">
            <div className="section-body compact-office-picker">
              <div>
                <label htmlFor="office">Office</label>
                <select
                  id="office"
                  disabled={busy}
                  value={officeCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    navigate(() => {
                      setOfficeCode(code);
                      setTrack(
                        snap.offices.find((o) => o.code === code)?.track ||
                          "Frontline",
                      );
                      setManualDays(false);
                      setEditAll(false);
                      setEditedMonth(null);
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
              <p className="entry-focal">
                <Icon name="people" size={15} />{" "}
                <span>
                  Focal person: <b>{office?.focal || "Not assigned"}</b>
                  {office?.focalPosition ? ` · ${office.focalPosition}` : ""}
                </span>
                <Link href="/offices">Edit</Link>
              </p>
            </div>
          </section>
          <div className="entry-category">
            <span className="entry-category-label" id="entry-category-label">
              What are you updating?
            </span>
            <div
              className="entry-tabs"
              role="tablist"
              aria-labelledby="entry-category-label"
            >
              {criteria.map((c, index) => {
                const choose = (next: Criterion) =>
                  navigate(() => {
                    setCriterion(next);
                    setManualDays(false);
                    setEditAll(false);
                    setEditedMonth(null);
                    setDirty(false);
                    document.getElementById(`criterion-${next}`)?.focus();
                  });
                return (
                  <button
                    key={c.key}
                    id={`criterion-${c.key}`}
                    type="button"
                    role="tab"
                    disabled={busy}
                    aria-selected={criterion === c.key}
                    aria-controls="entry-panel"
                    tabIndex={criterion === c.key ? 0 : -1}
                    className={criterion === c.key ? "selected" : ""}
                    onClick={() => choose(c.key)}
                    onKeyDown={(e) => {
                      const next =
                        e.key === "ArrowRight"
                          ? (index + 1) % criteria.length
                          : e.key === "ArrowLeft"
                            ? (index + criteria.length - 1) % criteria.length
                            : e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? criteria.length - 1
                                : null;
                      if (next !== null) {
                        e.preventDefault();
                        choose(criteria[next].key);
                      }
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <section
            className="section focused-entry monthly-table-panel"
            id="entry-panel"
            role="tabpanel"
            aria-labelledby={`criterion-${criterion}`}
          >
            <div className="section-head">
              <div>
                <h3>{crit.label}</h3>
                <p className="section-description">
                  January–October 2026 · {office?.short || office?.name}
                </p>
              </div>
              <div className="monthly-table-actions">
                {criterion === "timeliness" && (
                  <button
                    className="btn small secondary"
                    disabled={busy}
                    aria-pressed={manualDays}
                    onClick={() => setManualDays((p) => !p)}
                  >
                    {manualDays ? "Use dates" : "Enter days instead"}
                  </button>
                )}
                <button
                  className={`btn small ${editAll ? "" : "secondary"}`}
                  disabled={busy}
                  aria-pressed={editAll}
                  onClick={() => {
                    setEditAll((p) => !p);
                    setEditedMonth(null);
                  }}
                >
                  <Icon name="edit" size={14} />
                  {editAll ? "Done editing" : "Edit all"}
                </button>
              </div>
            </div>
            <p className="table-entry-hint">
              {crit.hint}
              {(criterion === "collection" || criterion === "gpr") &&
                ` Fewer than ${minForms} forms in a month scores 0% for both collection and GPR. The original GAR is kept for reference.`}
              {criterion === "timeliness"
                ? " Submission requirements remain based on negative comments only."
                : ""}
            </p>
            {criterion === "timeliness" && calendarError && (
              <ErrorState error={calendarError} />
            )}
            <div className="table-wrap">
              <table
                className={`monthly-entry-table ${criterion === "timeliness" ? "dates-entry-table" : ""}`}
              >
                <thead>
                  <tr>
                    <th>Month</th>
                    {criterion === "timeliness" ? (
                      <>
                        <th>Date released</th>
                        <th>Date received</th>
                        <th className="num">Working days</th>
                      </>
                    ) : (
                      inputFields.map((field) => (
                        <th key={field.key}>{field.label}</th>
                      ))
                    )}
                    <th className="num">
                      {criterion === "timeliness"
                        ? "Timeliness score"
                        : criterion === "gpr"
                          ? "Scored GPR"
                          : criterion === "collection"
                            ? "Collection rate"
                            : "Resolution rate"}
                    </th>
                    <th>
                      <span className="sr-only">Edit row</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((m, i) => {
                    const editing = editAll || editedMonth === i;
                    const zeroNegative = second[i] === "0";
                    const noSubmission =
                      criterion === "timeliness" && noSubmissionRequired(i);
                    const rawScore = liveScore(i);
                    const formCount =
                      criterion === "collection"
                        ? num(first[i])
                        : recordedForms(i);
                    const belowMinimum =
                      (criterion === "collection" || criterion === "gpr") &&
                      formCount !== null &&
                      formCount < minForms;
                    const score =
                      criterion === "timeliness" && rawScore !== "—"
                        ? fmtPct(Number(rawScore))
                        : rawScore;
                    return (
                      <tr
                        key={m}
                        className={`${editing ? "editing-row" : ""} ${noSubmission ? "not-required-row" : ""}`}
                      >
                        <th scope="row">{m}</th>
                        {criterion === "timeliness" ? (
                          <>
                            {(["released", "received"] as const).map(
                              (key, j) => (
                                <td key={key}>
                                  {noSubmission ? (
                                    <span className="not-required-text">
                                      Not required
                                    </span>
                                  ) : editing && !manualDays ? (
                                    <input
                                      id={`${j === 0 ? "release" : "receive"}-${i}`}
                                      type="date"
                                      aria-label={`${m} Date ${key}`}
                                      min={
                                        j === 0
                                          ? "2026-01-01"
                                          : dates[i].released || "2026-01-01"
                                      }
                                      max="2026-12-31"
                                      value={dates[i][key]}
                                      disabled={busy || calendarLoading}
                                      onChange={(e) =>
                                        updateDate(i, key, e.target.value)
                                      }
                                    />
                                  ) : (
                                    <span>{dates[i][key] || "—"}</span>
                                  )}
                                </td>
                              ),
                            )}
                            <td className="num">
                              {noSubmission ? (
                                <span className="not-required-text">
                                  Not required
                                </span>
                              ) : editing && manualDays ? (
                                <input
                                  type="number"
                                  aria-label={`${m} Working days`}
                                  min={0}
                                  step={1}
                                  disabled={busy}
                                  value={first[i]}
                                  placeholder="—"
                                  onChange={(e) => {
                                    setFirst((p) =>
                                      p.map((v, j) =>
                                        j === i ? e.target.value : v,
                                      ),
                                    );
                                    setDates((p) =>
                                      p.map((d, j) =>
                                        j === i
                                          ? { released: "", received: "" }
                                          : d,
                                      ),
                                    );
                                    setDirty(true);
                                    setMessage(null);
                                  }}
                                />
                              ) : (
                                <span>{first[i] || "—"}</span>
                              )}
                            </td>
                          </>
                        ) : (
                          inputFields.map((field) => {
                            const notRequired =
                              criterion === "resolution" &&
                              field.key === "first" &&
                              zeroNegative;
                            return (
                              <td key={field.key}>
                                {notRequired ? (
                                  <span className="not-required-text">
                                    Not required
                                  </span>
                                ) : editing ? (
                                  <input
                                    type="number"
                                    id={`${field.key === "first" ? "f" : "s"}-${i}`}
                                    aria-label={`${m} ${field.label}`}
                                    min={0}
                                    max={criterion === "gpr" ? 100 : undefined}
                                    step={criterion === "gpr" ? "0.01" : "1"}
                                    disabled={busy}
                                    value={field.values[i]}
                                    placeholder="—"
                                    onChange={(e) => {
                                      field.setValues((p) =>
                                        p.map((v, j) =>
                                          j === i ? e.target.value : v,
                                        ),
                                      );
                                      if (
                                        criterion === "resolution" &&
                                        field.key === "second" &&
                                        e.target.value === "0"
                                      )
                                        setFirst((p) =>
                                          p.map((v, j) => (j === i ? "" : v)),
                                        );
                                      setDirty(true);
                                      setMessage(null);
                                    }}
                                  />
                                ) : (
                                  <span>
                                    {criterion === "gpr" &&
                                    field.values[i] !== ""
                                      ? Number(field.values[i]).toFixed(2)
                                      : field.values[i] || "—"}
                                  </span>
                                )}
                              </td>
                            );
                          })
                        )}
                        <td className="num monthly-result">
                          <b>{score}</b>
                          {belowMinimum && (
                            <small className="below-minimum-note">
                              Below minimum ({formCount}/{minForms} forms)
                            </small>
                          )}
                          {(noSubmission ||
                            (criterion === "resolution" && zeroNegative)) && (
                            <small>No action required</small>
                          )}
                        </td>
                        <td>
                          {noSubmission ? (
                            <span className="badge green">Not required</span>
                          ) : (
                            !editAll && (
                              <button
                                className="row-edit-button"
                                disabled={busy}
                                aria-label={`${editing ? "Done editing" : "Edit"} ${m}`}
                                onClick={() =>
                                  setEditedMonth(editing ? null : i)
                                }
                              >
                                {editing ? "Done" : "Edit"}
                                <Icon
                                  name={editing ? "check" : "edit"}
                                  size={13}
                                />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span>All {MONTHS.length} reporting months shown</span>
              <span>
                {criterion === "resolution"
                  ? "0 negative comments + suggestions = 100%"
                  : criterion === "timeliness"
                    ? "0 negative comments = no submission required"
                    : "Blank values mean no data"}
              </span>
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
                ? "You have unsaved changes for this office and category."
                : "Select Edit on a month, or Edit all to update multiple months."}
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
