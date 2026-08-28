const PACIFIC_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Pacific calendar day with a calendar offset (safe across 23/25-hour DST days). */
export function docketDayKey(date = new Date(), offsetDays = 0): string {
  const parts = Object.fromEntries(PACIFIC_DATE.formatToParts(date).map((part) => [part.type, part.value]));
  const shifted = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + offsetDays));
  return shifted.toISOString().slice(0, 10);
}
