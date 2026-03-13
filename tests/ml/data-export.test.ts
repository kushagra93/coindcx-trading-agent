import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((args: any) => args),
}));

vi.mock('../../src/core/config.js', () => ({
  config: {
    sagemaker: {
      region: 'us-west-2',
      s3Bucket: 'test-bucket',
      s3Prefix: 'cerebro-test',
    },
    logLevel: 'info',
    nodeEnv: 'test',
  },
}));

vi.mock('../../src/core/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('../../src/data/intent-engine.js', () => ({
  TRADING_TOOLS: [
    { type: 'function', function: { name: 'execute_trade', description: 'trade', parameters: {} } },
  ],
}));

let mockOrderByResult: any[] = [];
let mockWhereResult: any[] = [];
let mockSelectAllResult: any[] = [];

vi.mock('../../src/db/index.js', () => ({
  isDbConfigured: vi.fn().mockReturnValue(true),
  getDb: vi.fn(() => ({
    select: () => ({
      from: (table: any) => ({
        orderBy: (...args: any[]) => Promise.resolve(mockOrderByResult),
        where: (...args: any[]) => Promise.resolve(mockWhereResult),
        then: (resolve: any) => Promise.resolve(resolve(mockSelectAllResult)),
      }),
    }),
  })),
}));

