import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  NOTE_EXCERPT_LENGTH,
  type Note as NoteDto,
  type NoteListResponse,
  type Tag as TagDto,
} from '@notebook/shared';
import { DataSource, type EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TagsService } from '../tags/tags.service';
import { Note } from './note.entity';
import { type NoteListRow, toListItem, toNoteDto } from './note.mapper';
import type { CreateNoteDto, ListNotesQueryDto, UpdateNoteDto } from './notes.dto';

const noteNotFound = () =>
  new NotFoundException({
    statusCode: 404,
    code: 'NOTE_NOT_FOUND',
    message: 'Không tìm thấy note',
  });
const noteInTrash = () =>
  new NotFoundException({
    statusCode: 404,
    code: 'NOTE_IN_TRASH',
    message: 'Note đang trong thùng rác',
  });

@Injectable()
export class NotesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tags: TagsService,
  ) {}

  async list(query: ListNotesQueryDto): Promise<NoteListResponse> {
    if (query.q !== undefined) {
      throw new NotImplementedException({
        statusCode: 501,
        code: 'NOT_IMPLEMENTED',
        message: 'Tìm kiếm sẽ có ở Giai đoạn 2',
      });
    }
    const { type, status, tag, date, trashed, page, limit } = query;

    const qb = this.dataSource.getRepository(Note).createQueryBuilder('note');
    if (trashed) qb.withDeleted().andWhere('note.deletedAt IS NOT NULL');
    if (type) qb.andWhere('note.type = :type', { type });
    if (status) qb.andWhere('note.status = :status', { status });
    if (date) qb.andWhere('note.entryDate = :date', { date });
    if (tag) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "NoteTag" nt JOIN "Tag" t ON t."id" = nt."tagId"
                 WHERE nt."noteId" = "note"."id" AND t."name" = :tag)`,
        { tag },
      );
    }

    // Thứ tự do server chọn theo chế độ; thêm id để phân trang offset ổn định.
    if (trashed) {
      qb.orderBy('note.deletedAt', 'DESC');
    } else if (date) {
      qb.orderBy('note.createdAt', 'ASC');
    } else {
      qb.orderBy('note.pinned', 'DESC').addOrderBy('note.updatedAt', 'DESC');
    }
    qb.addOrderBy('note.id', 'DESC');

    const total = await qb.getCount();
    // Không join nên offset/limit an toàn (không dính bẫy skip/take của TypeORM).
    const rows = await qb
      .select('note.id', 'id')
      .addSelect('note.title', 'title')
      .addSelect('note.type', 'type')
      .addSelect('note.status', 'status')
      .addSelect('note.entryDate', 'entryDate')
      .addSelect('note.pinned', 'pinned')
      .addSelect('note.version', 'version')
      .addSelect('note.createdAt', 'createdAt')
      .addSelect('note.updatedAt', 'updatedAt')
      .addSelect('note.deletedAt', 'deletedAt')
      .addSelect(`left("note"."content", ${NOTE_EXCERPT_LENGTH})`, 'excerpt')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<NoteListRow>();

    const tagsByNote = await this.tagsForNotes(rows.map((r) => r.id));
    return {
      items: rows.map((r) => toListItem(r, tagsByNote.get(r.id) ?? [])),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  /** Trả cả note trong thùng rác (deletedAt khác null; UI chỉ cho đọc). */
  async get(id: string): Promise<NoteDto> {
    const note = await this.findWithTags(this.dataSource.manager, id);
    if (!note) throw noteNotFound();
    return toNoteDto(note);
  }

  /**
   * Idempotent theo id (outbox gửi lại an toàn). id đã tồn tại thì trả bản trong DB,
   * không so sánh payload, không ghi đè, không khôi phục nếu đã xóa mềm.
   */
  async create(dto: CreateNoteDto): Promise<{ created: boolean; note: NoteDto }> {
    return this.dataSource.transaction(async (em) => {
      const { tags, ...fields } = dto;
      const res = await em
        .createQueryBuilder()
        .insert()
        .into(Note)
        .values({ ...fields, version: 1 })
        .orIgnore() // ON CONFLICT DO NOTHING
        .returning(['id'])
        .updateEntity(false)
        .execute();
      const created = (res.raw as unknown[]).length > 0;
      if (created && tags.length) await this.tags.replaceNoteTags(em, fields.id, tags);
      const note = await this.findWithTags(em, fields.id);
      if (!note) throw noteNotFound(); // chỉ xảy ra nếu bị xóa vĩnh viễn ngay giữa chừng
      return { created, note: toNoteDto(note) };
    });
  }

  /**
   * Cập nhật có điều kiện theo version (không bao giờ dùng save()).
   * Hai request cùng version: UPDATE khóa dòng, request sau được Postgres tính lại
   * điều kiện trên dòng mới (READ COMMITTED) nên không khớp và thành 409.
   */
  async update(id: string, dto: UpdateNoteDto): Promise<NoteDto> {
    return this.dataSource.transaction(async (em) => {
      const { version, tags, ...rest } = dto;
      const fields = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      ) as QueryDeepPartialEntity<Note>;
      const res = await em
        .createQueryBuilder()
        .update(Note)
        .set({ ...fields, version: () => '"version" + 1' }) // updatedAt do TypeORM tự set
        .where('"id" = :id AND "version" = :version AND "deletedAt" IS NULL', { id, version })
        .execute();
      if (!res.affected) {
        const cur = await this.findWithTags(em, id);
        if (!cur) throw noteNotFound();
        if (cur.deletedAt) throw noteInTrash();
        throw new ConflictException({
          statusCode: 409,
          code: 'VERSION_CONFLICT',
          message: 'Note đã được sửa ở nơi khác',
          current: toNoteDto(cur),
        });
      }
      if (tags) await this.tags.replaceNoteTags(em, id, tags);
      const note = await this.findWithTags(em, id);
      if (!note) throw noteNotFound();
      return toNoteDto(note);
    });
  }

  /** Xóa mềm, idempotent. Không tăng version; không đóng dấu lại deletedAt nếu đã xóa. */
  async softDelete(id: string): Promise<void> {
    const res = await this.dataSource
      .createQueryBuilder()
      .softDelete()
      .from(Note)
      .where('"id" = :id AND "deletedAt" IS NULL', { id })
      .execute();
    if (!res.affected && !(await this.exists(id))) throw noteNotFound();
  }

  /** Khôi phục, idempotent. Không tăng version. */
  async restore(id: string): Promise<NoteDto> {
    await this.dataSource
      .createQueryBuilder()
      .restore()
      .from(Note)
      .where('"id" = :id AND "deletedAt" IS NOT NULL', { id })
      .execute();
    return this.get(id);
  }

  /** Chỉ xóa vĩnh viễn note đang trong thùng rác (409 nếu chưa xóa mềm). */
  async removePermanently(id: string): Promise<void> {
    const res = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(Note)
      .where('"id" = :id AND "deletedAt" IS NOT NULL', { id })
      .execute();
    if (res.affected) return;
    if (!(await this.exists(id))) throw noteNotFound();
    throw new ConflictException({
      statusCode: 409,
      code: 'NOTE_NOT_IN_TRASH',
      message: 'Chỉ xóa vĩnh viễn được note đang trong thùng rác',
    });
  }

  private findWithTags(em: EntityManager, id: string): Promise<Note | null> {
    return em.findOne(Note, { where: { id }, withDeleted: true, relations: { tags: true } });
  }

  private exists(id: string): Promise<boolean> {
    return this.dataSource.getRepository(Note).exists({ where: { id }, withDeleted: true });
  }

  private async tagsForNotes(ids: string[]): Promise<Map<string, TagDto[]>> {
    const map = new Map<string, TagDto[]>();
    if (!ids.length) return map;
    const rows = await this.dataSource.query<{ noteId: string; id: string; name: string }[]>(
      `SELECT nt."noteId", t."id", t."name"
       FROM "NoteTag" nt JOIN "Tag" t ON t."id" = nt."tagId"
       WHERE nt."noteId" = ANY($1::uuid[])`,
      [ids],
    );
    for (const { noteId, id, name } of rows) {
      const list = map.get(noteId);
      if (list) list.push({ id, name });
      else map.set(noteId, [{ id, name }]);
    }
    return map;
  }
}
