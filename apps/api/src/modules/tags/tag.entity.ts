import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TAG_NAME_MAX_LENGTH } from '@notebook/shared';
import { Note } from '../notes/note.entity';

@Entity('Tag')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Đã chuẩn hóa bằng tagNameSchema (trim, NFC, chữ thường). */
  @Column({ type: 'varchar', length: TAG_NAME_MAX_LENGTH, unique: true })
  name!: string;

  // onDelete: 'CASCADE' BẮT BUỘC ở phía này, nếu không FK "tagId" của NoteTag thành NO ACTION.
  @ManyToMany(() => Note, (note) => note.tags, { onDelete: 'CASCADE' })
  notes!: Note[];
}
