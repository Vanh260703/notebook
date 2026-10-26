import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Phân trang: Trước / Trang x/y / Sau, căn trái. */
export function Pagination({
  page,
  pages,
  hasMore,
  onPage,
}: {
  page: number;
  pages: number;
  hasMore: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Phân trang" className="flex items-center gap-3">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden />
        Trước
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        Trang {page}/{pages}
      </span>
      <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Sau
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
