import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { TRASH_RETENTION_DAYS } from '@notebook/shared';
import { DataSource } from 'typeorm';
import { Note } from './note.entity';

const DAY_MS = 86_400_000;

/**
 * Dọn thùng rác: xóa vĩnh viễn note đã nằm trong thùng rác quá TRASH_RETENTION_DAYS ngày.
 *
 * Không dùng @nestjs/schedule (bản 12.x chỉ có ESM, API build CommonJS; xem docs/phase2-design.md 6.1).
 * Chạy lần đầu 60 s sau khi khởi động (server ở nhà có lúc tắt, nên không hẹn đúng một giờ cố định)
 * rồi mỗi giờ. Tag không còn note nào KHÔNG tự xóa (tránh race với replaceNoteTags).
 */
@Injectable()
export class TrashPurgeService implements OnApplicationBootstrap, OnApplicationShutdown {
  static readonly FIRST_RUN_DELAY_MS = 60_000;
  static readonly INTERVAL_MS = 60 * 60_000;

  private readonly log = new Logger('TrashPurge');
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onApplicationBootstrap(): void {
    // Jest tự đặt NODE_ENV=test: e2e không có timer chạy ngầm (test gọi purgeExpired trực tiếp).
    if (process.env.NODE_ENV === 'test') return;
    this.schedule(TrashPurgeService.FIRST_RUN_DELAY_MS);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** setTimeout nối tiếp (không setInterval): lần sau chỉ được hẹn khi lần trước đã xong, không chạy chồng. */
  schedule(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.runOnce().then(() => this.schedule(TrashPurgeService.INTERVAL_MS));
    }, ms);
    // Không giữ process sống chỉ vì timer này.
    this.timer.unref();
  }

  /** Không bao giờ throw: lỗi (DB mất kết nối...) chỉ ghi log, giờ sau chạy lại. */
  async runOnce(): Promise<void> {
    try {
      const n = await this.purgeExpired();
      if (n > 0) {
        this.log.log(`Đã xóa vĩnh viễn ${n} note quá ${TRASH_RETENTION_DAYS} ngày trong thùng rác`);
      }
    } catch (e) {
      this.log.error(
        'Dọn thùng rác thất bại, thử lại sau 1 giờ',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Idempotent: chỉ xóa note quá hạn. NoteTag tự xóa theo (ON DELETE CASCADE). Trả số note đã xóa. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
    const res = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(Note)
      .where('"deletedAt" IS NOT NULL AND "deletedAt" < :cutoff', { cutoff })
      .execute();
    return res.affected ?? 0;
  }
}
