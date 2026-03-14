const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

let authToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem('auth_token', token);
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('auth_token');
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Portfolio
  getPortfolio: () => request<any>('/api/v1/portfolio'),
  getPositions: () => request<any>('/api/v1/positions'),
  getPosition: (id: string) => request<any>(`/api/v1/positions/${id}`),
  getTrades: (page = 1, limit = 20) => request<any>(`/api/v1/trades?page=${page}&limit=${limit}`),

  // Leaderboard
  getLeaderboard: () => request<any>('/api/v1/leaderboard'),
  getTrader: (id: string) => request<any>(`/api/v1/leaderboard/${id}`),
  copyTrader: (leaderId: string, budgetUsd: number) =>
    request<any>(`/api/v1/copy/${leaderId}`, {
      method: 'POST',
      body: JSON.stringify({ budgetUsd }),
    }),
  stopCopy: (leaderId: string) =>
    request<any>(`/api/v1/copy/${leaderId}`, { method: 'DELETE' }),

  // Strategies
  getTemplates: () => request<any>('/api/v1/templates'),
  getStrategies: () => request<any>('/api/v1/strategies'),
  createStrategy: (data: any) =>
    request<any>('/api/v1/strategies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStrategy: (id: string, data: any) =>
    request<any>(`/api/v1/strategies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteStrategy: (id: string) =>
    request<any>(`/api/v1/strategies/${id}`, { method: 'DELETE' }),

  // Risk
  getRisk: () => request<any>('/api/v1/risk'),
  updateRisk: (data: any) =>
    request<any>('/api/v1/risk', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Wallet
  getWalletAddress: (chain: string) => request<any>(`/api/v1/wallet/address/${chain}`),
  withdraw: (data: { chain: string; token: string; amount: string }) =>
    request<any>('/api/v1/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Agent
  startAgent: () => request<any>('/api/v1/agent/start', { method: 'POST' }),
  stopAgent: () => request<any>('/api/v1/agent/stop', { method: 'POST' }),
  emergencyStop: () => request<any>('/api/v1/agent/emergency-stop', { method: 'POST' }),
  getAgentStatus: () => request<any>('/api/v1/agent/status'),

  // AI
  chat: (message: string, conversationId?: string) =>
    request<any>('/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId }),
    }),

  // Notifications
  getNotifications: () => request<any>('/api/v1/notifications'),
  updateNotificationSettings: (data: any) =>
    request<any>('/api/v1/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Health
  getHealth: () => request<any>('/health'),

  // Supervisor
  supervisor: {
    // Agents
    createAgent: (data: { userId: string; strategy: string; chain: string; config?: Record<string, unknown> }) =>
      request<any>('/api/v1/supervisor/agents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listAgents: (filters?: { userId?: string; state?: string; chain?: string }) => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.state) params.set('state', filters.state);
      if (filters?.chain) params.set('chain', filters.chain);
      const qs = params.toString();
      return request<any>(`/api/v1/supervisor/agents${qs ? `?${qs}` : ''}`);
    },
    getAgent: (agentId: string) => request<any>(`/api/v1/supervisor/agents/${agentId}`),
    startAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/start`, { method: 'POST' }),
    stopAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/stop`, { method: 'POST' }),
    pauseAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/pause`, { method: 'POST' }),
    resumeAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/resume`, { method: 'POST' }),
    destroyAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}`, { method: 'DELETE' }),
    forceClosePositions: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/force-close`, { method: 'POST' }),
    overrideRisk: (agentId: string, overrides: Record<string, unknown>) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/risk`, {
        method: 'PUT',
        body: JSON.stringify({ overrides }),
      }),
    pushStrategy: (agentId: string, strategy: Record<string, unknown>) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/strategy`, {
        method: 'POST',
        body: JSON.stringify(strategy),
      }),

    // Global operations
    emergencyHalt: () =>
      request<any>('/api/v1/supervisor/emergency-halt', { method: 'POST' }),
    resumeAll: () =>
      request<any>('/api/v1/supervisor/resume-all', { method: 'POST' }),

    // Policies
    getPolicies: () => request<any>('/api/v1/supervisor/policies'),
    updatePolicies: (updates: Record<string, unknown>) =>
      request<any>('/api/v1/supervisor/policies', {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    // Monitoring
    getStats: () => request<any>('/api/v1/supervisor/stats'),
    getEvents: (limit = 50, offset = 0) =>
      request<any>(`/api/v1/supervisor/events?limit=${limit}&offset=${offset}`),

    // Trade Approvals (Multi-Tier)
    requestApproval: (data: {
      agentId: string; brokerId: string; asset: string;
      side: 'buy' | 'sell'; amountUsd: number; chain: string;
      riskScore: number; compliancePassed: boolean;
    }) =>
      request<any>('/api/v1/supervisor/approvals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Fee Ledger (Multi-Tier)
    getFeeSummary: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      return request<any>(`/api/v1/supervisor/fees${qs ? `?${qs}` : ''}`);
    },
    recordFee: (data: {
      tradeId: string; userId: string; agentId: string;
      brokerId: string; feeAmountUsd: number; feeType: string; chain: string;
    }) =>
      request<any>('/api/v1/supervisor/fees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Hibernation (Multi-Tier)
    hibernateAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/hibernate`, { method: 'POST' }),
    wakeAgent: (agentId: string) =>
      request<any>(`/api/v1/supervisor/agents/${agentId}/wake`, { method: 'POST' }),

    // Risk Snapshot (Multi-Tier)
    getRiskSnapshot: () => request<any>('/api/v1/supervisor/risk-snapshot'),

    // Regulatory Reports (Multi-Tier)
    getRegulatoryReport: (from: string, to: string) =>
      request<any>(`/api/v1/supervisor/regulatory/report?from=${from}&to=${to}`),
  },

  // Brokers (Multi-Tier)
  brokers: {
    list: () => request<any>('/api/v1/brokers'),
    register: (jurisdiction: string) =>
      request<any>('/api/v1/brokers', {
        method: 'POST',
        body: JSON.stringify({ jurisdiction }),
      }),
    get: (brokerId: string) => request<any>(`/api/v1/brokers/${brokerId}`),
    getAgents: (brokerId: string) => request<any>(`/api/v1/brokers/${brokerId}/agents`),
    getCompliance: (brokerId: string) => request<any>(`/api/v1/brokers/${brokerId}/compliance`),
    getFees: (brokerId: string, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      return request<any>(`/api/v1/brokers/${brokerId}/fees${qs ? `?${qs}` : ''}`);
    },
  },

  // Gateway (Multi-Tier)
  gateway: {
    deposit: (data: {
      user_id: string; amount: string; currency: string;
      tx_id: string; kyc_verified: boolean; region: string;
    }) =>
      request<any>('/api/v1/gateway/deposit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    withdraw: (data: {
      userId: string; amount: string; token: string;
      chain: string; toAddress: string;
      userAgentSignature: string; brokerSignature: string;
    }) =>
      request<any>('/api/v1/gateway/withdraw', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getTransactions: (filters?: { type?: string; status?: string; userId?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return request<any>(`/api/v1/gateway/transactions${qs ? `?${qs}` : ''}`);
    },
  },
};
