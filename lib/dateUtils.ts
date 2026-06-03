export const getTodayString = (): string => {
  return new Date().toLocaleDateString("en-CA");
};

export const findMostRecentSessionDate = (
  dates: string[],
  today: string,
): string | null => {
  return (
    [...dates].sort((a, b) => b.localeCompare(a)).find((d) => d < today) ?? null
  );
};

export const timestampToMillis = (value: unknown): number => {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
};

export const formatDateAsString = (dateString: string): string => {
  const today = getTodayString();

  // If it's today, return "Today"
  if (dateString === today) {
    return "Today";
  }

  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();

  // Add ordinal suffix to day
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${day}${getOrdinalSuffix(day)} of ${month} ${year}`;
};

export const getISOWeek = (date: Date): string => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // nearest Thursday
  const yearStart = new Date(d.getFullYear(), 0, 4); // Jan 4 is always in week 1
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 +
      ((yearStart.getDay() + 6) % 7) +
      1) /
      7,
  );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

export const getPreviousWeek = (isoWeek: string): string => {
  const [year, week] = isoWeek.split("-W").map(Number);

  if (week > 1) {
    return `${year}-W${String(week - 1).padStart(2, "0")}`;
  }

  // Week 1 → last week of previous year (either W52 or W53)
  const lastWeekOfPrevYear = getISOWeek(new Date(year - 1, 11, 28)); // Dec 28 is always in the last week
  return lastWeekOfPrevYear;
};
