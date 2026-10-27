export function pacificDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (name: string) => Number(parts.find((x) => x.type === name)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
export function lastFriday(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - ((last.getUTCDay() + 2) % 7);
}
export function nextFriday(now: Date) {
  let { year, month, day } = pacificDate(now);
  let date = lastFriday(year, month);
  if (day > date) { month++; if (month > 12) { month = 1; year++; } date = lastFriday(year, month); }
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}
