'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WEEKDAY_SHORT, addDays, parseYmd, weekDays, weekday } from '@/lib/calendar';
import { formatLongDay } from '@/lib/date';
import { cn } from '@/lib/utils';
import { dayCountLabel, useDayCounts } from './use-day-counts';

/** Dải 7 ngày (mobile), ‹ › đổi tuần mà không đổi ngày đang xem. */
export function WeekStrip({
  selected,
  today,
  onSelect,
}: {
  selected: string;
  today: string;
  onSelect: (ymd: string) => void;
}) {
  const [anchor, setAnchor] = useState(selected);
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setAnchor(selected);
  }
  const days = weekDays(anchor);
  const counts = useDayCounts(days[0]!, days[6]!);

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Chọn ngày trong tuần">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setAnchor((a) => addDays(a, -7))}
        aria-label="Tuần trước"
        className="shrink-0"
      >
        <ChevronLeft />
      </Button>
      <ul className="grid flex-1 grid-cols-7 gap-0.5">
        {days.map((ymd) => {
          const count = counts?.get(ymd);
          const isSelected = ymd === selected;
          const isToday = ymd === today;
          return (
            <li key={ymd}>
              <button
                type="button"
                onClick={() => onSelect(ymd)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={dayCountLabel(formatLongDay(ymd), count)}
                className={cn(
                  'flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-muted-foreground transition-colors hover:bg-muted',
                  isToday && 'text-primary-ink',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary-hover',
                )}
              >
                <span className="text-[0.6875rem] font-medium">{WEEKDAY_SHORT[weekday(ymd)]}</span>
                <span
                  className={cn(
                    'text-base leading-5 font-semibold tabular-nums',
                    !isSelected && !isToday && 'text-foreground',
                  )}
                >
                  {parseYmd(ymd).d}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'size-1.5 rounded-full',
                    count ? (isSelected ? 'bg-primary-foreground' : 'bg-primary-ink') : '',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setAnchor((a) => addDays(a, 7))}
        aria-label="Tuần sau"
        className="shrink-0"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
