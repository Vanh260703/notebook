import { Module } from '@nestjs/common';
import { TagsModule } from '../tags/tags.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [TagsModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
