import { Controller, Get, Query } from '@nestjs/common';
import type { DayCountsResponse } from '@notebook/shared';
import { DayCountsQueryDto } from './notes.dto';
import { NotesService } from './notes.service';

/** Lịch (trang Hôm nay) và heatmap sau này: số note theo ngày. */
@Controller('days')
export class DaysController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query() query: DayCountsQueryDto): Promise<DayCountsResponse> {
    return this.notes.countByDay(query.from, query.to);
  }
}
