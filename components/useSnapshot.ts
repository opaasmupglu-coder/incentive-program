"use client";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/lib/types";

export function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchNow = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshot", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the sheet.");
      setSnap(data as Snapshot);
      setLastSynced(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sheet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNow();
    const id = setInterval(fetchNow, 30_000);
    const onFocus = () => fetchNow();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchNow]);

  return { snap, loading, error, lastSynced, refresh: fetchNow, saving, setSaving };
}

export function freshnessText(lastSynced: Date | null): string {
  if (!lastSynced) return "Not synced yet";
  const s = Math.max(0, Math.floor((Date.now() - lastSynced.getTime()) / 1000));
  if (s < 10) return "Last synced just now";
  if (s < 60) return `Last synced ${s} sec ago`;
  const m = Math.floor(s / 60);
  if (m === 1) return "Last synced 1 min ago";
  return `Last synced ${m} min ago`;
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtNum(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(digits);
}
