"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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
    label: "Resolution",
    first: "Acted upon",
    second: "With action plans",
    hint: "How many feedback items were acted upon, out of those with action plans?",
  },
  {
    key: "collection" as const,
    label: "Collection",
    first: "Forms collected",
    second: "Total clients",
    hint: "Enter forms collected and total clients. The collection rate is calculated for you.",
  },
  {
    key: "gpr" as const,
    label: "Performance rating",
    first: "GPR (0–100)",
    second: null,
    hint: "Enter the office’s General Performance Rating, from 0 to 100.",
  },
  {
    key: "timeliness" as const,
    label: "Timeliness",
    first: "Working days",
    second: null,
    hint: "Choose release and received dates to count working days automatically. Or enter a day count; use 99 for an unsubmitted plan.",
  },
];
const blankDates = () =>
  Array.from({ length: 10 }, () => ({ released: "", received: "" }));
export default function EnterPage() {
  const { snap, loading, error, refresh, setSaving } = useSnapshot();
  const [track, setTrack] = useState("Frontline");
  const [officeCode, setOfficeCode] = useState("");
  const [criterion, setCriterion] = useState<Criterion>("resolution");
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
  const offices = useMemo(
    () => (snap?.offices || []).filter((o) => o.track === track),
    [snap, track],
  );
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
      values.some((v) => !Number.isFinite(v) || v < 0 || !Number.isInteger(v))
    ) {
      setMessage({
        text: "Enter non-negative whole numbers for every value.",
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
        title="A little progress, every month"
        description="Choose an office, enter the numbers, and let us take care of the calculations."
        right={
          <Link className="btn secondary" href="/rankings">
            View rankings <Icon name="arrow" size={14} />
          </Link>
        }
      />
      {!snap.connected ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <section className="section">
            <SectionHead
              num="01"
              title="Choose your office"
              note="January – October 2026"
            />
            <div className="section-body">
              <div className="field-row">
                <div>
                  <label htmlFor="track">Evaluation track</label>
                  <select
                    id="track"
                    disabled={busy}
                    value={track}
                    onChange={(e) => {
                      const value = e.target.value;
                      navigate(() => {
                        setTrack(value);
                        setOfficeCode(
                          snap.offices.find((o) => o.track === value)?.code ||
                            "",
                        );
                        setDirty(false);
                      });
                    }}
                  >
                    <option>Frontline</option>
                    <option>Non-frontline</option>
                  </select>
                </div>
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
                        setDirty(false);
                      });
                    }}
                  >
                    {offices.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 11, margin: "16px 0 0" }}>
                <Icon name="people" size={14} /> Focal person:{" "}
                <b>{office?.focal || "Not assigned"}</b>
                {office?.focalPosition ? ` · ${office.focalPosition}` : ""}{" "}
                <Link href="/offices" style={{ marginLeft: 8 }}>
                  Edit focal person
                </Link>
              </p>
            </div>
          </section>
          <div className="tabs" aria-label="Evaluation criterion">
            {criteria.map((c) => (
              <button
                key={c.key}
                disabled={busy}
                aria-pressed={criterion === c.key}
                className={criterion === c.key ? "selected" : ""}
                onClick={() =>
                  navigate(() => {
                    setCriterion(c.key);
                    setDirty(false);
                  })
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <section className="section">
            <SectionHead
              num="02"
              title={`${crit.label} · ${office?.short || office?.name || "Select an office"}`}
              note={`${completeMonths} of ${MONTHS.length} months entered`}
            />
            <div className="section-body">
              <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
                {crit.hint}
              </p>
              {criterion === "timeliness" && calendarError && (
                <ErrorState error={calendarError} />
              )}
              <div className="month-grid">
                {MONTHS.map((m, i) => {
                  const working = days.filter(
                    (d) => Number(d.date.slice(5, 7)) === i + 1 && d.working,
                  ).length;
                  return (
                    <div className="month-cell" key={m}>
                      <b>
                        {m.slice(0, 3)}
                        <span className="month-meta">
                          {days.length ? `${working} working days` : "2026"}
                        </span>
                      </b>
                      {criterion === "timeliness" && (
                        <>
                          <label htmlFor={`release-${i}`}>Date released</label>
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
                          <label htmlFor={`receive-${i}`}>Date received</label>
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
                        </>
                      )}
                      <label htmlFor={`f-${i}`}>{crit.first}</label>
                      <input
                        disabled={
                          busy ||
                          (criterion === "timeliness" &&
                            Boolean(dates[i].released || dates[i].received))
                        }
                        id={`f-${i}`}
                        aria-label={`${m} ${crit.first}`}
                        type="number"
                        min={0}
                        max={criterion === "gpr" ? 100 : undefined}
                        step={1}
                        value={first[i]}
                        placeholder="—"
                        onChange={(e) => {
                          setFirst((p) =>
                            p.map((v, j) => (j === i ? e.target.value : v)),
                          );
                          setDirty(true);
                          setMessage(null);
                        }}
                      />
                      {crit.second && (
                        <>
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
                                p.map((v, j) => (j === i ? e.target.value : v)),
                              );
                              setDirty(true);
                              setMessage(null);
                            }}
                          />
                        </>
                      )}
                      <div className="computed">
                        {criterion === "timeliness" ? "Score" : "Rate"}:{" "}
                        <b>{liveScore(i)}</b>
                      </div>
                    </div>
                  );
                })}
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
                ? "You have unsaved changes. Blank months are saved as no data."
                : "Blank means no data. A zero is a recorded score."}
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
              {busy ? "Saving…" : "Save monthly scores"}
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
