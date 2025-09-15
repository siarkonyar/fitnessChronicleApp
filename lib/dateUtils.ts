/**
 * Utility functions for date formatting and manipulation
 */

/**
 * Formats a date string to a human-readable format with ordinal suffix
 * @param dateString - Date string in ISO format (e.g., "2024-01-15")
 * @returns Formatted date string (e.g., "15th of January")
 */

export const getTodayString = (): string => {
  return new Date().toLocaleDateString("en-CA");
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

/**
 * Gets today's date in YYYY-MM-DD format
 * @returns Today's date as string (e.g., "2024-01-15")
 */
