"use client";
import { useEffect, useState } from "react";
import { useSnapshot } from "@/components/useSnapshot";
import {
  ErrorState,
  LoadingState,
  NotConnected,
  PageHead,
} from "@/components/ui";
import Icon from "@/components/Icon";
export default function OfficesPage() {
  const { snap, loading, error, refresh, setSaving } = useSnapshot();
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("All offices");
  const [drafts, setDrafts] = useState<
    Record<string, { focal: string; focalPosition: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const changed = Object.keys(drafts).filter((code) => {
    const o = snap?.offices.find((o) => o.code === code);
    return (
      o &&
      (o.focal !== drafts[code].focal ||
        o.focalPosition !== drafts[code].focalPosition)
    );
  });
  useEffect(() => {
    if (!changed.length) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed.length]);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!snap) return <LoadingState />;
  const offices = snap.offices.filter(
    (o) =>
      (track === "All offices" || o.track === track) &&
      `${o.name} ${o.code} ${drafts[o.code]?.focal ?? o.focal}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function save() {
    setBusy(true);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offices: changed.map((code) => ({ code, ...drafts[code] })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save changes.");
      await refresh();
      setDrafts({});
      setMessage({
        text: `Focal persons updated for ${data.updated} office${data.updated === 1 ? "" : "s"}.`,
        ok: true,
      });
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Could not save. Try again.",
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
        kicker="Manage your team"
        title="Offices & people"
        description="The right people, in the right place. Update focal persons and their positions here."
        right={
          <span className="badge green">{snap.offices.length} offices</span>
        }
      />
      {!snap.connected ? (
        <NotConnected missingEnv={snap.missingEnv} />
      ) : (
        <>
          <div className="settings-help">
            <b>Keeping your team up to date is simple.</b>
            <p>
              Edit a name or position below, then save your changes. Updates
              appear in monthly entry and final results.
            </p>
          </div>
          <section className="section">
            <div className="toolbar">
              <div className="segmented">
                {["All offices", "Frontline", "Non-frontline"].map((t) => (
                  <button
                    key={t}
                    className={track === t ? "selected" : ""}
                    aria-pressed={track === t}
                    onClick={() => setTrack(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="search-field">
                <Icon name="search" size={15} />
                <input
                  type="text"
                  placeholder="Search offices or people…"
                  aria-label="Search offices or people"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
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
                    <th>Position / designation</th>
                  </tr>
                </thead>
                <tbody>
                  {offices.map((o) => {
                    const d = drafts[o.code] || {
                      focal: o.focal,
                      focalPosition: o.focalPosition,
                    };
                    return (
                      <tr key={o.code}>
                        <td style={{ minWidth: 220 }}>
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
                        <td style={{ minWidth: 200 }}>
                          <input
                            disabled={busy}
                            type="text"
                            maxLength={200}
                            aria-label={`Focal person for ${o.name}`}
                            value={d.focal}
                            placeholder="Enter full name"
                            onChange={(e) => {
                              setDrafts((p) => ({
                                ...p,
                                [o.code]: { ...d, focal: e.target.value },
                              }));
                              setMessage(null);
                            }}
                          />
                        </td>
                        <td style={{ minWidth: 220 }}>
                          <input
                            disabled={busy}
                            type="text"
                            maxLength={200}
                            aria-label={`Position for ${o.name}`}
                            value={d.focalPosition}
                            placeholder="Enter position"
                            onChange={(e) => {
                              setDrafts((p) => ({
                                ...p,
                                [o.code]: {
                                  ...d,
                                  focalPosition: e.target.value,
                                },
                              }));
                              setMessage(null);
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!offices.length && (
              <div className="empty-state">No offices match your search.</div>
            )}
            <div className="table-foot">
              <span>{offices.length} offices shown</span>
              <span>Changes are saved only when you select Save changes.</span>
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
              {changed.length
                ? `${changed.length} office${changed.length === 1 ? "" : "s"} with unsaved changes`
                : "All changes saved"}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn secondary"
                disabled={busy || !changed.length}
                onClick={() => {
                  setDrafts({});
                  setMessage(null);
                }}
              >
                Discard changes
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={busy || !changed.length}
              >
                <Icon name="check" size={15} />
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
