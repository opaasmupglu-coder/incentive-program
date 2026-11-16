"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
type Preferences = {
  accent: "forest" | "blue" | "plum";
  density: "comfortable" | "compact";
  showProgress: boolean;
  showOffices: boolean;
  showChecks: boolean;
};
const defaults: Preferences = {
  accent: "forest",
  density: "comfortable",
  showProgress: true,
  showOffices: true,
  showChecks: false,
};
const Context = createContext({
  preferences: defaults,
  openCustomize: () => {},
});
export const usePreferences = () => useContext(Context);
export default function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(defaults);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("incentive-preferences") || "null",
      );
      if (saved)
        setPreferences({
          ...defaults,
          accent: ["forest", "blue", "plum"].includes(saved.accent)
            ? saved.accent
            : defaults.accent,
          density: saved.density === "compact" ? "compact" : "comfortable",
          ...Object.fromEntries(
            ["showProgress", "showOffices", "showChecks"]
              .filter((k) => typeof saved[k] === "boolean")
              .map((k) => [k, saved[k]]),
          ),
        });
    } catch {
      /* Use defaults if storage is unavailable. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.accent = preferences.accent;
    document.documentElement.dataset.density = preferences.density;
    if (ready)
      try {
        localStorage.setItem(
          "incentive-preferences",
          JSON.stringify(preferences),
        );
      } catch {
        /* Apply for this visit. */
      }
  }, [preferences, ready]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <Context.Provider
      value={{ preferences, openCustomize: () => setOpen(true) }}
    >
      {children}
      <dialog
        ref={dialog}
        className="customize-dialog"
        onCancel={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setOpen(false);
        }}
        aria-labelledby="customize-title"
      >
        <div className="panel-title">
          <div>
            <p className="kicker">Make yourself at home</p>
            <h2 id="customize-title">Your workspace</h2>
          </div>
          <button
            className="icon-btn"
            aria-label="Close customization"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">
          Choose what works for you. Preferences are saved in this browser.
        </p>
        <fieldset>
          <legend>Accent color</legend>
          <div className="color-options">
            {(["forest", "blue", "plum"] as const).map((accent) => (
              <button
                key={accent}
                className={`color-option ${preferences.accent === accent ? "selected" : ""}`}
                aria-pressed={preferences.accent === accent}
                onClick={() => setPreferences((p) => ({ ...p, accent }))}
              >
                <span className={`swatch ${accent}`} />
                {accent === "forest"
                  ? "Forest"
                  : accent === "blue"
                    ? "Ocean"
                    : "Plum"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Display density</legend>
          <div className="segmented">
            {(["comfortable", "compact"] as const).map((density) => (
              <button
                key={density}
                aria-pressed={preferences.density === density}
                className={preferences.density === density ? "selected" : ""}
                onClick={() => setPreferences((p) => ({ ...p, density }))}
              >
                {density === "compact" ? "Compact" : "Comfortable"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Dashboard sections</legend>
          {(
            [
              ["showProgress", "Program progress"],
              ["showOffices", "Office overview"],
              ["showChecks", "Data checks"],
            ] as const
          ).map(([key, label]) => (
            <label className="toggle-row" key={key}>
              {label}
              <input
                type="checkbox"
                role="switch"
                checked={preferences[key]}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, [key]: e.target.checked }))
                }
              />
            </label>
          ))}
        </fieldset>
        <div className="dialog-actions">
          <button
            className="btn secondary"
            onClick={() => setPreferences(defaults)}
          >
            Reset defaults
          </button>
          <button className="btn" onClick={() => setOpen(false)}>
            Done <Icon name="check" size={16} />
          </button>
        </div>
      </dialog>
    </Context.Provider>
  );
}
