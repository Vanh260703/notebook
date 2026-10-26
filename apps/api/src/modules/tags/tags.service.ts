import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { TagListResponse, TagWithCount } from '@notebook/shared';
import { DataSource, type EntityManager } from 'typeorm';
import { Tag } from './tag.entity';
import type { RenameTagDto } from './tags.dto';

const tagNotFound = () =>
  new NotFoundException({ statusCode: 404, code: 'TAG_NOT_FOUND', message: 'Không tìm thấy tag' });

/** Chỉ đếm note chưa xóa. Gồm cả tag có 0 note (để thấy mà xóa). */
const TAG_WITH_COUNT_SQL = `
  SELECT t."id", t."name", count(n."id")::int AS "noteCount"
  FROM "Tag" t
  LEFT JOIN "NoteTag" nt ON nt."tagId" = t."id"
  LEFT JOIN "Note" n ON n."id" = nt."noteId" AND n."deletedAt" IS NULL`;

@Injectable()
export class TagsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(): Promise<TagListResponse> {
    const items = await this.dataSource.query<TagWithCount[]>(
      `${TAG_WITH_COUNT_SQL} GROUP BY t."id" ORDER BY t."name"`,
    );
    return { items };
  }

  /**
   * Đổi tên. Trùng tag khác: 409 TAG_NAME_TAKEN (+ existing), hoặc gộp nếu merge = true.
   * Không tăng version của các note liên quan. Race unique (23505) thì filter trả 409.
   */
  async rename(id: string, dto: RenameTagDto): Promise<TagWithCount> {
    return this.dataSource.transaction(async (em) => {
      const src = await em.findOne(Tag, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!src) throw tagNotFound();
      if (src.name === dto.name) return this.withCount(em, src.id);

      const existing = await em.findOne(Tag, { where: { name: dto.name } });
      if (!existing) {
        await em.update(Tag, { id }, { name: dto.name });
        return this.withCount(em, id);
      }
      if (!dto.merge) {
        throw new ConflictException({
          statusCode: 409,
          code: 'TAG_NAME_TAKEN',
          message: `Đã có tag "${existing.name}"`,
          existing: { id: existing.id, name: existing.name },
        });
      }
      await em.query(
        `INSERT INTO "NoteTag"("noteId", "tagId")
         SELECT "noteId", $1 FROM "NoteTag" WHERE "tagId" = $2
         ON CONFLICT DO NOTHING`,
        [existing.id, src.id],
      );
      await em.delete(Tag, { id: src.id }); // NoteTag của tag nguồn tự xóa theo (CASCADE)
      return this.withCount(em, existing.id);
    });
  }

  async remove(id: string): Promise<void> {
    const res = await this.dataSource.getRepository(Tag).delete({ id });
    if (!res.affected) throw tagNotFound();
  }

  /**
   * Thay toàn bộ tag của một note. Tự tạo tag còn thiếu.
   * Luôn chạy trong EntityManager của transaction bên Notes.
   */
  async replaceNoteTags(em: EntityManager, noteId: string, names: string[]): Promise<void> {
    await em.query(`DELETE FROM "NoteTag" WHERE "noteId" = $1`, [noteId]);
    if (!names.length) return;
    // Sắp xếp để hai transaction cùng tạo tag luôn khóa theo một thứ tự (tránh deadlock).
    const sorted = [...names].sort();
    await em.query(
      `INSERT INTO "Tag"("name") SELECT unnest($1::varchar[]) ON CONFLICT ("name") DO NOTHING`,
      [sorted],
    );
    await em.query(
      `INSERT INTO "NoteTag"("noteId", "tagId")
       SELECT $1, "id" FROM "Tag" WHERE "name" = ANY($2::varchar[])`,
      [noteId, sorted],
    );
  }

  private async withCount(em: EntityManager, id: string): Promise<TagWithCount> {
    const rows = await em.query<TagWithCount[]>(
      `${TAG_WITH_COUNT_SQL} WHERE t."id" = $1 GROUP BY t."id"`,
      [id],
    );
    if (!rows[0]) throw tagNotFound();
    return rows[0];
  }
}
