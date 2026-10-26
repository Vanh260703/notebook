import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  NOTE_DEFAULT_STATUS,
  NOTE_DEFAULT_TYPE,
  NOTE_STATUSES,
  NOTE_TYPES,
  type NoteStatus,
  type NoteType,
} from '@notebook/shared';
import { Tag } from '../tags/tag.entity';

const sqlIn = (vals: readonly string[]) => vals.map((v) => `'${v}'`).join(', ');

// KHÔNG sửa chuỗi này nếu không định sinh migration mới
// (TypeORM so sánh từng ký tự với DB, chỉ trim hai đầu).
export const NOTE_SEARCH_EXPRESSION =
  `setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') || ` +
  `setweight(to_tsvector('simple', f_unaccent(coalesce("content", ''))), 'B')`;

@Entity('Note')
@Check(`"type" IN (${sqlIn(NOTE_TYPES)})`)
@Check(`"status" IN (${sqlIn(NOTE_STATUSES)})`)
@Index('Note_entryDate_idx', ['entryDate'], { where: '"deletedAt" IS NULL' })
@Index('Note_status_idx', ['status'], { where: '"deletedAt" IS NULL' })
// TypeORM 1.x hỗ trợ kiểu index của Postgres nên GIN do migration:generate sinh ra và được theo dõi diff.
@Index('Note_search_idx', ['search'], { type: 'gin' })
export class Note {
  /** UUID do client tạo (outbox gửi lại không tạo note trùng). */
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'text', default: '' })
  title!: string;

  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'varchar', length: 16, default: NOTE_DEFAULT_TYPE })
  type!: NoteType;

  // Mặc định INBOX (migration NoteStatusDefaultInbox). API luôn gửi status, default ở DB chỉ là lớp an toàn thứ hai.
  @Column({ type: 'varchar', length: 16, default: NOTE_DEFAULT_STATUS })
  status!: NoteStatus;

  /** Ngày theo giờ địa phương 'YYYY-MM-DD', do frontend gửi. */
  @Column({ type: 'date' })
  entryDate!: string;

  @Column({ type: 'boolean', default: false })
  pinned!: boolean;

  /** Tăng tay bằng UPDATE có điều kiện. KHÔNG dùng @VersionColumn. */
  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;

  @Column({
    type: 'tsvector',
    generatedType: 'STORED',
    asExpression: NOTE_SEARCH_EXPRESSION,
    select: false,
    insert: false,
    update: false,
  })
  search?: string;

  @ManyToMany(() => Tag, (tag) => tag.notes, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'NoteTag',
    joinColumn: { name: 'noteId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags!: Tag[];
}
