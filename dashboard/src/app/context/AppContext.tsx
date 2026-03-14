import { createContext, useContext, useState, type ReactNode } from 'react';

interface AppState {
  agentStatus: 'running' | 'stopped' | 'setting_up';
  isOnboarded: boolean;
  commandBarFocused: boolean;
  setOnboarded: (v: boolean) => void;
  setAgentStatus: (s: 'running' | 'stopped' | 'setting_up') => void;
  toggleAgent: () => void;
  setCommandBarFocused: (v: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [agentStatus, setAgentStatus] = useState<AppState['agentStatus']>(
    () => (localStorage.getItem('onboarded') === 'true' ? 'running' : 'stopped')
  );
  const [isOnboarded, setIsOnboarded] = useState(
    () => localStorage.getItem('onboarded') === 'true'
  );
  const [commandBarFocused, setCommandBarFocused] = useState(false);

  const setOnboarded = (v: boolean) => {
    setIsOnboarded(v);
    localStorage.setItem('onboarded', String(v));
    if (v) setAgentStatus('running');
  };

  const toggleAgent = () => {
    setAgentStatus(s => (s === 'running' ? 'stopped' : 'running'));
  };

  return (
    <AppContext.Provider
      value={{
        agentStatus,
        isOnboarded,
        commandBarFocused,
        setOnboarded,
        setAgentStatus,
        toggleAgent,
        setCommandBarFocused,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
