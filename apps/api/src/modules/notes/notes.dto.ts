import { createNoteSchema, listNotesQuerySchema, updateNoteSchema } from '@notebook/shared';
import { createZodDto } from 'nestjs-zod';

// Giá trị controller nhận được là OUTPUT của schema: đã có default, đã chuẩn hóa, đã bỏ trùng tag.
export class CreateNoteDto extends createZodDto(createNoteSchema) {}
export class UpdateNoteDto extends createZodDto(updateNoteSchema) {}
export class ListNotesQueryDto extends createZodDto(listNotesQuerySchema) {}
