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

export const toLocalDateAndTimeParts = (utcDate?: string | null, timeZone?: string) => {
  if (!utcDate) {
    return {
      date: "N/A",
      time: "N/A",
    };
  }

  const resolvedTimeZone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: resolvedTimeZone,
  }).format(new Date(utcDate));
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: resolvedTimeZone,
  }).format(new Date(utcDate));

  return { date, time };
};

export const minutesToDuration = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};
