export const toLocalDateTime = (utcDate: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(utcDate));

export const toLocalDate = (utcDate: string, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(utcDate));

export const minutesToDuration = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

