import { vi } from 'vitest';

export function createMockQueryBuilder(returnValue: any = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnValue),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  const thenResolved = (val: any) => {
    chain.then.mockImplementation((resolve: any) => Promise.resolve(resolve(val)));
    chain.limit.mockReturnValue(val);
    chain.where.mockReturnValue(val);
    chain.from.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.offset.mockReturnValue(chain);
    chain.groupBy.mockReturnValue(chain);
    return chain;
  };

  return { chain, thenResolved };
}

export function createMockDb() {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  };

  function mockChain(finalValue: any[]) {
    mockDb.select.mockReturnValue(mockDb);
    mockDb.insert.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.delete.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.limit.mockResolvedValue(finalValue);
    mockDb.offset.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.returning.mockResolvedValue(finalValue);
    mockDb.onConflictDoNothing.mockResolvedValue(undefined);
    mockDb.onConflictDoUpdate.mockReturnValue(mockDb);
    mockDb.groupBy.mockReturnValue(mockDb);

    (mockDb as any)[Symbol.asyncIterator] = async function* () {
      for (const item of finalValue) yield item;
    };
    (mockDb as any).then = (resolve: any) => Promise.resolve(resolve(finalValue));
  }

  return { mockDb, mockChain };
}

export function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    rpush: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue('OK'),
    lrange: vi.fn().mockResolvedValue([]),
    sismember: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    hmset: vi.fn().mockResolvedValue('OK'),
    hgetall: vi.fn().mockResolvedValue({}),
    hset: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
    ttl: vi.fn().mockResolvedValue(60),
    pipeline: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      sadd: vi.fn().mockReturnThis(),
      hset: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  } as any;
}
