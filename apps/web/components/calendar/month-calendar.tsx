'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  WEEK_HEADER,
  addMonths,
  monthGrid,
  monthLabel,
  monthOf,
  parseYmd,
  sameMonth,
} from '@/lib/calendar';
import { formatLongDay } from '@/lib/date';
import { cn } from '@/lib/utils';
import { dayCountLabel, useDayCounts } from './use-day-counts';

/**
 * Lịch tháng 6×7, tuần bắt đầu Thứ Hai. Ngày có note có chấm (số note trong nhãn đọc màn hình và
 * `title`). Ngày đang xem: aria-pressed; hôm nay: aria-current="date". Dữ liệu: GET /days cho 42 ô.
 */
export function MonthCalendar({
  selected,
  today,
  onSelect,
  className,
}: {
  selected: string;
  today: string;
  onSelect: (ymd: string) => void;
  className?: string;
}) {
  const [month, setMonth] = useState(() => monthOf(selected));
  const [prevSelected, setPrevSelected] = useState(selected);
  // Đổi ngày từ bên ngoài (dải tuần, nút ‹ ›) sang tháng khác: lịch theo tháng đó.
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (!sameMonth(selected, month)) setMonth(monthOf(selected));
  }

  const grid = monthGrid(month);
  const counts = useDayCounts(grid[0]!, grid[41]!);
  const weeks = Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7));
  const label = monthLabel(month);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1">
        <h2 className="mr-auto pl-1 text-sm font-semibold" aria-live="polite">
          {label}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          aria-label="Tháng trước"
          title="Tháng trước"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Tháng sau"
          title="Tháng sau"
        >
          <ChevronRight />
        </Button>
      </div>
      <table className="w-full table-fixed border-collapse text-center">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {WEEK_HEADER.map((h) => (
              <th
                key={h.short}
                scope="col"
                abbr={h.long}
                className="pb-1 text-xs font-medium text-muted-foreground"
              >
                {h.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((ymd) => {
                const count = counts?.get(ymd);
                const isSelected = ymd === selected;
                const isToday = ymd === today;
                const outside = !sameMonth(ymd, month);
                return (
                  <td key={ymd} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelect(ymd)}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={dayCountLabel(formatLongDay(ymd), count)}
                      title={count ? `${count} note` : undefined}
                      className={cn(
                        'relative mx-auto flex size-9 flex-col items-center justify-center rounded-lg text-sm tabular-nums transition-colors hover:bg-muted pointer-coarse:size-11',
                        // Ngày ngoài tháng: chữ muted (vẫn đủ 4.5:1, không làm mờ thêm).
                        outside ? 'text-muted-foreground' : 'text-foreground',
                        isToday && 'font-bold text-primary-ink',
                        isSelected &&
                          'bg-primary font-semibold text-primary-foreground hover:bg-primary-hover',
                      )}
                    >
                      {parseYmd(ymd).d}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute bottom-1 size-1.5 rounded-full',
                          count ? 'bg-primary-ink' : 'bg-transparent',
                          isSelected && count && 'bg-primary-foreground',
                        )}
                      />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
