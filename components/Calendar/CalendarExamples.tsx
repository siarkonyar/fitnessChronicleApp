/**
 * Advanced usage examples for the Custom Calendar component
 * This file shows various ways to customize and use the calendar
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, CalendarData } from './Calendar';
import { createCalendarData, FITNESS_EMOJIS, ACTIVITY_COLORS } from './calendarUtils';

// Example 1: Simple calendar with basic emoji markers
export function SimpleCalendarExample() {
  const [data] = useState<CalendarData>(
    createCalendarData([
      { date: '2024-12-20', emoji: '💪' },
      { date: '2024-12-21', emoji: '🏃' },
      { date: '2024-12-22', emoji: '😴' },
    ])
  );

  return (
    <Calendar
      data={data}
      onDayPress={(day, marker) => {
        console.log('Pressed:', day.dateString, marker);
      }}
    />
  );
}

// Example 2: Calendar with custom colors and notes
export function ColorfulCalendarExample() {
  const [data] = useState<CalendarData>(
    createCalendarData([
      {
        date: '2024-12-20',
        emoji: FITNESS_EMOJIS.gym,
        color: ACTIVITY_COLORS.strength,
        note: 'Leg day - 2 hours',
      },
      {
        date: '2024-12-21',
        emoji: FITNESS_EMOJIS.cardio,
        color: ACTIVITY_COLORS.cardio,
        note: 'HIIT workout - 45 minutes',
      },
      {
        date: '2024-12-22',
        emoji: FITNESS_EMOJIS.rest,
        color: ACTIVITY_COLORS.rest,
        note: 'Recovery day',
      },
    ])
  );

  return (
    <Calendar
      data={data}
      showNotes={true}
      onDayPress={(day, marker) => {
        if (marker?.note) {
          alert(`${day.dateString}: ${marker.note}`);
        }
      }}
    />
  );
}

// Example 3: Calendar with custom styling
export function StyledCalendarExample() {
  const [data] = useState<CalendarData>(
    createCalendarData([
      { date: '2024-12-20', emoji: '🎯', color: '#E74C3C' },
      { date: '2024-12-21', emoji: '🏆', color: '#F39C12' },
    ])
  );

  return (
    <Calendar
      data={data}
      customStyle={{
        container: {
          backgroundColor: '#F8F9FA',
          borderRadius: 16,
          padding: 8,
        },
        calendar: {
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
        },
        header: {
          backgroundColor: '#6C7CE7',
          padding: 20,
          borderRadius: 8,
        },
      }}
    />
  );
}

// Example 4: Calendar with dynamic data management
export function DynamicCalendarExample() {
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [selectedActivity, setSelectedActivity] = useState(FITNESS_EMOJIS.workout);

  const addActivity = (date: string) => {
    setCalendarData(prev => ({
      ...prev,
      [date]: {
        emoji: selectedActivity,
        color: ACTIVITY_COLORS.workout,
        note: `Added on ${new Date().toLocaleTimeString()}`,
      },
    }));
  };

  const removeActivity = (date: string) => {
    setCalendarData(prev => {
      const newData = { ...prev };
      delete newData[date];
      return newData;
    });
  };

  return (
    <View style={styles.container}>
      {/* Activity selector would go here */}
      <Calendar
        data={calendarData}
        onDayPress={(day, marker) => {
          if (marker) {
            removeActivity(day.dateString);
          } else {
            addActivity(day.dateString);
          }
        }}
        showNotes={true}
      />
    </View>
  );
}

// Example 5: Calendar with month change tracking
export function MonthTrackingCalendarExample() {
  const [currentMonth, setCurrentMonth] = useState('');
  const [data] = useState<CalendarData>(
    createCalendarData([
      { date: '2024-12-15', emoji: FITNESS_EMOJIS.running },
      { date: '2025-01-15', emoji: FITNESS_EMOJIS.gym },
    ])
  );

  return (
    <Calendar
      data={data}
      onMonthChange={(month) => {
        setCurrentMonth(month.dateString);
        console.log('Month changed to:', month.dateString);
      }}
      onDayPress={(day) => {
        console.log('Day pressed in month:', currentMonth);
      }}
    />
  );
}

// Example 6: Integration with external data (e.g., API, database)
export function DataIntegratedCalendarExample() {
  const [data, setData] = useState<CalendarData>({});
  const [loading, setLoading] = useState(false);

  // Example function to load data from API
  const loadCalendarData = async (month: string) => {
    setLoading(true);
    try {
      // Replace with your actual API call
      // const response = await fetch(`/api/calendar/${month}`);
      // const calendarData = await response.json();
      
      // Mock data for example
      const mockData = createCalendarData([
        { date: '2024-12-25', emoji: FITNESS_EMOJIS.rest, note: 'Christmas rest' },
        { date: '2024-12-26', emoji: FITNESS_EMOJIS.running, note: 'Boxing day run' },
      ]);
      
      setData(mockData);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Calendar
      data={data}
      onMonthChange={(month) => {
        loadCalendarData(month.dateString);
      }}
      onDayPress={(day, marker) => {
        if (marker) {
          // Could trigger detailed view or edit modal
          console.log('Edit activity for:', day.dateString);
        } else {
          // Could trigger add activity modal
          console.log('Add activity for:', day.dateString);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});