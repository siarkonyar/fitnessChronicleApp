import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { DateData } from 'react-native-calendars';

import { Calendar, CalendarData, DayMarker } from '@/components/Calendar';
import {
  ACTIVITY_COLORS,
  createCalendarData,
  FITNESS_EMOJIS,
  getTodayString,
  updateCalendarDate
} from '@/components/Calendar/calendarUtils';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function CalendarScreen() {
  // Sample calendar data - you can replace this with your own data source
  const [calendarData, setCalendarData] = useState<CalendarData>(
    createCalendarData([
      {
        date: getTodayString(),
        emoji: FITNESS_EMOJIS.gym,
        color: ACTIVITY_COLORS.workout,
        note: 'Upper body workout',
      },
      {
        date: '2024-12-25',
        emoji: FITNESS_EMOJIS.rest,
        color: ACTIVITY_COLORS.rest,
        note: 'Rest day - Christmas!',
      },
      {
        date: '2024-12-26',
        emoji: FITNESS_EMOJIS.running,
        color: ACTIVITY_COLORS.cardio,
        note: 'Morning run - 5km',
      },
      {
        date: '2024-12-27',
        emoji: FITNESS_EMOJIS.yoga,
        color: ACTIVITY_COLORS.flexibility,
        note: 'Evening yoga session',
      },
    ])
  );

  const [selectedEmoji, setSelectedEmoji] = useState<string>(FITNESS_EMOJIS.workout);

  const handleDayPress = (day: DateData, marker?: DayMarker) => {
    if (marker) {
      // Show existing marker info
      Alert.alert(
        `${day.dateString}`,
        marker.note || 'No notes',
        [
          { text: 'Remove', onPress: () => removeMarker(day.dateString), style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      // Add new marker
      addMarker(day.dateString);
    }
  };

  const addMarker = (date: string) => {
    const newData = updateCalendarDate(calendarData, date, {
      emoji: selectedEmoji,
      color: ACTIVITY_COLORS.workout,
      note: 'Tap to add notes',
    });
    setCalendarData(newData);
  };

  const removeMarker = (date: string) => {
    const newData = { ...calendarData };
    delete newData[date];
    setCalendarData(newData);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Fitness Calendar</ThemedText>
          <ThemedText style={styles.subtitle}>Track your fitness journey</ThemedText>
        </View>

        {/* Emoji Selector */}
        <View style={styles.emojiSelector}>
          <ThemedText type="defaultSemiBold" style={styles.selectorTitle}>
            Quick Add:
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiList}>
            {Object.entries(FITNESS_EMOJIS).map(([key, emoji]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.emojiButton,
                  selectedEmoji === emoji && styles.selectedEmojiButton,
                ]}
                onPress={() => setSelectedEmoji(emoji)}
              >
                <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Calendar Component */}
        <Calendar
          data={calendarData}
          onDayPress={handleDayPress}
          showNotes={true}
          customStyle={{
            container: styles.calendarContainer,
          }}
        />

        {/* Instructions */}
        <View style={styles.instructions}>
          <ThemedText type="defaultSemiBold" style={styles.instructionsTitle}>
            How to use:
          </ThemedText>
          <ThemedText style={styles.instructionText}>
            • Select an emoji above and tap any date to add it
          </ThemedText>
          <ThemedText style={styles.instructionText}>
            • Tap on a marked date to view details or remove
          </ThemedText>
          <ThemedText style={styles.instructionText}>
            • Customize colors and notes in the code
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  emojiSelector: {
    marginBottom: 24,
  },
  selectorTitle: {
    marginBottom: 12,
    fontSize: 16,
  },
  emojiList: {
    flexDirection: 'row',
  },
  emojiButton: {
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedEmojiButton: {
    backgroundColor: 'rgba(10, 126, 164, 0.2)',
    borderWidth: 2,
    borderColor: '#0a7ea4',
  },
  emojiText: {
    fontSize: 20,
  },
  calendarContainer: {
    marginBottom: 24,
  },
  instructions: {
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  instructionsTitle: {
    marginBottom: 8,
    fontSize: 16,
  },
  instructionText: {
    marginBottom: 4,
    opacity: 0.7,
    fontSize: 14,
  },
}); 