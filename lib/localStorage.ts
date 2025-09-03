import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_EXERCISE_LOGS_KEY = 'offline_exercise_logs';

// TODO: check if there are any other cleaner option then hashing
const SYNCED_HASHES_KEY = 'offline_exercise_logs_synced_hashes';
const HASH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type SyncedHashEntry = { hash: string; ts: number };

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

function computeContentHash(input: object): string {
  const str = stableStringify(input);
  // Simple, fast non-crypto hash (djb2 variant)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and base36 for compactness
  return (hash >>> 0).toString(36);
}

async function getSyncedHashes(): Promise<SyncedHashEntry[]> {
  const json = await AsyncStorage.getItem(SYNCED_HASHES_KEY);
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as SyncedHashEntry[];
    const now = Date.now();
    const filtered = arr.filter((e) => now - e.ts < HASH_TTL_MS);
    if (filtered.length !== arr.length) {
      await AsyncStorage.setItem(SYNCED_HASHES_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

async function addSyncedHashes(hashes: string[]): Promise<void> {
  if (hashes.length === 0) return;
  const existing = await getSyncedHashes();
  const now = Date.now();
  const existingSet = new Set(existing.map((e) => e.hash));
  const merged = [
    ...existing,
    ...hashes
      .filter((h) => !existingSet.has(h))
      .map((h) => ({ hash: h, ts: now })),
  ];
  await AsyncStorage.setItem(SYNCED_HASHES_KEY, JSON.stringify(merged));
}

export interface OfflineExerciseLog {
  id: string;
  date: string;
  activity: string;
  sets: {
    setType: "warmup" | "normal" | "failure" | "drop";
    measure: "kg" | "lbs" | "sec" | "distance" | "step";
    value: string;
    reps: string;
  }[];
}

// Save exercise log to local storage
export const saveOfflineExerciseLog = async (exerciseLog: Omit<OfflineExerciseLog, 'id'>): Promise<void> => {
  try {
    const existingLogs = await getOfflineExerciseLogs();
    const syncedHashes = await getSyncedHashes();
    const syncedSet = new Set(syncedHashes.map((e) => e.hash));

    // Compute a content hash to deduplicate identical entries
    const contentHash = computeContentHash({
      date: exerciseLog.date,
      activity: exerciseLog.activity,
      // Normalize sets order to avoid order-based duplicates
      sets: [...exerciseLog.sets].map((s) => ({
        setType: s.setType,
        measure: s.measure,
        value: s.value,
        reps: s.reps,
      })),
    });

    // Check against local unsynced and recently-synced hashes
    const localDuplicate = existingLogs.some((l) =>
      computeContentHash({ date: l.date, activity: l.activity, sets: l.sets }) === contentHash
    );
    if (localDuplicate || syncedSet.has(contentHash)) {
      console.log('Skipping save - duplicate offline log detected');
      return;
    }

    const newLog: OfflineExerciseLog = {
      ...exerciseLog,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const updatedLogs = [...existingLogs, newLog];
    await AsyncStorage.setItem(OFFLINE_EXERCISE_LOGS_KEY, JSON.stringify(updatedLogs));

    console.log('Exercise log saved to local storage:', newLog);
  } catch (error) {
    console.error('Failed to save exercise log to local storage:', error);
    throw error;
  }
};

// Get all offline exercise logs
export const getOfflineExerciseLogs = async (): Promise<OfflineExerciseLog[]> => {
  try {
    const logsJson = await AsyncStorage.getItem(OFFLINE_EXERCISE_LOGS_KEY);
    if (!logsJson) return [];

    const logs = JSON.parse(logsJson);
    return logs;
  } catch (error) {
    console.error('Failed to get offline exercise logs:', error);
    return [];
  }
};

// Get offline exercise logs by date
export const getOfflineExerciseLogsByDate = async (date: string): Promise<OfflineExerciseLog[]> => {
  try {
    const allLogs = await getOfflineExerciseLogs();
    return allLogs.filter(log => log.date === date);
  } catch (error) {
    console.error('Failed to get offline exercise logs by date:', error);
    return [];
  }
};



// Sync all offline logs to server and clear them
export const syncOfflineLogs = async (
  addExerciseLogMutation: (data: {
    date: string;
    activity: string;
    sets: {
      setType: "warmup" | "normal" | "failure" | "drop";
      measure: "kg" | "lbs" | "sec" | "distance" | "step";
      value: string;
      reps: string;
    }[];
  }) => Promise<any>
): Promise<{ syncedCount: number; errorCount: number }> => {
  try {
    const offlineLogs = await getOfflineExerciseLogs();
    if (offlineLogs.length === 0) {
      console.log('No offline logs to sync');
      return { syncedCount: 0, errorCount: 0 };
    }

    console.log(`Syncing ${offlineLogs.length} offline logs...`);

    let syncedCount = 0;
    let errorCount = 0;
    const failedLogs: OfflineExerciseLog[] = [];

    // Deduplicate by content hash before attempting to sync
    const syncedHashes = await getSyncedHashes();
    const recentlySyncedSet = new Set(syncedHashes.map((e) => e.hash));
    const seenHashes = new Set<string>();
    const logsToSync = offlineLogs.filter((log) => {
      const h = computeContentHash({ date: log.date, activity: log.activity, sets: log.sets });
      if (recentlySyncedSet.has(h) || seenHashes.has(h)) {
        return false;
      }
      seenHashes.add(h);
      return true;
    });
    if (logsToSync.length !== offlineLogs.length) {
      console.log(`Deduplicated ${offlineLogs.length - logsToSync.length} duplicate offline logs before sync`);
    }

    // Process logs in batches to avoid overwhelming the server
    const batchSize = 3;
    const hashesJustSynced: string[] = [];
    for (let i = 0; i < logsToSync.length; i += batchSize) {
      const batch = logsToSync.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (log) => {
          try {
            const serverPayload = {
              date: log.date,
              activity: log.activity,
              sets: log.sets.map(set => ({
                setType: set.setType,
                measure: set.measure,
                value: set.value,
                reps: set.reps,
              })),
            };

            await addExerciseLogMutation(serverPayload);
            syncedCount++;
            console.log(`Synced: ${log.activity}`);
            const h = computeContentHash({ date: log.date, activity: log.activity, sets: log.sets });
            hashesJustSynced.push(h);
          } catch (error) {
            console.error(`Failed to sync ${log.activity}:`, error);
            errorCount++;
            failedLogs.push(log);
          }
        })
      );

      // Small delay between batches to reduce server load
      if (i + batchSize < logsToSync.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Only clear successfully synced logs, keep failed ones for retry
    if (failedLogs.length === 0) {
      await clearOfflineExerciseLogs();
      console.log(`All ${syncedCount} logs synced successfully`);
    } else {
      // Save failed logs back to storage for retry
      await AsyncStorage.setItem(OFFLINE_EXERCISE_LOGS_KEY, JSON.stringify(failedLogs));
      console.log(`Sync complete: ${syncedCount} synced, ${errorCount} failed (saved for retry)`);
    }

    // Persist hashes of successfully synced logs to avoid re-syncing within TTL
    await addSyncedHashes(hashesJustSynced);

    return { syncedCount, errorCount };
  } catch (error) {
    console.error('Sync failed:', error);
    return { syncedCount: 0, errorCount: 1 };
  }
};

// Clear all offline exercise logs (used after successful sync)
export const clearOfflineExerciseLogs = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(OFFLINE_EXERCISE_LOGS_KEY);
    console.log('All offline exercise logs cleared');
  } catch (error) {
    console.error('Failed to clear offline exercise logs:', error);
    throw error;
  }
};

// Delete a specific offline exercise log
export const deleteOfflineExerciseLog = async (id: string): Promise<void> => {
  try {
    const allLogs = await getOfflineExerciseLogs();
    const updatedLogs = allLogs.filter(log => log.id !== id);

    await AsyncStorage.setItem(OFFLINE_EXERCISE_LOGS_KEY, JSON.stringify(updatedLogs));
    console.log('Offline exercise log deleted:', id);
  } catch (error) {
    console.error('Failed to delete offline exercise log:', error);
    throw error;
  }
};
