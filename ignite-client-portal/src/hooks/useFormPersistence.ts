import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './useDebounce';

interface FormPersistenceOptions<T> {
  key: string;
  initialData: T;
  debounceMs?: number;
  excludeFields?: (keyof T)[];
}

interface FormPersistenceResult<T> {
  data: T;
  setData: (data: T | ((prev: T) => T)) => void;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  clearPersistedData: () => void;
  hasPersistedData: boolean;
  restoreData: () => void;
  lastSavedAt: Date | null;
  isDirty: boolean;
}

export function useFormPersistence<T extends Record<string, unknown>>({
  key,
  initialData,
  debounceMs = 1000,
  excludeFields = [],
}: FormPersistenceOptions<T>): FormPersistenceResult<T> {
  const storageKey = `form_draft_${key}`;
  const [data, setDataInternal] = useState<T>(initialData);
  const [hasPersistedData, setHasPersistedData] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const initialDataRef = useRef(initialData);

  // Debounced data for saving
  const debouncedData = useDebounce(data, debounceMs);

  // Check for persisted data on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data && parsed.timestamp) {
          // Only consider data fresh if it's less than 24 hours old
          const age = Date.now() - parsed.timestamp;
          if (age < 24 * 60 * 60 * 1000) {
            setHasPersistedData(true);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  // Save data when it changes (debounced)
  useEffect(() => {
    if (!isDirty) return;

    try {
      // Filter out excluded fields and sensitive data
      const dataToSave = { ...debouncedData };
      excludeFields.forEach((field) => {
        delete dataToSave[field];
      });

      // Don't save passwords or tokens
      const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key'];
      Object.keys(dataToSave).forEach((key) => {
        if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
          delete dataToSave[key as keyof T];
        }
      });

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          data: dataToSave,
          timestamp: Date.now(),
        })
      );
      setLastSavedAt(new Date());
    } catch {
      // Storage might be full or disabled
    }
  }, [debouncedData, storageKey, isDirty, excludeFields]);

  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    setDataInternal((prev) => {
      const updated = typeof newData === 'function' ? newData(prev) : newData;
      setIsDirty(true);
      return updated;
    });
  }, []);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, [setData]);

  const clearPersistedData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasPersistedData(false);
      setIsDirty(false);
      setLastSavedAt(null);
    } catch {
      // Ignore errors
    }
  }, [storageKey]);

  const restoreData = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data) {
          // Merge with initial data to ensure all fields exist
          setDataInternal({ ...initialDataRef.current, ...parsed.data });
          setHasPersistedData(false);
          setIsDirty(true);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  return {
    data,
    setData,
    updateField,
    clearPersistedData,
    hasPersistedData,
    restoreData,
    lastSavedAt,
    isDirty,
  };
}
