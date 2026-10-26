import { renameTagSchema } from '@notebook/shared';
import { createZodDto } from 'nestjs-zod';

export class RenameTagDto extends createZodDto(renameTagSchema) {}
