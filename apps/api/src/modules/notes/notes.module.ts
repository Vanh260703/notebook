import { Module } from '@nestjs/common';
import { TagsModule } from '../tags/tags.module';
import { DaysController } from './days.controller';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { TrashPurgeService } from './trash-purge.service';

@Module({
  imports: [TagsModule],
  controllers: [NotesController, DaysController],
  providers: [NotesService, TrashPurgeService],
})
export class NotesModule {}
