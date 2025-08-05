import { CalendarData, DayMarker } from './Calendar';

/**
 * Helper function to create calendar data for specific dates
 */
export function createCalendarData(entries: Array<{
  date: string; // Format: 'YYYY-MM-DD'
  emoji?: string;
  color?: string;
  textColor?: string;
  note?: string;
}>): CalendarData {
  const data: CalendarData = {};
  
  entries.forEach(entry => {
    data[entry.date] = {
      emoji: entry.emoji,
      color: entry.color,
      textColor: entry.textColor,
      note: entry.note,
    };
  });
  
  return data;
}

/**
 * Helper function to add/update a single date in calendar data
 */
export function updateCalendarDate(
  data: CalendarData,
  date: string,
  marker: DayMarker
): CalendarData {
  return {
    ...data,
    [date]: { ...data[date], ...marker },
  };
}

/**
 * Helper function to remove a date from calendar data
 */
export function removeCalendarDate(data: CalendarData, date: string): CalendarData {
  const newData = { ...data };
  delete newData[date];
  return newData;
}

/**
 * Helper function to get today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Helper function to format date string
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Predefined fitness-related emojis for quick selection
 */
export const FITNESS_EMOJIS = {
  workout: '💪',
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  yoga: '🧘',
  gym: '🏋️',
  cardio: '❤️',
  rest: '😴',
  injury: '🤕',
  progress: '📈',
  goal: '🎯',
  achievement: '🏆',
  nutrition: '🥗',
  water: '💧',
  stretching: '🤸',
} as const;

/**
 * Predefined color schemes for different types of activities
 */
export const ACTIVITY_COLORS = {
  workout: '#FF6B6B',
  cardio: '#4ECDC4',
  strength: '#45B7D1',
  flexibility: '#96CEB4',
  rest: '#FECA57',
  nutrition: '#48CAE4',
  goal: '#9B59B6',
  achievement: '#F39C12',
} as const;