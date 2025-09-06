import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineExercise {
  id: string;
  date: string;
  activity: string;
  sets: {
    setType: "warmup" | "normal" | "failure" | "drop";
    measure: "kg";
    value: string;
    reps: string;
  }[];
  timestamp: string;
}

const STORAGE_KEY = 'offlineExercises';

/**
 * Generate a unique ID for offline exercises
 */
export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Save an exercise to localStorage with a unique ID
 */
export const saveExerciseToStorage = async (exerciseData: Omit<OfflineExercise, 'id' | 'timestamp'>): Promise<string> => {
  try {
    const uniqueId = generateUniqueId();
    const exerciseWithId: OfflineExercise = {
      id: uniqueId,
      ...exerciseData,
      timestamp: new Date().toISOString(),
    };

    // Get existing exercises from storage
    const existingExercises = await AsyncStorage.getItem(STORAGE_KEY);
    const exercises: OfflineExercise[] = existingExercises ? JSON.parse(existingExercises) : [];

    // Add new exercise
    exercises.push(exerciseWithId);

    // Save back to storage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));

    console.log('Exercise saved to localStorage with ID:', uniqueId);
    return uniqueId;
  } catch (error) {
    console.error('Failed to save exercise to localStorage:', error);
    throw error;
  }
};

/**
 * Retrieve all offline exercises from localStorage
 */
export const getOfflineExercises = async (): Promise<OfflineExercise[]> => {
  try {
    const exercises = await AsyncStorage.getItem(STORAGE_KEY);
    return exercises ? JSON.parse(exercises) : [];
  } catch (error) {
    console.error('Failed to retrieve exercises from localStorage:', error);
    return [];
  }
};

/**
 * Get a specific exercise by ID
 */
export const getOfflineExerciseById = async (id: string): Promise<OfflineExercise | null> => {
  try {
    const exercises = await getOfflineExercises();
    return exercises.find(exercise => exercise.id === id) || null;
  } catch (error) {
    console.error('Failed to retrieve exercise by ID:', error);
    return null;
  }
};

/**
 * Delete an exercise by ID
 */
export const deleteOfflineExercise = async (id: string): Promise<boolean> => {
  try {
    const exercises = await getOfflineExercises();
    const filteredExercises = exercises.filter(exercise => exercise.id !== id);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredExercises));
    return true;
  } catch (error) {
    console.error('Failed to delete exercise:', error);
    return false;
  }
};

/**
 * Clear all offline exercises
 */
export const clearAllOfflineExercises = async (): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear all exercises:', error);
    return false;
  }
};

/**
 * Get exercises by date
 */
export const getOfflineExercisesByDate = async (date: string): Promise<OfflineExercise[]> => {
  try {
    const exercises = await getOfflineExercises();
    return exercises.filter(exercise => exercise.date === date);
  } catch (error) {
    console.error('Failed to retrieve exercises by date:', error);
    return [];
  }
};

/**
 * Check if there are any offline exercises stored
 */
export const hasOfflineExercises = async (): Promise<boolean> => {
  try {
    const exercises = await getOfflineExercises();
    return exercises.length > 0;
  } catch (error) {
    console.error('Failed to check for offline exercises:', error);
    return false;
  }
};

/**
 * Get the count of offline exercises
 */
export const getOfflineExercisesCount = async (): Promise<number> => {
  try {
    const exercises = await getOfflineExercises();
    return exercises.length;
  } catch (error) {
    console.error('Failed to get offline exercises count:', error);
    return 0;
  }
};

export const offlineData = async (): Promise<string> => {
  try {
    const exercises = await getOfflineExercises();
    return JSON.stringify(exercises);
  } catch (error) {
    console.error('Failed to retrieve offline logs for server:', error);
    throw error;
  }
};
