"use client";
import { useEffect, useState } from "react";
import type { CalendarDay } from "@/lib/calendar";
export function useCalendar(office = "") {
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [dates, setDates] = useState<
    { month: number; released: string; received: string }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedOffice, setLoadedOffice] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/calendar${office ? `?office=${encodeURIComponent(office)}` : ""}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        setDays(data.days);
        setDates(data.dates);
        setLoadedOffice(office);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Could not load the calendar.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [office]);
  return { days, dates, error, loading, loadedOffice };
}
