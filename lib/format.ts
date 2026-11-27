const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatNet(iso: string | null | undefined) {
  if (!iso) return "Date TBD";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "Date TBD";
  return DATE_FORMAT.format(new Date(time));
}

export function formatShort(iso: string | null | undefined) {
  if (!iso) return "TBD";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "TBD";
  return `${SHORT_DATE.format(new Date(time))} UTC`;
}

export function relativeTime(iso: string | null | undefined) {
  if (!iso) return "unknown";
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return formatter.format(Math.round(diff / ms), unit);
    }
  }
  return "now";
}

export function statusTone(abbrev: string) {
  switch (abbrev) {
    case "Success":
      return "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";
    case "Failure":
    case "Partial Failure":
      return "text-rose-300 border-rose-400/30 bg-rose-400/10";
    case "In Flight":
      return "text-amber-300 border-amber-400/30 bg-amber-400/10";
    case "Go":
      return "text-cyan-300 border-cyan-400/30 bg-cyan-400/10";
    case "Hold":
      return "text-orange-300 border-orange-400/30 bg-orange-400/10";
    default:
      return "text-slate-300 border-slate-400/25 bg-slate-400/10";
  }
}

export function timeUntil(iso: string) {
  const target = Date.parse(iso);
  if (Number.isNaN(target)) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: false };
  const diff = target - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    seconds: Math.floor((abs % 60_000) / 1000),
    past,
  };
}
