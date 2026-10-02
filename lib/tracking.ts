export function trackingStartDay(startedAt: Date | null | undefined) {
  if (!startedAt) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(startedAt);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isTrackedTransactionDate(date: string, startedAt: Date | null | undefined) {
  const startDay = trackingStartDay(startedAt);
  return !startDay || date >= startDay;
}

export function isTrackedSourceTime(timestamp: string | number | Date | null | undefined, startedAt: Date | null | undefined) {
  if (!startedAt || timestamp === null || timestamp === undefined) return true;
  const value = timestamp instanceof Date
    ? timestamp
    : new Date(typeof timestamp === "string" && /^\d+$/.test(timestamp) ? Number(timestamp) : timestamp);
  return !Number.isNaN(value.getTime()) && value >= startedAt;
}