vi.mock('../../src/db/schema.js', () => ({
  chatMessages: { userId: 'userId', createdAt: 'createdAt' },
  trades: {},
  positions: { status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn((...args: any[]) => args),
  sql: vi.fn((strings: any, ...values: any[]) => ({ strings, values })),
}));

describe('data-export: exportIntentTrainingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockOrderByResult = [];
  });

  it('exports user→assistant message pairs as training examples', async () => {
    mockOrderByResult = [
      { role: 'user', content: 'buy SOL', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'I bought some SOL for you', userId: 'u1', createdAt: new Date() },
      { role: 'user', content: 'show portfolio', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'Here are your holdings', userId: 'u1', createdAt: new Date() },
    ];

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportIntentTrainingData();

    expect(result.intentExamples).toBe(2);
    expect(result.tradeOutcomes).toBe(0);
    expect(result.s3Uri).toMatch(/^s3:\/\/test-bucket\/cerebro-test\/intent-training\//);
    expect(result.exportedAt).toBeTruthy();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('skips non-paired messages', async () => {
    mockOrderByResult = [
      { role: 'user', content: 'hello', userId: 'u1', createdAt: new Date() },
      { role: 'user', content: 'buy SOL', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'Bought SOL', userId: 'u1', createdAt: new Date() },
    ];

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportIntentTrainingData();

    expect(result.intentExamples).toBe(1);
  });

  it('skips pairs from different users', async () => {
    mockOrderByResult = [
      { role: 'user', content: 'buy SOL', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'Done', userId: 'u2', createdAt: new Date() },
    ];

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportIntentTrainingData();

    expect(result.intentExamples).toBe(0);
  });

  it('adds tool_calls when assistant response matches action pattern', async () => {
    mockOrderByResult = [
      { role: 'user', content: 'screen this token', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'Running a safety audit for this token...', userId: 'u1', createdAt: new Date() },
    ];

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportIntentTrainingData();

    expect(result.intentExamples).toBe(1);

    const uploadedBody = mockSend.mock.calls[0][0].Body;
    const parsed = JSON.parse(uploadedBody);
    expect(parsed.messages[2].tool_calls).toBeDefined();
    expect(parsed.messages[2].tool_calls[0].function.name).toBe('screen_token');
  });

  it('uses plain assistant content when no action pattern matches', async () => {
    mockOrderByResult = [
      { role: 'user', content: 'what is your name?', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'I am Cerebro, your trading assistant.', userId: 'u1', createdAt: new Date() },
    ];

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportIntentTrainingData();

    expect(result.intentExamples).toBe(1);
    const uploadedBody = mockSend.mock.calls[0][0].Body;
    const parsed = JSON.parse(uploadedBody);
    expect(parsed.messages[2].content).toBe('I am Cerebro, your trading assistant.');
    expect(parsed.messages[2].tool_calls).toBeUndefined();
  });

  it('throws if DB is not configured', async () => {
    const { isDbConfigured } = await import('../../src/db/index.js');
    (isDbConfigured as any).mockReturnValueOnce(false);

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    await expect(exportIntentTrainingData()).rejects.toThrow('Database not configured');
  });

  it('handles empty chat messages', async () => {
    mockOrderByResult = [];

    const { exportIntentTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportIntentTrainingData();

    expect(result.intentExamples).toBe(0);
  });
});

describe('data-export: exportTradeOutcomeData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockWhereResult = [];
    mockSelectAllResult = [];
  });

  it('exports closed positions with win/loss labels', async () => {
    mockWhereResult = [
      {
        tokenSymbol: 'SOL', chain: 'solana', entryPrice: 100, currentPrice: 150,
        amount: 10, costBasis: 1000, unrealizedPnl: 500, unrealizedPnlPct: 50,
        highWaterMark: 160, openedAt: new Date('2026-03-01'), closedAt: new Date('2026-03-13'),
        status: 'closed',
      },
      {
        tokenSymbol: 'ETH', chain: 'ethereum', entryPrice: 3000, currentPrice: 2500,
        amount: 1, costBasis: 3000, unrealizedPnl: -500, unrealizedPnlPct: -16.67,
        highWaterMark: 3100, openedAt: new Date('2026-03-05'), closedAt: new Date('2026-03-13'),
        status: 'closed',
      },
    ];
    mockSelectAllResult = [];

    const { exportTradeOutcomeData } = await import('../../src/ml/data-export.js');
    const result = await exportTradeOutcomeData();

    expect(result.tradeOutcomes).toBe(2);
    expect(result.intentExamples).toBe(0);
    expect(result.s3Uri).toMatch(/trade-outcomes/);

    const uploadedBody = mockSend.mock.calls[0][0].Body;
    const lines = uploadedBody.split('\n');
    expect(lines).toHaveLength(2);

    const win = JSON.parse(lines[0]);
    expect(win.label).toBe(1);
    expect(win.token).toBe('SOL');
    expect(win.holdDurationMs).toBeGreaterThan(0);

    const loss = JSON.parse(lines[1]);
    expect(loss.label).toBe(0);
    expect(loss.token).toBe('ETH');
  });

  it('handles positions with no closedAt/openedAt', async () => {
    mockWhereResult = [
      {
        tokenSymbol: 'BONK', chain: 'solana', entryPrice: 0.01, currentPrice: 0.02,
        amount: 1000000, costBasis: 10000, unrealizedPnl: 10000, unrealizedPnlPct: 100,
        highWaterMark: 0.025, openedAt: null, closedAt: null, status: 'closed',
      },
    ];
    mockSelectAllResult = [];

    const { exportTradeOutcomeData } = await import('../../src/ml/data-export.js');
    const result = await exportTradeOutcomeData();

    const uploadedBody = mockSend.mock.calls[0][0].Body;
    const outcome = JSON.parse(uploadedBody);
    expect(outcome.holdDurationMs).toBeNull();
  });

  it('throws if DB is not configured', async () => {
    const { isDbConfigured } = await import('../../src/db/index.js');
    (isDbConfigured as any).mockReturnValueOnce(false);

    const { exportTradeOutcomeData } = await import('../../src/ml/data-export.js');
    await expect(exportTradeOutcomeData()).rejects.toThrow('Database not configured');
  });
});

