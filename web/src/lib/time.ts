const UNITS = [
  { seconds: 86_400, label: "d" },
  { seconds: 3_600, label: "h" },
  { seconds: 60, label: "m" },
  { seconds: 1, label: "s" },
] as const;

/// "3d 4h", "4h 12m", "12m 5s", "45s": the largest unit and the one after it, which is
/// left out when zero ("1d", not "1d 0h").
export function formatDuration(totalSeconds: number | bigint): string {
  const total = Math.max(0, Math.floor(Number(totalSeconds)));
  const index = UNITS.findIndex(({ seconds }) => total >= seconds);
  const first = UNITS[index];
  if (!first) return "0s";
  const lead = Math.floor(total / first.seconds);
  const next = UNITS[index + 1];
  const rest = next ? Math.floor((total - lead * first.seconds) / next.seconds) : 0;
  return next && rest > 0 ? `${lead}${first.label} ${rest}${next.label}` : `${lead}${first.label}`;
}

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const formatUtc = (unixSeconds: number | bigint): string => DATE.format(new Date(Number(unixSeconds) * 1000));
