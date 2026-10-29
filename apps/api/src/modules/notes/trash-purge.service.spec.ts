import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { TrashPurgeService } from './trash-purge.service';

const FIRST = TrashPurgeService.FIRST_RUN_DELAY_MS;
const HOUR = TrashPurgeService.INTERVAL_MS;

describe('TrashPurgeService', () => {
  let svc: TrashPurgeService;
  let purge: jest.SpyInstance<Promise<number>, [Date?]>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.useFakeTimers();
    svc = new TrashPurgeService({} as DataSource);
    purge = jest.spyOn(svc, 'purgeExpired').mockResolvedValue(0);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    svc.onApplicationShutdown();
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  it('runs 60 s after schedule(), then every hour', async () => {
    svc.schedule(FIRST);
    await jest.advanceTimersByTimeAsync(FIRST - 1);
    expect(purge).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(purge).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(HOUR);
    expect(purge).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(HOUR * 3);
    expect(purge).toHaveBeenCalledTimes(5);
  });

  it('logs an error when purge fails and still schedules the next run', async () => {
    purge.mockRejectedValueOnce(new Error('db down'));
    svc.schedule(FIRST);
    await jest.advanceTimersByTimeAsync(FIRST);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('thất bại');
    await jest.advanceTimersByTimeAsync(HOUR);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('logs only when something was deleted', async () => {
    await svc.runOnce();
    expect(logSpy).not.toHaveBeenCalled();
    purge.mockResolvedValueOnce(3);
    await svc.runOnce();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0]?.[0])).toContain('3 note');
  });

  it('never overlaps: the next run is scheduled only after the previous one finished', async () => {
    let finish!: (n: number) => void;
    purge.mockImplementationOnce(() => new Promise<number>((r) => (finish = r)));
    svc.schedule(FIRST);
    await jest.advanceTimersByTimeAsync(FIRST);
    expect(purge).toHaveBeenCalledTimes(1);
    // Lần đầu chạy rất lâu: qua 3 giờ vẫn không có lần thứ hai.
    await jest.advanceTimersByTimeAsync(HOUR * 3);
    expect(purge).toHaveBeenCalledTimes(1);
    finish(0);
    await jest.advanceTimersByTimeAsync(HOUR);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('onApplicationShutdown cancels the pending timer', async () => {
    svc.schedule(FIRST);
    svc.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(HOUR * 2);
    expect(purge).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('onApplicationBootstrap schedules nothing under NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    svc.onApplicationBootstrap();
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(HOUR * 2);
    expect(purge).not.toHaveBeenCalled();
  });

  it('onApplicationBootstrap schedules the first run otherwise', async () => {
    process.env.NODE_ENV = 'production';
    svc.onApplicationBootstrap();
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(FIRST);
    expect(purge).toHaveBeenCalledTimes(1);
  });
});