describe('data-export: exportAllTrainingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockOrderByResult = [
      { role: 'user', content: 'buy SOL', userId: 'u1', createdAt: new Date() },
      { role: 'assistant', content: 'Done buying SOL', userId: 'u1', createdAt: new Date() },
    ];
    mockWhereResult = [];
    mockSelectAllResult = [];
  });

  it('runs both intent and trade exports in parallel', async () => {
    const { exportAllTrainingData } = await import('../../src/ml/data-export.js');
    const result = await exportAllTrainingData();

    expect(result.intent).toBeDefined();
    expect(result.trades).toBeDefined();
    expect(result.intent.intentExamples).toBeGreaterThanOrEqual(0);
    expect(result.trades.tradeOutcomes).toBeGreaterThanOrEqual(0);
  });
});

describe('data-export: extractToolCallFromResponse (pattern matching)', () => {
  const actionPatterns: Record<string, RegExp> = {
    execute_trade: /\b(buy|sell|bought|sold)\b.*\b(SOL|ETH|BTC|BONK|PEPE|WIF)\b/i,
    screen_token: /\b(screen|safety|rug\s*check|audit)\b/i,
    get_price: /\bcurrent\s+price\b/i,
    get_portfolio: /\b(portfolio|holdings|positions|balance)\b/i,
    get_trending: /\b(trending|hot|popular)\b/i,
    setup_dca: /\bDCA\b/i,
    set_limit_order: /\b(limit|stop.?loss|take.?profit)\b/i,
    copy_trade: /\bcopy\s*trad/i,
    get_leaderboard: /\b(leaderboard|top\s*trader)/i,
  };

  function extractToolCall(content: string) {
    for (const [action, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(content)) {
        return { type: 'function', function: { name: action, arguments: '{}' } };
      }
    }
    return null;
  }

  it('matches buy/sell patterns to execute_trade', () => {
    expect(extractToolCall('I bought some SOL today')).toMatchObject({
      function: { name: 'execute_trade' },
    });
    expect(extractToolCall('You can sell ETH via...')).toMatchObject({
      function: { name: 'execute_trade' },
    });
  });

  it('matches screen patterns to screen_token', () => {
    expect(extractToolCall('Let me screen this token')).toMatchObject({
      function: { name: 'screen_token' },
    });
    expect(extractToolCall('Running a rug check...')).toMatchObject({
      function: { name: 'screen_token' },
    });
  });

  it('matches current price pattern', () => {
    expect(extractToolCall('The current price of BTC is $60,000')).toMatchObject({
      function: { name: 'get_price' },
    });
  });

  it('matches portfolio patterns', () => {
    expect(extractToolCall('Here is your portfolio')).toMatchObject({
      function: { name: 'get_portfolio' },
    });
    expect(extractToolCall('Your current holdings are...')).toMatchObject({
      function: { name: 'get_portfolio' },
    });
  });

  it('matches trending patterns', () => {
    expect(extractToolCall('Here are the trending tokens')).toMatchObject({
      function: { name: 'get_trending' },
    });
  });

  it('matches DCA pattern', () => {
    expect(extractToolCall('Setting up your DCA plan')).toMatchObject({
      function: { name: 'setup_dca' },
    });
  });

  it('matches limit/stop-loss/take-profit', () => {
    expect(extractToolCall('Setting a stop-loss at 5%')).toMatchObject({
      function: { name: 'set_limit_order' },
    });
    expect(extractToolCall('Your take-profit is set')).toMatchObject({
      function: { name: 'set_limit_order' },
    });
  });

  it('matches copy trade patterns', () => {
    expect(extractToolCall('Starting copy trading for this wallet')).toMatchObject({
      function: { name: 'copy_trade' },
    });
  });

  it('matches leaderboard patterns', () => {
    expect(extractToolCall('Here is the leaderboard')).toMatchObject({
      function: { name: 'get_leaderboard' },
    });
  });

  it('returns null for unrecognized content', () => {
    expect(extractToolCall('Hello, how are you?')).toBeNull();
    expect(extractToolCall('')).toBeNull();
  });
});
