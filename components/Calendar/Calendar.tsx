import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Calendar as RNCalendar, CalendarProps, DateData } from 'react-native-calendars';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export interface DayMarker {
  emoji?: string;
  color?: string;
  textColor?: string;
  note?: string;
}

export interface CalendarData {
  [date: string]: DayMarker;
}

export interface CustomCalendarProps extends Partial<CalendarProps> {
  data?: CalendarData;
  onDayPress?: (day: DateData, marker?: DayMarker) => void;
  onMonthChange?: (month: DateData) => void;
  showNotes?: boolean;
  customStyle?: {
    container?: object;
    calendar?: object;
    header?: object;
  };
}

export function Calendar({
  data = {},
  onDayPress,
  onMonthChange,
  showNotes = false,
  customStyle = {},
  ...calendarProps
}: CustomCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');

  // Create marked dates object for react-native-calendars
  const markedDates = React.useMemo(() => {
    const marked: any = {};
    
    // Add data markers
    Object.keys(data).forEach(date => {
      const marker = data[date];
      marked[date] = {
        marked: true,
        dotColor: marker.color || tintColor,
        customStyles: {
          container: {
            backgroundColor: marker.color ? `${marker.color}20` : undefined,
            borderRadius: 8,
          },
          text: {
            color: marker.textColor || textColor,
            fontWeight: '500',
          },
        },
      };
    });

    // Add selected date
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: tintColor,
        selectedTextColor: backgroundColor === '#000000' ? '#000000' : '#FFFFFF',
      };
    }

    return marked;
  }, [data, selectedDate, tintColor, textColor, backgroundColor]);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    const marker = data[day.dateString];
    onDayPress?.(day, marker);
  };

  const selectedMarker = selectedDate ? data[selectedDate] : null;

  const calendarTheme = {
    backgroundColor: backgroundColor,
    calendarBackground: backgroundColor,
    textSectionTitleColor: textColor,
    textSectionTitleDisabledColor: iconColor,
    selectedDayBackgroundColor: tintColor,
    selectedDayTextColor: backgroundColor === '#000000' ? '#000000' : '#FFFFFF',
    todayTextColor: tintColor,
    todayButtonFontWeight: '600',
    dayTextColor: textColor,
    textDisabledColor: iconColor,
    dotColor: tintColor,
    selectedDotColor: backgroundColor === '#000000' ? '#000000' : '#FFFFFF',
    arrowColor: tintColor,
    disabledArrowColor: iconColor,
    monthTextColor: textColor,
    indicatorColor: tintColor,
    textDayFontFamily: 'System',
    textMonthFontFamily: 'System',
    textDayHeaderFontFamily: 'System',
    textDayFontWeight: '400',
    textMonthFontWeight: '600',
    textDayHeaderFontWeight: '500',
    textDayFontSize: 16,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 14,
  };

  return (
    <ThemedView style={[styles.container, customStyle.container]}>
      <View style={[styles.calendarContainer, customStyle.calendar]}>
        <RNCalendar
          {...calendarProps}
          onDayPress={handleDayPress}
          onMonthChange={onMonthChange}
          markedDates={markedDates}
          markingType="custom"
          theme={calendarTheme}
          style={styles.calendar}
          renderHeader={(date) => (
            <View style={[styles.header, customStyle.header]}>
              <ThemedText type="subtitle">
                {date.toString('MMMM yyyy')}
              </ThemedText>
            </View>
          )}
          dayComponent={({ date, state, marking }) => {
            const dateString = date?.dateString || '';
            const marker = data[dateString];
            const isSelected = selectedDate === dateString;
            const isToday = date?.dateString === new Date().toISOString().split('T')[0];
            
            return (
              <TouchableOpacity
                onPress={() => date && handleDayPress(date)}
                style={[
                  styles.dayContainer,
                  isSelected && { backgroundColor: tintColor },
                  marker?.color && !isSelected && { backgroundColor: `${marker.color}20` },
                  isToday && !isSelected && { borderColor: tintColor, borderWidth: 1 },
                ]}
              >
                <View style={styles.dayContent}>
                  {marker?.emoji && (
                    <Text style={styles.emoji}>{marker.emoji}</Text>
                  )}
                  <Text
                    style={[
                      styles.dayText,
                      { color: isSelected ? (backgroundColor === '#000000' ? '#000000' : '#FFFFFF') : textColor },
                      state === 'disabled' && { color: iconColor },
                      isToday && !isSelected && { color: tintColor, fontWeight: '600' },
                    ]}
                  >
                    {date?.day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Selected date info */}
      {selectedDate && (
        <View style={styles.selectedInfo}>
          <ThemedText type="defaultSemiBold" style={styles.selectedDate}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </ThemedText>
          
          {selectedMarker && (
            <View style={styles.markerInfo}>
              {selectedMarker.emoji && (
                <Text style={styles.selectedEmoji}>{selectedMarker.emoji}</Text>
              )}
              {selectedMarker.note && showNotes && (
                <ThemedText style={styles.note}>{selectedMarker.note}</ThemedText>
              )}
            </View>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  calendar: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  dayContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
  },
  dayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emoji: {
    fontSize: 12,
    marginBottom: 2,
  },
  selectedInfo: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedDate: {
    marginBottom: 8,
  },
  markerInfo: {
    alignItems: 'center',
  },
  selectedEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  note: {
    textAlign: 'center',
    opacity: 0.7,
  },
});