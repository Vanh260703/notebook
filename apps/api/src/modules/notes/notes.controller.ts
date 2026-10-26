import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Note as NoteDto, NoteListResponse } from '@notebook/shared';
import type { Response } from 'express';
import { CreateNoteDto, ListNotesQueryDto, UpdateNoteDto } from './notes.dto';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query() query: ListNotesQueryDto): Promise<NoteListResponse> {
    return this.notes.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<NoteDto> {
    return this.notes.get(id);
  }

  /** 201 khi vừa tạo, 200 khi id đã tồn tại (idempotent cho outbox). */
  @Post()
  async create(
    @Body() dto: CreateNoteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<NoteDto> {
    const { created, note } = await this.notes.create(dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return note;
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto): Promise<NoteDto> {
    return this.notes.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notes.softDelete(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<NoteDto> {
    return this.notes.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePermanently(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notes.removePermanently(id);
  }
}
