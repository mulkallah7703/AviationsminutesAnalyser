const numberFormat = new Intl.NumberFormat("ar-EG");
const dateFormat = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const relative = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

export function formatCount(value: number | null, hidden = false): string {
  if (hidden) return "مخفي";
  if (value === null || Number.isNaN(value)) return "—";
  return numberFormat.format(value);
}

export function formatUtcDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatPublished(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const time = date.getTime();
  if (Number.isNaN(time)) return "";
  const absolute = dateFormat.format(date);
  const minutes = Math.round((time - now) / 60000);
  const absMinutes = Math.abs(minutes);
  let relativeLabel: string;
  if (absMinutes < 60) {
    relativeLabel = relative.format(minutes, "minute");
  } else {
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      relativeLabel = relative.format(hours, "hour");
    } else {
      const days = Math.round(hours / 24);
      if (Math.abs(days) < 30) {
        relativeLabel = relative.format(days, "day");
      } else {
        const months = Math.round(days / 30);
        if (Math.abs(months) < 12) {
          relativeLabel = relative.format(months, "month");
        } else {
          relativeLabel = relative.format(Math.round(days / 365), "year");
        }
      }
    }
  }
  return `${relativeLabel} · ${absolute}`;
}
