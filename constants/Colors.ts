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
    // Matches React Navigation DefaultTheme card color
    secondary: '#FF8C00',
    tabBackGround: '#FFFFFF',
    cardBackground: '#FFFFFF',
    inputBackground: '#EDEFF2',
    input: '#FFFFFF',
    separator: '#FFC099',
    mutedText: '#7C8289',
    highlight: '#FF4500',
    accentBlue: '#0D6EFD',
    success: '#22C55E',    // Tailwind green-500
    warning: '#FACC15',    // Tailwind yellow-400
    danger: '#EF4444',      // Tailwind red-500
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
    // Matches React Navigation DarkTheme card color
    secondary: '#FF8C00',
    tabBackGround: '#121212',
    cardBackground: '#1A1A1A',
    inputBackground: '#2C2C2E',
    input: '#1F2937', // gray-800 equivalent
    separator: '#6B2A10',
    mutedText: '#9BA1A6',
    highlight: '#FF4500',
    accentBlue: '#0D6EFD',
    success: '#22C55E',
    warning: '#FACC15',
    danger: '#EF4444',
  },
};
