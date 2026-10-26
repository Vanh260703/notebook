/**
 * WCAG 2.4.1: sidebar có khoảng 15 link đứng trước nội dung. Link đầu tiên của trang, chỉ hiện khi
 * được focus bằng bàn phím. Anchor hash nên dùng <a> thường (không phải GuardedLink/next/link).
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-elev-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60]"
    >
      Bỏ qua tới nội dung
    </a>
  );
}
