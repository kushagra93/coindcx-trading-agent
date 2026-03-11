import { createContext, useContext, useState, type ReactNode } from 'react';

interface Portfolio {
  totalValue: number;
  todayPnl: number;
  todayPnlPct: number;
  activeStrategies: number;
}

interface AppState {
  agentStatus: 'running' | 'stopped' | 'setting_up';
  portfolio: Portfolio;
  isOnboarded: boolean;
  setOnboarded: (v: boolean) => void;
  setAgentStatus: (s: 'running' | 'stopped' | 'setting_up') => void;
  toggleAgent: () => void;
}

const defaultPortfolio: Portfolio = {
  totalValue: 9500,
  todayPnl: 652.22,
  todayPnlPct: 6.87,
  activeStrategies: 3,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [agentStatus, setAgentStatus] = useState<AppState['agentStatus']>(
    () => (localStorage.getItem('onboarded') === 'true' ? 'running' : 'stopped')
  );
  const [isOnboarded, setIsOnboarded] = useState(
    () => localStorage.getItem('onboarded') === 'true'
  );

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
        portfolio: defaultPortfolio,
        isOnboarded,
        setOnboarded,
        setAgentStatus,
        toggleAgent,
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
