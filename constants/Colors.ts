/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#FF4500';
const tintColorDark = '#FF4500';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F2F2F7',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    calendarMarker: '#FF4500',

    // Additions
    cardBackground: '#FFFFFF',
    inputBackground: '#EDEFF2',
    separator: '#D0D5DD',
    mutedText: '#7C8289',
    highlight: '#FF4500',
    success: '#22C55E',    // Tailwind green-500
    warning: '#FACC15',    // Tailwind yellow-400
    error: '#EF4444',      // Tailwind red-500
  },
  dark: {
    text: '#ECEDEE',
    background: '#000000',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    calendarMarker: '#FF4500',

    // Additions
    cardBackground: '#1A1A1A',
    inputBackground: '#2C2C2E',
    separator: '#3A3A3C',
    mutedText: '#9BA1A6',
    highlight: '#FF4500',
    success: '#22C55E',
    warning: '#FACC15',
    error: '#EF4444',
  },
};
