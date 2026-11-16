"use client";
import { useState } from "react";
import { useCalendar } from "@/components/useCalendar";
import { countWorkingDays } from "@/lib/working-days";
import { ErrorState, LoadingState, PageHead } from "@/components/ui";
import Icon from "@/components/Icon";
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export default function CalendarPage() {
  const { days, error, loading } = useCalendar();
  const [month, setMonth] = useState(0);
  const [released, setReleased] = useState("");
  const [received, setReceived] = useState("");
  const selected = days.filter((d) => Number(d.date.slice(5, 7)) === month + 1);
  const count = countWorkingDays(days, released, received);
  const offset = new Date(Date.UTC(2026, month, 1)).getUTCDay();
  return (
    <>
      <PageHead
        kicker="Program calendar"
        title="Working-day calendar"
        description="Check the 2026 working days or calculate the time between two dates."
        right={
          <a
            className="btn secondary"
            href="https://docs.google.com/spreadsheets/d/1zhifhQ85bDP2kxqSDgMkRNZFkOCHMuMx/edit?gid=509378758"
            target="_blank"
            rel="noreferrer"
          >
            View source sheet <Icon name="arrow" size={15} />
          </a>
        }
      />
      {loading ? (
        <LoadingState what="Loading your working-day calendar" />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <>
          <div className="calendar-layout">
            <section className="section">
              <div className="section-head">
                <h3>2026 working days</h3>
                <p>
                  {days.filter((d) => d.working).length} working days this year
                </p>
              </div>
              <div className="section-body">
                <label htmlFor="calendar-month">Month</label>
                <select
                  id="calendar-month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {months.map((m, i) => (
                    <option key={m} value={i}>
                      {m} 2026 ·{" "}
                      {
                        days.filter(
                          (d) =>
                            Number(d.date.slice(5, 7)) === i + 1 && d.working,
                        ).length
                      }{" "}
                      working days
                    </option>
                  ))}
                </select>
                <div className="calendar-grid" style={{ marginTop: 17 }}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div className="calendar-weekday" key={d}>
                        {d}
                      </div>
                    ),
                  )}
                  {Array.from({ length: offset }, (_, i) => (
                    <span key={`blank-${i}`} />
                  ))}
                  {selected.map((d) => (
                    <div
                      key={d.date}
                      className={`calendar-day ${d.working ? "working" : ""}`}
                      title={`${d.date}: ${d.note}`}
                    >
                      <b>{Number(d.date.slice(8))}</b>
                    </div>
                  ))}
                </div>
                <div className="calendar-summary">
                  <span className="calendar-key" />
                  Working day
                  <span
                    className="calendar-key off"
                    style={{ marginLeft: 12 }}
                  />
                  Day off
                  <span style={{ marginLeft: "auto" }}>
                    {selected.filter((d) => d.working).length} working days
                  </span>
                </div>
              </div>
            </section>
            <section className="section">
              <div className="section-head">
                <h3>Timeliness calculator</h3>
                <Icon name="clock" size={17} />
              </div>
              <div className="section-body">
                <p className="muted" style={{ fontSize: 12 }}>
                  Choose the release and received dates. We’ll count only
                  working days, excluding the release date and including the
                  received date.
                </p>
                <label htmlFor="released">Date released</label>
                <input
                  id="released"
                  type="date"
                  min="2026-01-01"
                  max="2026-12-31"
                  value={released}
                  onChange={(e) => setReleased(e.target.value)}
                />
                <label htmlFor="received">Date received</label>
                <input
                  id="received"
                  type="date"
                  min={released || "2026-01-01"}
                  max="2026-12-31"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
                <div className="calculator-result" aria-live="polite">
                  <span className="big-number">
                    {count === null ? "—" : count}
                  </span>
                  <p>
                    working days{" "}
                    {count === null
                      ? "· select a valid date range"
                      : "· release day excluded"}
                  </p>
                </div>
                {released && received && received < released && (
                  <p className="notice error">
                    Received date must be on or after the release date.
                  </p>
                )}
                <div className="tip">
                  <Icon name="help" size={18} />
                  <p>
                    Uses the supplied Working Days sheet. Fridays in four-day
                    weeks are off. Half-day suspensions and work-from-home days
                    count as working when marked in the source.
                  </p>
                </div>
              </div>
            </section>
          </div>
          <section className="section">
            <div className="section-head">
              <h3>{months[month]} · days off & exceptions</h3>
              <p>Hover over a calendar day to see its note</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Calendar note</th>
                  </tr>
                </thead>
                <tbody>
                  {selected
                    .filter((d) => d.note !== "Working" && d.note !== "Weekend")
                    .map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>
                          <span
                            className={`badge ${d.working ? "green" : "neutral"}`}
                          >
                            {d.working ? "Working" : "Day off"}
                          </span>
                        </td>
                        <td>{d.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
