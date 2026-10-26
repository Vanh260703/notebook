import { Injectable } from '@nestjs/common';

/**
 * Giới hạn đăng nhập TOÀN CỤC (không theo IP, xem PROJECT.md mục 10.5/11):
 * tối đa 5 lần sai trong cửa sổ trượt 15 phút. Lưu in-memory (một process duy nhất).
 */
@Injectable()
export class LoginRateLimiter {
  static readonly MAX = 5;
  static readonly WINDOW_MS = 15 * 60_000;
  /** Thời điểm các lần sai (ms), tăng dần. */
  private failures: number[] = [];

  private prune(now: number): void {
    this.failures = this.failures.filter((t) => now - t < LoginRateLimiter.WINDOW_MS);
  }

  /** 0 nếu được thử; > 0 là số giây phải chờ. */
  retryAfterSeconds(now = Date.now()): number {
    this.prune(now);
    if (this.failures.length < LoginRateLimiter.MAX) return 0;
    return Math.max(1, Math.ceil((this.failures[0] + LoginRateLimiter.WINDOW_MS - now) / 1000));
  }

  recordFailure(now = Date.now()): void {
    this.prune(now);
    this.failures.push(now);
  }

  reset(): void {
    this.failures = [];
  }
}
