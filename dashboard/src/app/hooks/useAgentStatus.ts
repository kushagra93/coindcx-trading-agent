import { useState, useEffect } from 'react';

type AgentStatus = 'running' | 'stopped' | 'error';

export function useAgentStatus(pollInterval = 10000) {
  const [status, setStatus] = useState<AgentStatus>('running');

  useEffect(() => {
    const poll = () => {
      // In production, this would call the API
      // For now, read from localStorage to sync with AppContext
      const stored = localStorage.getItem('agentStatus');
      if (stored === 'running' || stored === 'stopped' || stored === 'error') {
        setStatus(stored);
      }
    };

    poll();
    const id = setInterval(poll, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]);

  return status;
}
