import { useState, useCallback } from 'react';

const STORAGE_KEY = 'coindcx_onboarded';

export function useOnboarding() {
  const [isOnboarded, setIsOnboarded] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const setOnboarded = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value));
    setIsOnboarded(value);
  }, []);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsOnboarded(false);
  }, []);

  return { isOnboarded, setOnboarded, resetOnboarding };
}
