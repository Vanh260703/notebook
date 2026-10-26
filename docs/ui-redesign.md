# Thiết kế lại giao diện Notebook, Giai đoạn 1

Phạm vi: chỉ `apps/web`. **Không đổi backend, không thêm dependency.** Bản này dựa trên 8 ảnh chụp hiện trạng (list desktop sáng/tối, list mobile, editor mobile, guard, thùng rác, dialog xung đột), PROJECT.md, BAO-CAO-GIAI-DOAN-1.md, toàn bộ code trong `apps/web`, `packages/shared/src`, `notes.service.ts`, `tags.service.ts`, và `font-data.json` của Next 16.4.3.

---

## 0. Nhận định

UI hiện tại chạy đúng và đã có nhiều sửa lỗi a11y tốt. Vấn đề nằm ở phần nhìn:

- **Không có tín hiệu thị giác.** Mọi màu là xám `oklch(x 0 0)`. Nút chính màu trắng (dark) hoặc đen (light), nên trông không khác gì một ô xám.
- **Mọi dòng trong list nặng như nhau.** Mỗi note đều có tiêu đề cùng cỡ chữ, rồi `26/10/2026 · Học tập · [Inbox]`. Loại và status chỉ là chữ xám nên không quét mắt được. Note đã ghim chỉ khác bằng một icon 14px.
- **Bộ lọc là 3 `<select>`.** Người dùng phải nhớ có những lựa chọn nào (recall), không thấy được ngay (recognition). Trên mobile 3 select này chiếm hai hàng.
- **Overlay dialog chỉ `bg-black/10`.** Ở dark mode, dialog guard gần như lẫn vào nền (ảnh `d-dark-guard.png`).
- **Font Inter.** Chạy được với tiếng Việt, nhưng là lựa chọn mặc định nên không có cá tính.

Hướng sửa: workspace có sidebar kiểu Linear. Nền và mặt (surface) xám lạnh ngả nhẹ về indigo, indigo dùng cho mọi thứ "đang chọn/hành động chính". Mỗi status và mỗi loại có một màu riêng (luôn đi kèm chữ hoặc icon, không dùng màu làm tín hiệu duy nhất). Card có viền, bóng và vạch màu theo loại. **Dark là theme chính** (`defaultTheme="dark"` trong `providers.tsx`), nên tinh chỉnh dark trước.

---

## 1. Design tokens

### 1.1 Font (đã kiểm tra subset trong `font-data.json`)

| Vai trò | Font | Subset có thật | Ghi chú |
|---|---|---|---|
| UI + tiêu đề | **Be Vietnam Pro** | `latin`, `latin-ext`, `vietnamese` | Font thiết kế riêng cho dấu tiếng Việt chồng tầng (Ể, Ộ, Ữ), dấu không bị dính hay cắt. **Không có bản variable**, phải liệt kê weight |
| Editor, code, kbd | **JetBrains Mono** | `latin`, `latin-ext`, `vietnamese`, `cyrillic`, `greek` | Có bản variable. **Không dùng Fira Code**: font-data cho thấy Fira Code **không có** subset `vietnamese` |

`app/layout.tsx`:

```tsx
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';

const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});
// Chỉ dùng ở editor/code: không preload để trang list không phải chờ.
const mono = JetBrains_Mono({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content', // GIỮ
  viewportFit: 'cover',                 // MỚI: để env(safe-area-inset-*) có giá trị trên iOS
};
// <html lang="vi" className={cn('font-sans', sans.variable, mono.variable)} suppressHydrationWarning>
```

Đánh đổi: không tải italic, nên `*nghiêng*` trong preview sẽ do trình duyệt tự nghiêng (faux italic). Chấp nhận được. Tải thêm italic sẽ tốn thêm 4 file font.

**Quy tắc cho chữ tiếng Việt:** không dùng `leading-none` cho bất kỳ chữ nào có dấu. `DialogTitle` hiện đang dùng `leading-none`, dấu của "Gộp", "Ở lại" có thể bị cắt. Tiêu đề dùng tối thiểu `leading-tight` (1.25), thân bài tối thiểu 1.5.

### 1.2 Thang chữ

| Token | Class Tailwind | Cỡ / line-height / weight | Dùng ở |
|---|---|---|---|
| h1 trang | `text-2xl md:text-[1.75rem] leading-tight font-bold tracking-[-0.02em]` | 24→28 / 1.25 / 700 | "Ghi chú", "Inbox", "Tag", "Thùng rác" |
| h1 note | `text-2xl md:text-3xl leading-tight font-bold tracking-[-0.02em]` | 24→30 / 1.25 / 700 | Ô tiêu đề editor, tiêu đề view thùng rác |
| h2 nhóm | `text-xs leading-4 font-semibold uppercase tracking-[0.06em] text-muted-foreground` | 12 / 16 / 600 | "ĐÃ GHIM", "TAG" ở sidebar |
| Tiêu đề card | `text-[0.9375rem] md:text-base leading-snug font-semibold` | 15→16 / 1.375 / 600 | h2/h3 trong card |
| Body UI | `text-sm leading-normal` | 14 / 21 / 400 | Văn bản chung, nút |
| Trích đoạn | `text-sm leading-relaxed text-muted-foreground` | 14 / 22.75 / 400 | Excerpt trong card |
| Meta | `text-xs leading-4 font-medium tabular-nums` | 12 / 16 / 500 | Ngày, số đếm, chip |
| Label | `text-sm font-medium` | 14 / 20 / 500 | Nhãn form, mục nav |
| Ô nhập mobile | `text-base md:text-sm` | **16** → 14 | GIỮ nguyên (chống iOS zoom) |
| Prose | `prose prose-sm` (editor), `prose md:prose-base` (view đọc) | 14/24 → 16/28 | Markdown |

Chỉ dùng 4 weight: 400 / 500 / 600 / 700. Bước nhảy cỡ chữ đủ lớn: h1 28px so với meta 12px.

### 1.3 Màu: CSS variables (thay toàn bộ `:root` / `.dark` trong `app/globals.css`)

Hue indigo = **277**. Mọi màu trung tính có chroma 0.004–0.02 cùng hue này, nên xám ngả lạnh, đồng bộ với màu nhấn.

```css
:root {
  color-scheme: light;
  --radius: 0.5rem;

  --background: oklch(0.98 0.004 277);      /* nền canvas */
  --foreground: oklch(0.21 0.02 277);
  --card: oklch(1 0 0);                      /* card trắng nổi trên canvas */
  --card-foreground: oklch(0.21 0.02 277);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.02 277);

  --primary: oklch(0.48 0.21 277);           /* indigo: nền nút chính */
  --primary-hover: oklch(0.43 0.19 277);
  --primary-foreground: oklch(1 0 0);
  --primary-ink: oklch(0.48 0.21 277);       /* indigo dạng CHỮ/ICON (link, nav đang chọn, ghim) */

  --secondary: oklch(0.955 0.006 277);
  --secondary-foreground: oklch(0.21 0.02 277);
  --muted: oklch(0.955 0.006 277);
  --muted-foreground: oklch(0.5 0.02 277);
  --accent: oklch(0.94 0.035 277);           /* nền indigo nhạt: mục đang chọn */
  --accent-foreground: oklch(0.48 0.21 277);

  --destructive: oklch(0.55 0.2 27);
  --success: oklch(0.52 0.12 155);
  --warning: oklch(0.55 0.12 60);
  --warning-bg: oklch(0.96 0.04 75);

  --border: oklch(0.91 0.008 277);           /* viền trang trí (card, divider) */
  --input: oklch(0.64 0.015 277);            /* viền Ô NHẬP: ≥ 3:1 */
  --field: oklch(1 0 0);                     /* nền ô nhập */
  --ring: oklch(0.48 0.21 277);
  --selection: oklch(0.88 0.06 277);

  --status-inbox: oklch(0.5 0.11 60);
  --status-inbox-bg: oklch(0.96 0.04 75);
  --status-active: oklch(0.5 0.11 155);
  --status-active-bg: oklch(0.955 0.035 160);
  --status-archived: oklch(0.5 0.015 277);
  --status-archived-bg: oklch(0.945 0.006 277);
  --type-learning: oklch(0.5 0.09 230);
  --type-learning-bg: oklch(0.955 0.025 230);
  --type-personal: oklch(0.52 0.14 350);
  --type-personal-bg: oklch(0.955 0.025 350);

  --sidebar: oklch(0.962 0.008 277);
  --sidebar-foreground: oklch(0.21 0.02 277);
  --sidebar-primary: oklch(0.48 0.21 277);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.925 0.01 277);   /* hover trung tính trong sidebar */
  --sidebar-accent-foreground: oklch(0.21 0.02 277);
  --sidebar-border: oklch(0.91 0.008 277);
  --sidebar-ring: oklch(0.48 0.21 277);

  --elev-1: 0 1px 2px 0 oklch(0.3 0.04 277 / 0.06), 0 1px 3px 0 oklch(0.3 0.04 277 / 0.08);
  --elev-2: 0 2px 4px -1px oklch(0.3 0.04 277 / 0.06), 0 8px 16px -4px oklch(0.3 0.04 277 / 0.12);
  --elev-3: 0 4px 8px -2px oklch(0.3 0.04 277 / 0.08), 0 24px 48px -12px oklch(0.3 0.06 277 / 0.25);
  --glow: color-mix(in oklch, var(--primary) 10%, transparent);
  /* --chart-1..5: giữ như cũ (chưa dùng) */
}

.dark {
  color-scheme: dark;
  --background: oklch(0.17 0.012 277);       /* không dùng đen tuyền */
  --foreground: oklch(0.94 0.008 277);       /* không dùng trắng tuyền */
  --card: oklch(0.215 0.014 277);
  --card-foreground: oklch(0.94 0.008 277);
  --popover: oklch(0.245 0.016 277);         /* elevation 3 sáng hơn card */
  --popover-foreground: oklch(0.94 0.008 277);

  --primary: oklch(0.55 0.2 277);
  --primary-hover: oklch(0.5 0.19 277);
  --primary-foreground: oklch(1 0 0);
  --primary-ink: oklch(0.8 0.11 277);

  --secondary: oklch(0.26 0.014 277);
  --secondary-foreground: oklch(0.94 0.008 277);
  --muted: oklch(0.255 0.014 277);
  --muted-foreground: oklch(0.7 0.018 277);
  --accent: oklch(0.3 0.06 277);
  --accent-foreground: oklch(0.8 0.11 277);

  --destructive: oklch(0.72 0.16 25);
  --success: oklch(0.78 0.13 155);
  --warning: oklch(0.82 0.13 80);
  --warning-bg: oklch(0.29 0.045 70);

  --border: oklch(0.29 0.014 277);
  --input: oklch(0.52 0.015 277);
  --field: oklch(0.19 0.012 277);
  --ring: oklch(0.8 0.11 277);
  --selection: oklch(0.36 0.09 277);

  --status-inbox: oklch(0.83 0.12 75);
  --status-inbox-bg: oklch(0.29 0.045 70);
  --status-active: oklch(0.8 0.12 160);
  --status-active-bg: oklch(0.28 0.04 160);
  --status-archived: oklch(0.72 0.015 277);
  --status-archived-bg: oklch(0.27 0.01 277);
  --type-learning: oklch(0.8 0.1 230);
  --type-learning-bg: oklch(0.28 0.04 230);
  --type-personal: oklch(0.8 0.1 350);
  --type-personal-bg: oklch(0.28 0.04 350);

  --sidebar: oklch(0.15 0.012 277);          /* sidebar tối hơn vùng nội dung (kiểu Linear) */
  --sidebar-foreground: oklch(0.94 0.008 277);
  --sidebar-primary: oklch(0.55 0.2 277);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.22 0.012 277);
  --sidebar-accent-foreground: oklch(0.94 0.008 277);
  --sidebar-border: oklch(0.25 0.012 277);
  --sidebar-ring: oklch(0.8 0.11 277);

  --elev-1: inset 0 1px 0 0 oklch(1 0 0 / 0.04), 0 1px 2px 0 oklch(0 0 0 / 0.4);
  --elev-2: inset 0 1px 0 0 oklch(1 0 0 / 0.06), 0 4px 12px -2px oklch(0 0 0 / 0.5);
  --elev-3: inset 0 1px 0 0 oklch(1 0 0 / 0.07), 0 0 0 1px oklch(1 0 0 / 0.06), 0 24px 48px -12px oklch(0 0 0 / 0.7);
  --glow: color-mix(in oklch, var(--primary) 18%, transparent);
}
```

Thêm vào `@theme inline`, giữ các mapping cũ:

```css
@theme inline {
  --font-sans: var(--font-be-vietnam), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-be-vietnam), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace;
  --color-primary-hover: var(--primary-hover);
  --color-primary-ink: var(--primary-ink);
  --color-field: var(--field);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-warning-bg: var(--warning-bg);
  --color-status-inbox: var(--status-inbox);
  --color-status-inbox-bg: var(--status-inbox-bg);
  --color-status-active: var(--status-active);
  --color-status-active-bg: var(--status-active-bg);
  --color-status-archived: var(--status-archived);
  --color-status-archived-bg: var(--status-archived-bg);
  --color-type-learning: var(--type-learning);
  --color-type-learning-bg: var(--type-learning-bg);
  --color-type-personal: var(--type-personal);
  --color-type-personal-bg: var(--type-personal-bg);
  --shadow-elev-1: var(--elev-1);
  --shadow-elev-2: var(--elev-2);
  --shadow-elev-3: var(--elev-3);
  /* radius: giữ công thức calc hiện có, --radius đổi 0.625rem → 0.5rem */
}
```

Bỏ dòng tự tham chiếu `--font-sans: var(--font-sans)` hiện có. Trong CSS thường, ví dụ CodeMirror, dùng thẳng `var(--font-jetbrains)`, không dùng `var(--font-mono)`: với `@theme inline` biến theme có thể không được xuất ra lúc chạy.

**Ý nghĩa của màu status và loại** (màu luôn đi kèm chữ và icon):

| | Màu | Icon lucide | Lý do |
|---|---|---|---|
| INBOX | hổ phách | `Inbox` | "Chờ sắp xếp", cần để ý |
| ACTIVE | xanh lá | `CircleDot` | Đang dùng |
| ARCHIVED | xám | `Archive` | Ngủ yên, card bị làm chìm xuống |
| LEARNING | xanh lam ngả lục (hue 230) | `GraduationCap` | Tách khỏi indigo 277 của primary |
| PERSONAL | hồng (hue 350) | `Feather` | Ấm, khác đỏ destructive (hue 27) |
| Ghim | indigo `primary-ink` | `Pin` (fill) | **Đổi từ amber sang indigo**, vì amber giờ là màu của INBOX |

### 1.4 Tỉ lệ contrast của các cặp chính

Cách tính: oklch → OKLab → sRGB tuyến tính → độ chói tương đối theo WCAG. Sai số khoảng ±0.1. Sau khi làm xong nên kiểm lại bằng DevTools hoặc axe.

**Light**

| Cặp | Tỉ lệ | Ngưỡng |
|---|---|---|
| foreground / background · card · sidebar | 16.7 · 17.7 · 15.9 | 4.5 |
| muted-foreground / background · card · sidebar · muted | 5.66 · 6.00 · 5.37 · 5.26 | 4.5 |
| muted-foreground / sidebar-accent (hover) | 4.81 | 4.5 |
| primary-foreground / primary (nút chính) | 7.10 | 4.5 |
| primary-ink / card · background · accent · sidebar | 7.10 · 6.70 · 5.93 · 6.36 | 4.5 |
| ring / background (focus) | 6.70 | 3 |
| input (viền ô nhập) / card · background · sidebar | 3.36 · 3.18 · 3.04 | 3 |
| destructive / card · background | 5.37 · 5.07 | 4.5 |
| success / card | 5.20 | 4.5 |
| warning / card · background | 5.03 · 4.75 | 4.5 |
| chip Inbox · Active · Archived (chữ/nền) | 5.51 · 5.05 · 5.11 | 4.5 |
| chip Learning · Personal (chữ/nền) | 5.17 · 5.18 | 4.5 |
| chữ type-learning · type-personal / card | 5.87 · 5.96 | 4.5 |
| foreground / warning-bg (banner thùng rác) | 15.8 | 4.5 |

**Dark**

| Cặp | Tỉ lệ | Ngưỡng |
|---|---|---|
| foreground / background · card · sidebar · popover | 16.0 · 14.7 · 16.5 · 13.6 | 4.5 |
| muted-foreground / background · card · sidebar · muted · popover · accent | 7.16 · 6.56 · 7.36 · 5.90 · 6.07 · 5.16 | 4.5 |
| primary-foreground / primary | 5.18 | 4.5 |
| primary (nền nút) / background | 3.69 | 3 (thành phần UI) |
| primary-ink / background · card · accent · sidebar | 10.1 · 9.2 · 7.26 · 10.35 | 4.5 |
| ring / background · card | 10.1 · 9.2 | 3 |
| input / card · field · background | 3.18 · 3.35 · 3.47 | 3 |
| destructive / background · card | 7.19 · 6.59 | 4.5 |
| success · warning / background | 10.1 · 10.8 | 4.5 |
| chip Inbox · Active · Archived | 8.30 · 8.07 · 6.07 | 4.5 |
| chip Learning · Personal | 7.91 · 7.50 | 4.5 |
| foreground / warning-bg | 11.9 | 4.5 |

**Hai lỗi contrast có sẵn cần sửa cùng đợt này** (màu highlight code trên nền `pre` = muted):
- Light: `--hl-comment: oklch(0.55 0 0)` chỉ đạt khoảng 4.3:1. Đổi thành `oklch(0.5 0.01 277)` (5.3:1). Đưa mọi `--hl-*` light về L = 0.50, riêng `--hl-number` dùng `oklch(0.5 0.12 50)` để không ra ngoài gam màu sRGB.
- Dark: `--hl-comment: oklch(0.62 0 0)` chỉ đạt khoảng 4.3:1. Đổi thành `oklch(0.68 0.015 277)` (5.5:1).

### 1.5 Radius, elevation, spacing

| | Giá trị | Dùng cho |
|---|---|---|
| `rounded-md` (≈6.4px) | chip tag, mục nav | |
| `rounded-lg` (8px) | nút, ô nhập, segmented | |
| `rounded-xl` (≈11px) | card note, khung editor, khối lỗi | |
| `rounded-2xl` (≈14px) | dialog, form login, khối empty state | |
| `rounded-full` | chip status/loại, badge đếm | |
| `shadow-elev-1` | card, nút outline, mục segmented đang chọn | |
| `shadow-elev-2` | card khi hover, nút Note mới trên tab bar, form login | |
| `shadow-elev-3` | dialog, toast, sheet "Thêm" | |

Spacing (thang 4px của Tailwind):

| Chỗ | Mobile | md+ |
|---|---|---|
| Padding ngang của `main` | `px-4` | `md:px-8` |
| Padding dọc của `main` | `pt-[max(1rem,env(safe-area-inset-top))]` | `md:py-6` |
| Khoảng giữa header trang và nội dung | `gap-5` | `gap-6` |
| Khoảng giữa các card | `gap-2` | `gap-2.5` |
| Padding trong card | `p-3.5` (`pointer-coarse`) | `p-4` |
| Khoảng giữa các phần tử meta | `gap-x-2 gap-y-1.5` | |

Z-index: tab bar `z-40`, thanh công cụ editor dính `z-30`, dialog/sheet `z-50`, skip link `z-[60]`.

### 1.6 Phần base trong `globals.css` (thêm và sửa)

```css
@layer base {
  * { @apply border-border outline-ring; }
  :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }   /* GIỮ */
  html { @apply font-sans; accent-color: var(--primary); scroll-padding-top: 4.5rem; }
  body { @apply bg-background text-foreground; }
  ::selection { background: var(--selection); }
  code, kbd, samp, pre { font-family: var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace; }
}

/* WCAG 2.4.11: phần tử đang focus không bị tab bar che */
@media (max-width: 47.999rem) {
  html { scroll-padding-bottom: calc(5rem + env(safe-area-inset-bottom)); }
  /* Bàn phím ảo đang mở (resizes-content đẩy tab bar lên trên bàn phím): ẩn tab bar */
  body:has(:is(input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit']), textarea, [contenteditable='true']):focus) [data-tabbar] {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Prose theo token: không cần dark:prose-invert nữa */
.prose {
  --tw-prose-body: var(--foreground);
  --tw-prose-headings: var(--foreground);
  --tw-prose-lead: var(--muted-foreground);
  --tw-prose-links: var(--primary-ink);
  --tw-prose-bold: var(--foreground);
  --tw-prose-counters: var(--muted-foreground);
  --tw-prose-bullets: var(--muted-foreground);
  --tw-prose-hr: var(--border);
  --tw-prose-quotes: var(--foreground);
  --tw-prose-quote-borders: var(--primary);
  --tw-prose-captions: var(--muted-foreground);
  --tw-prose-code: var(--foreground);
  --tw-prose-pre-code: var(--foreground);
  --tw-prose-pre-bg: var(--muted);
  --tw-prose-th-borders: var(--border);
  --tw-prose-td-borders: var(--border);
}

/* CodeMirror: GIỮ font-size 1rem / 0.875rem từ 768px và outline:none. Thêm: */
.markdown-editor .cm-scroller { font-family: var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.65; }
.markdown-editor .cm-cursor { border-left: 2px solid var(--primary-ink); }
.markdown-editor .cm-selectionBackground,
.markdown-editor .cm-focused .cm-selectionBackground { background: var(--selection) !important; }
.markdown-editor .cm-placeholder { color: var(--muted-foreground); }
```

---

## 2. Layout shell

### 2.1 Breakpoint

| Khoảng | Điều hướng | Editor |
|---|---|---|
| < 768 (`< md`) | Tab bar dưới đáy + sheet "Thêm" | Viết/Xem bằng segmented, metadata gom lại (GIỮ) |
| 768–1023 (`md`) | Sidebar `w-60` (240px) | Vẫn Viết/Xem (chia đôi chỉ còn khoảng 232px mỗi bên, quá hẹp) |
| ≥ 1024 (`lg`) | Sidebar `w-60` | Chia đôi Viết \| Xem |

Thay đổi so với hiện tại: editor đang chia đôi từ `md`, nay **dời lên `lg`**, vì sidebar chiếm 240px. Bộ tóm tắt metadata trên mobile vẫn theo `md`, không đổi.

### 2.2 Mobile: **thanh tab dưới đáy** (không dùng drawer)

Lý do:
1. Nghiên cứu cầm máy của Steven Hoober: phần dưới màn hình là vùng ngón cái với tới dễ nhất. Drawer cần nút hamburger, mà nút này thường nằm ở góc trên trái, vùng khó với nhất.
2. Thanh tab luôn hiện các mục chính (Inbox, Ghi chú, Tag), nên người dùng nhìn là thấy. Drawer giấu chúng đi và tốn thêm một lần chạm. NN/g có nhiều bài cho thấy điều hướng bị giấu được dùng ít hơn hẳn (bài "Hamburger Menus and Hidden Navigation Hurt UX Metrics").
3. Nút "Note mới" nằm giữa thanh tab là đúng tinh thần "mở app là viết được ngay" trong PROJECT.md. Quick capture ở GĐ2 dùng lại đúng vị trí này.

Cấu trúc 5 ô (`grid-cols-5`, cao `h-16`):

```
GĐ1:  [Ghi chú] [Inbox•3] [ (+) ] [Tag] [Thêm]
GĐ2:  [Hôm nay] [Ghi chú] [ (+) ] [Inbox] [Thêm]   ← Tag chuyển vào sheet "Thêm"
```

```tsx
<nav aria-label="Chính" data-tabbar
  className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar/95 backdrop-blur-md
             pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden">
  <ul className="grid h-16 grid-cols-5">
```

- **Mục thường** (GuardedLink): `flex h-full flex-col items-center justify-center gap-1 text-xs font-medium`.
  - Icon `size-5` nằm trong pill `grid h-7 w-14 place-items-center rounded-full transition-colors duration-150`.
  - Đang chọn: pill `bg-accent`, chữ và icon `text-accent-foreground`, kèm `aria-current="page"`.
  - Không chọn: `text-muted-foreground`.
  - Toàn bộ cột cao 64px là vùng chạm.
- **Badge Inbox:** `absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[0.6875rem] font-bold leading-4 bg-status-inbox-bg text-status-inbox`, `aria-hidden`. Hiện `99+` khi lớn hơn 99. Link có thêm `<span className="sr-only">, 3 note</span>`.
- **Ô giữa "Note mới":** `GuardedLink href="/notes/new" aria-label="Note mới"` với class `mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elev-2 hover:bg-primary-hover`, icon `Plus size-6`. Không làm nổi lên khỏi thanh.
- **"Thêm":** `button` có icon `Ellipsis`, `aria-haspopup="dialog"`, `aria-expanded`. Ô này sáng khi đang ở `/trash`.
- **Ẩn tab bar** khi:
  - Đang ở route editor: `pathname === '/notes/new' || /^\/notes\/[^/]+$/.test(pathname)`. Editor là màn hình tập trung vào một việc, nút Lưu nằm trên thanh dính ở trên, giảm được việc chạm nhầm khi gõ.
  - Có ô nhập đang focus (rule CSS ở 1.6).
- `main` trên mobile khi có tab bar: `pb-[calc(5rem+env(safe-area-inset-bottom))]`. Trên route editor: `pb-4`.

**Sheet "Thêm"** (`components/app-shell/more-sheet.tsx`): dùng `Dialog` hiện có, kiểu bottom sheet (class ở 3.9). Gồm các dòng `h-12`:
1. `Trash2` Thùng rác, số đếm ở bên phải. GuardedLink, `onNavigate` đóng sheet.
2. Giao diện: segmented `[Sun Sáng] [Moon Tối]` gọi `setTheme`. Sheet chỉ render khi mở nên đọc `resolvedTheme` không gây lệch hydration.
3. `HealthStatus`.
4. Đường kẻ, rồi `LogoutButton` (`variant="ghost" className="h-12 w-full justify-start"`). Nằm cuối và tách khỏi nút đổi theme, giữ đúng ý của review cũ.

### 2.3 Desktop: sidebar

```
┌──────────────────────┐
│ [▣] Notebook         │ h-14
│ [+ Note mới        ] │ nút primary full width
│ (GĐ2: ô Tìm kiếm ⌘K) │
│                      │
│ (GĐ2: Hôm nay)       │
│ ▤ Inbox         [3]  │ ← badge hổ phách khi > 0
│ ▤ Ghi chú        66  │
│ ▤ Tag            12  │
│ ▤ Thùng rác       4  │
│                      │
│ TAG                  │
│ # docker          14 │
│ # nestjs           9 │
│ … (tối đa 8)         │
│ Xem tất cả 12 tag →  │
├──────────────────────┤
│ ● API và DB hoạt động│
│ [☾ Giao diện]  [⇥ Đăng xuất] │
└──────────────────────┘
```

```tsx
<aside aria-label="Thanh bên"
  className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
  {/* Thương hiệu */}
  <div className="flex h-14 items-center px-4">
    <GuardedLink href="/notes" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-elev-1">
        <NotebookPen className="size-4" aria-hidden />
      </span>
      Notebook
    </GuardedLink>
  </div>
  <div className="px-3 pb-3">
    <GuardedLink href="/notes/new" className={buttonVariants({ className: 'w-full justify-start' })}>
      <Plus aria-hidden /> Note mới
    </GuardedLink>
    {/* GĐ2: nút Tìm kiếm (Ctrl K) dạng ô giả, h-8, ngay dưới */}
  </div>
  <div className="flex-1 overflow-y-auto px-3 pb-3">
    <nav aria-label="Chính"><ul className="flex flex-col gap-0.5">{/* NavItem */}</ul></nav>
    <section aria-labelledby="sb-tags" className="mt-6">{/* TagItem */}</section>
  </div>
  <div className="flex flex-col gap-1 border-t border-sidebar-border p-3">
    <HealthStatus />
    <div className="flex items-center justify-between"><ThemeToggle withLabel /><LogoutButton /></div>
  </div>
</aside>
```

- **NavItem:**
  - Class: `flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground pointer-coarse:h-10`.
  - Đang chọn: `bg-accent text-accent-foreground`, icon `text-primary-ink`, `aria-current="page"`.
  - Số đếm: `ml-auto min-w-6 text-right text-xs tabular-nums`, nội dung `<span className="sr-only">: </span>66<span className="sr-only"> note</span>`.
  - Số Inbox khi lớn hơn 0: `rounded-full bg-status-inbox-bg px-1.5 font-semibold text-status-inbox`.
  - Đang tải thì không hiện số (giữ `min-w-6` để layout không nhảy).
- **Icon:** Inbox `Inbox`, Ghi chú `NotebookText`, Tag `Tags`, Thùng rác `Trash2`. GĐ2: Hôm nay `CalendarDays`, Tìm `Search`.
- **TagItem:**
  - Class: `flex h-7 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground pointer-coarse:h-10`.
  - Nội dung: `Hash size-3.5`, tên `truncate`, số đếm `ml-auto text-xs tabular-nums`.
  - Đang chọn (đang ở `/notes?tag=x`): `bg-accent text-accent-foreground`, `aria-current="page"`.
  - Dữ liệu: `GET /tags` hiện có, sắp ở client theo `noteCount` giảm dần rồi theo tên. Lấy 8 tag đầu, **bỏ tag có 0 note** (vẫn thấy được ở trang Tag). Có hơn 8 tag thì thêm link "Xem tất cả N tag" tới `/tags`.
  - Phần này đọc `useSearchParams`, nên phải bọc trong `<Suspense>` (giống `notes/page.tsx`).
- **Quy tắc active** (hàm thuần `isNavActive` trong `components/app-shell/nav.ts`, có test):
  - Inbox: `pathname.startsWith('/inbox')`.
  - Ghi chú: `pathname === '/notes'` và không có `tag`, hoặc `/notes/<id>`. Không tính `/notes/new`.
  - Tag: `/tags`.
  - Thùng rác: `/trash`.
- **Skip link:** phần tử đầu tiên trong layout là `<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] rounded-lg bg-popover px-3 py-2 shadow-elev-3">Bỏ qua tới nội dung</a>` (WCAG 2.4.1, vì sidebar thêm khoảng 15 link đứng trước nội dung). Dùng `<a>` thường cho anchor hash, không phải `next/link`. `<main id="main" tabIndex={-1}>`.

### 2.4 `app/(app)/layout.tsx`

```tsx
<UnsavedGuardProvider>
  <SkipLink />
  <div className="flex min-h-dvh">
    <AppSidebar />
    <AppMain>{children}</AppMain>   {/* client: biết pathname để chọn pb và có ẩn tab bar hay không */}
  </div>
  <MobileTabBar />
</UnsavedGuardProvider>
```

`AppMain` = `<main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:py-6 {pb theo route}">`.

Bỏ `AppHeader` và footer. HealthStatus và Đăng xuất chuyển vào sidebar trên desktop, vào sheet "Thêm" trên mobile.

Nội dung **căn trái**, không dùng `mx-auto`, để nội dung nằm sát sidebar (NN/g, "Horizontal Attention Leans Left"):

| Trang | Container |
|---|---|
| Danh sách (Ghi chú, Inbox, Thùng rác) | `w-full max-w-5xl` |
| Tag | `max-w-3xl` |
| Editor | `max-w-7xl` |

### 2.5 Header của từng trang (không dính, cuộn theo nội dung)

```tsx
<header className="flex flex-col gap-1">
  <h1 tabIndex={-1} className="rounded-sm text-2xl leading-tight font-bold tracking-[-0.02em] md:text-[1.75rem]">
    Inbox <span className="ml-2 align-middle text-base font-medium text-muted-foreground tabular-nums">3</span>
  </h1>
  <p className="text-sm text-muted-foreground">…mô tả một dòng…</p>
</header>
```

`h1 tabIndex={-1}` phải nằm trong `main`: `list-focus` dùng `main h1` làm đích dự phòng.

| Trang | Mô tả |
|---|---|
| Ghi chú | (không có mô tả, thay bằng bộ lọc) |
| Inbox | "Note mới và ghi nhanh nằm ở đây. Gắn tag, chọn loại rồi chuyển sang Đang dùng." |
| Thùng rác | "Note đã xóa. Mở để xem, khôi phục hoặc xóa vĩnh viễn." |
| Tag | "Bấm tag để xem các note. Đổi tên trùng tag khác sẽ hỏi để gộp." |

### 2.6 Số đếm trên sidebar: **làm được bằng API hiện có**

| Mục | Nguồn | Backend mới? |
|---|---|---|
| Ghi chú | `GET /notes?limit=1` → `total` | Không |
| Inbox | `GET /notes?status=INBOX&limit=1` → `total` | Không |
| Thùng rác | `GET /notes?trashed=true&limit=1` → `total` (service đã có `withDeleted` + `deletedAt IS NOT NULL`) | Không |
| Tag (tổng) và từng tag | `GET /tags` → `items.length`, `noteCount` (đã chỉ đếm note chưa xóa) | Không |
| Xem thùng rác | `GET /notes?trashed=true`, `POST /notes/:id/restore`, `DELETE /notes/:id/permanent`, và `deleteNotePermanently` đã có trong `lib/api/notes.ts` | Không |

Hook `components/app-shell/use-nav-counts.ts`:

```ts
const useCount = (q: ListNotesQuery) =>
  useQuery({
    queryKey: qk.noteList({ ...q, limit: 1 }),   // nằm dưới ['notes','list'] nên afterNoteSaved tự invalidate
    queryFn: () => listNotes({ ...q, limit: 1 }),
    select: (d) => d.total,
    staleTime: 30_000,
  });
```

Cái giá: thêm 3 request rất nhẹ khi mở app. Nếu sau này muốn gộp còn 1 request, endpoint đề xuất (**không làm ở GĐ1**) là `GET /notes/counts` → `{ all, inbox, active, archived, trash }`: một câu `SELECT count(*) FILTER (WHERE …)` trên bảng Note, schema zod `noteCountsSchema` để trong `packages/shared`.

---

## 3. Từng màn hình và component

### 3.1 Primitive (`components/ui/*`)

**button.tsx:** giữ nguyên mọi size `pointer-coarse:*`. Chỉ đổi phần variant:

```ts
default: 'bg-primary text-primary-foreground shadow-elev-1 hover:bg-primary-hover',
outline: 'border-border bg-card shadow-elev-1 hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
secondary: 'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]',
ghost: 'hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/15 dark:hover:bg-destructive/25',
link: 'text-primary-ink underline-offset-4 hover:underline',
```

Bỏ mọi `dark:*input/30|50` ở đây và ở mọi file khác: `--input` giờ là màu viền đậm, không dùng làm nền được nữa. **Không thêm** variant destructive dạng nền đặc: ở dark mode, chữ trắng trên `--destructive` sáng chỉ đạt khoảng 2.7:1.

**input.tsx, native-select.tsx**, khung `tag-input.tsx`, ô ngày trong `note-form.tsx`:
- Đổi `bg-transparent … dark:bg-input/30` thành `bg-field`.
- `disabled:bg-input/50 dark:disabled:bg-input/80` thành `disabled:bg-muted`.
- Giữ `border-input`, giữ `focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring` (ring giờ là indigo), giữ `text-base md:text-sm`, giữ `pointer-coarse:h-10`.

**Mới `components/ui/segmented.tsx`**, dùng chung cho bộ lọc, loại/status trong editor, Viết/Xem và theme. Đây là dạng `role="group"` + `aria-pressed` mà editor đang dùng, chỉ đổi phần nhìn:

```tsx
<div role="group" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-muted p-0.5">
  <button type="button" aria-pressed={on}
    className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors
               hover:text-foreground pointer-coarse:h-9
               aria-pressed:bg-card aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-elev-1">
```

Contrast của chữ muted trên nền muted: 5.26 (light) và 5.90 (dark).

**Mới `components/ui/skeleton.tsx`:** `<div aria-hidden className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)} />`.

**badge.tsx:** giữ để tương thích. Các chip mới nằm ở `note-meta.tsx`.

### 3.2 Chip meta (`components/notes/note-meta.tsx`, mới)

```tsx
// Loại: icon + chữ màu, KHÔNG có nền (nhẹ hơn status)
<span className="inline-flex items-center gap-1 font-medium text-type-learning">
  <GraduationCap className="size-3.5" aria-hidden />Học tập
</span>
// PERSONAL: text-type-personal + Feather

// Status: chip có nền
<span className="inline-flex h-5 items-center gap-1 rounded-full bg-status-inbox-bg px-2 font-medium text-status-inbox">
  <Inbox className="size-3" aria-hidden />Inbox
</span>
// ACTIVE: status-active + CircleDot · ARCHIVED: status-archived + Archive

// Tag (nút lọc): z-10 để nằm trên link phủ toàn card
<button type="button" title={`Lọc theo #${name}`}
  className="relative z-10 inline-flex h-6 items-center rounded-md bg-muted px-1.5 text-muted-foreground
             hover:bg-accent hover:text-accent-foreground pointer-coarse:h-8 pointer-coarse:px-2">
  <span aria-hidden className="opacity-70">#</span>{name}
</button>
```

Để `opacity-70` cho riêng ký tự `#`: chữ chính vẫn đạt contrast đầy đủ. Mục 15 trong bảng "Sửa theo review UI" đã ghi chú vì sao không dùng opacity cho chữ. Ở đây chỉ là ký tự trang trí.

### 3.3 Note card trong danh sách (`components/notes/note-list.tsx`)

```
┌▌─────────────────────────────────────────────────────────────┐
│▌ 📌 Lưu khi mất mạng                                [📌][🗑] │  ← nút hiện khi hover (pointer-fine)
│▌ Outbox ghi vào IndexedDB trước rồi mới gửi lên server…     │
│▌ 🎓 Học tập  (Inbox)  #alpha #docker #pending +2  ·  2 giờ trước │
└──────────────────────────────────────────────────────────────┘
 ▌ = vạch 3px màu theo loại
```

```tsx
<li className={cn(
  'group relative flex gap-2 rounded-xl border bg-card p-4 shadow-elev-1 transition-[box-shadow,border-color] duration-150',
  'hover:border-[color-mix(in_oklch,var(--border),var(--primary)_35%)] hover:shadow-elev-2',
  'has-[[data-note-link]:focus-visible]:outline-2 has-[[data-note-link]:focus-visible]:outline-offset-2 has-[[data-note-link]:focus-visible]:outline-ring',
  'pointer-coarse:p-3.5',
  note.status === 'ARCHIVED' && 'bg-card/60 shadow-none',
)}>
  <span aria-hidden className={cn('absolute inset-y-4 left-0 w-[3px] rounded-r-full',
    note.type === 'LEARNING' ? 'bg-type-learning' : 'bg-type-personal')} />
  <div className="min-w-0 flex-1">
    <Heading /* h2, hoặc h3 khi có nhóm "Đã ghim" */
      className={cn('text-[0.9375rem] leading-snug font-semibold break-words md:text-base',
        note.status === 'ARCHIVED' && 'text-muted-foreground')}>
      {note.pinned ? (<>
        <Pin aria-hidden className="mr-1.5 inline size-3.5 -translate-y-px fill-current text-primary-ink" />
        <span className="sr-only">Đã ghim, </span>
      </>) : null}
      <GuardedLink href={`/notes/${note.id}`} data-note-link={note.id}
        className="focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
        {note.title || <span className="text-muted-foreground">Không có tiêu đề</span>}
      </GuardedLink>
    </Heading>
    {excerpt ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed break-words text-muted-foreground pointer-coarse:line-clamp-3">{excerpt}</p> : null}
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      <TypeLabel type={note.type} />
      {showStatus ? <StatusChip status={note.status} /> : null}
      {tags.slice(0, 3).map(TagChip)}
      {tags.length > 3 ? <span className="text-muted-foreground" title={rest}>+{tags.length - 3}</span> : null}
      <time dateTime={note.updatedAt} title={`Sửa lúc ${formatDateTime(note.updatedAt)}`}
        className="ml-auto text-muted-foreground tabular-nums">
        {formatRelative(note.updatedAt)}
        {differentDay ? <> · <CalendarDays className="inline size-3" aria-hidden /> {formatShortDay(note.entryDate)}</> : null}
      </time>
    </div>
  </div>
  <div className="relative z-10 -mt-1 -mr-1 flex shrink-0 items-start gap-1">
    {/* Pin + Trash: GIỮ nguyên logic, aria-label, revealOnHover (pointer-fine), size icon-sm (pointer-coarse:size-10).
        Đổi màu ghim: fill-current text-primary-ink. Luôn nằm ngang (bỏ sm:flex-row). */}
  </div>
</li>
```

Danh sách: `<ul className="flex flex-col gap-2 md:gap-2.5">` thay cho `divide-y rounded-xl border`.

- **Link phủ toàn card** (stretched link): bấm ở đâu trên card cũng mở note. Tên link chỉ là tiêu đề, gọn hơn cho screen reader.
- **Focus ring nằm trên cả card**, nhờ `has-[]`. Vẫn là outline 2px màu `--ring`, đạt 6.7:1 trở lên.
- Tag và nút đặt `relative z-10` để bấm được.
- **Giữ nguyên `data-note-link`** để `pickFocusAfterRemoval` chạy đúng.
- **Ngày tương đối:** dùng `updatedAt`, vì danh sách đang sắp theo `pinned DESC, updatedAt DESC` (notes.service.ts dòng 70). Hiện ngày theo `updatedAt` mới khớp với thứ tự. `entryDate` chỉ hiện thêm khi khác ngày của `updatedAt` theo giờ địa phương, tức note viết lùi ngày. Thêm vào `lib/date.ts` (có test):

  ```ts
  formatRelative(iso, now = new Date())
  // < 1 phút: "Vừa xong"; < 60 phút: "N phút trước"; < 24 giờ: "N giờ trước";
  // hôm qua: "Hôm qua"; < 7 ngày: "N ngày trước"; cùng năm: "26/10"; khác năm: "26/10/2025"
  formatShortDay(ymd, today) // "Hôm nay" | "Hôm qua" | "26/10" | "26/10/2025"
  ```

  Dữ liệu fetch phía client nên không lo lệch hydration.
- **Nhóm "Đã ghim":** trên trang hiện tại, nếu có item `pinned` thì tách làm hai `<section>`. Mỗi section có `h2` theo kiểu "h2 nhóm" (ĐÃ GHIM · 2 / GHI CHÚ KHÁC), card dùng `h3`. Không có note ghim thì không có section, card là `h2` như hiện tại.
- **Ẩn chip status** ở trang Inbox, vì mọi note ở đó đều là INBOX.
- **Hiện lần lượt khi mount** (tùy chọn, ưu tiên Trung bình): `animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both [animation-delay:calc(var(--i)*30ms)]` với `--i = min(index, 8)`, cộng `motion-reduce:animate-none`.

**Biến thể `variant="trash"`** cho `/trash`:
- Không có Ghim.
- Thời gian là "Đã xóa {formatRelative(deletedAt)}". `noteListItemSchema` đã có `deletedAt`.
- Hai nút: `RotateCcw` "Khôi phục" (ghost icon-sm, `aria-label="Khôi phục {tên}"`) và `Trash2` "Xóa vĩnh viễn" (ghost, `text-destructive`). Nút thứ hai mở dialog xác nhận.
- Link vẫn tới `/notes/<id>`, nơi `TrashedNoteView` chỉ đọc đã có sẵn.
- Focus sau khi gỡ dòng dùng lại `pickFocusAfterRemoval`.

### 3.4 Thanh lọc (trang Ghi chú, `notes-view.tsx`)

Logic URL giữ nguyên: `setParams`, đổi bộ lọc dùng `replace` + `scroll:false`, đổi trang dùng `push`. Chỉ thay control:

```
Desktop (một hàng, flex-wrap gap-2):
[Tất cả | ▤ Inbox | ◉ Đang dùng | ▣ Lưu trữ]  [Tất cả | 🎓 Học tập | 🪶 Cá nhân]  [Mọi tag ▾]  [✕ Bỏ lọc]

Mobile (hai hàng, không cuộn ngang để không giấu lựa chọn):
[Tất cả | Inbox | Đang dùng | Lưu trữ]       ← grid grid-cols-4 w-full
[Tất cả | Học tập | Cá nhân] [Mọi tag ▾]     ← flex gap-2; select flex-1
```

- Status: `Segmented label="Trạng thái"`. Icon trong nút màu theo status (`text-status-*`, `size-3.5`). Không dùng icon cho "Tất cả".
- Loại: `Segmented label="Loại"` với icon `GraduationCap` / `Feather` màu theo loại.
- Tag: **giữ `NativeSelect`**, vì danh sách tag dài và select gốc dùng tốt trên mobile. `bg-field`, `max-w-48`.
- "Bỏ lọc": `Button variant="ghost" size="sm"` + `X`, chỉ hiện khi có lọc.
- **Trang Inbox** dùng chung `NotesView` qua prop `scope="inbox"`: cố định `status: 'INBOX'`, ẩn segmented status.

**Phân trang:** `Button variant="outline" size="sm"` với `ChevronLeft` "Trước" / "Sau" `ChevronRight`. Ở giữa là `text-sm text-muted-foreground tabular-nums`. Nằm `justify-start`, không căn giữa.

### 3.5 Trạng thái đang tải, rỗng, lỗi

**Skeleton danh sách** (`components/notes/note-list-skeleton.tsx`), dùng cả trong `Suspense fallback` của `notes/page.tsx`:

```tsx
<div role="status" aria-busy="true" className="flex flex-col gap-2">
  <span className="sr-only">Đang tải…</span>
  {Array.from({ length: 6 }, (_, i) => (
    <div key={i} className="rounded-xl border bg-card p-4 shadow-elev-1">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="mt-2.5 h-3 w-4/5" />
      <Skeleton className="mt-1.5 h-3 w-3/5" />
      <div className="mt-4 flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-14 rounded-full" /></div>
    </div>
  ))}
</div>
```

**Skeleton editor** (`note-detail.tsx` khi `isPending`): thanh `h-12`, tiêu đề `h-8 w-1/2`, hàng 4 pill `h-8`, khối `rounded-xl border h-[60dvh]`.

**Empty state** (`components/empty-state.tsx`):

```tsx
<div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center">
  <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary-ink"><Icon className="size-6" aria-hidden /></span>
  <h2 className="mt-4 text-base font-semibold">{title}</h2>
  <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
  {action ? <div className="mt-5">{action}</div> : null}
</div>
```

| Trang | Icon | Tiêu đề / Mô tả | Hành động |
|---|---|---|---|
| Ghi chú, chưa có note | `NotebookPen` | "Chưa có note nào" / "Ghi lại điều vừa học hay một ý tưởng. Note mới vào Inbox để sắp xếp sau." | `Viết note đầu tiên` (primary, GuardedLink) |
| Ghi chú, lọc không ra | `ListFilter` | "Không có note nào khớp bộ lọc" | `Bỏ lọc` (outline) |
| Inbox | `Inbox` (nền `bg-status-active-bg text-status-active`) | "Inbox trống" / "Mọi note đã được sắp xếp." | (không có) |
| Thùng rác | `Trash2` | "Thùng rác trống" | (không có) |
| Tag | `Tags` | "Chưa có tag nào" / "Tag được tạo khi bạn gắn vào note." | (không có) |

**Lỗi** (`components/query-error.tsx`):

```tsx
<div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
  <Icon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
  <div className="min-w-0 flex-1">
    <p className="font-medium">{title}</p>
    <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
    <Button className="mt-3" size="sm" variant="outline" onClick={retry}><RefreshCw aria-hidden />Thử lại</Button>
  </div>
</div>
```

- `ApiError` có `status === 0` (`code: 'NETWORK'`): icon `WifiOff`, tiêu đề "Không kết nối được server", mô tả "Server ở nhà có thể đang tắt hoặc mất mạng."
- Lỗi khác: icon `CircleAlert`, tiêu đề "Không tải được danh sách", mô tả `errorMessage(e)`.
- Trang note không tồn tại (`note-detail.tsx`): dùng `EmptyState` với `CircleAlert`, "Không tìm thấy note", và nút `Về danh sách`.

### 3.6 Editor (`components/notes/note-form.tsx`)

**Logic không đổi gì:** guard, nháp localStorage, `replaceState`, Ctrl+S, dialog 409/thùng rác, `commitPendingTag`, `aria-live`.

```
Desktop ≥ lg
┌ thanh dính top-0 ─────────────────────────────────────────────────────┐
│ ← Ghi chú                    ✓ Đã lưu 17:59   [📌] [🗑] [Lưu ⌘S]       │
└──────────────────────────────────────────────────────────────────────┘
(banner nháp nếu có)
Tiêu đề note (30px, 700)
[🎓 Học tập|🪶 Cá nhân] [Inbox|Đang dùng|Lưu trữ] [📅 26/10/2026] [#docker × #nest × Thêm tag…]
┌──────────────────── khung editor (card) ──────────────────────────────┐
│ MARKDOWN                         │ XEM TRƯỚC                           │ h-9
│ (CodeMirror, JetBrains Mono)     │ (prose, nền muted/40)               │
└──────────────────────────────────┴────────────────────────────────────┘
```

**Thanh công cụ dính.** Phải đổi `top-12` thành **`top-0`** vì không còn header chung. Margin âm phải khớp padding mới của `main`:

```
sticky top-0 z-30 -mx-4 -mt-4 flex flex-col gap-1 border-b bg-background/90 px-4 py-2 backdrop-blur
pt-[max(0.5rem,env(safe-area-inset-top))] md:-mx-8 md:-mt-6 md:px-8 md:py-2.5
```

Trạng thái lưu (giữ `aria-live="polite"`, icon `aria-hidden`):

| Trạng thái | Hiển thị |
|---|---|
| Đã lưu | `CircleCheck size-3.5 text-success` + "Đã lưu 17:59" (`text-muted-foreground`) |
| Chưa lưu | chấm `size-2 rounded-full bg-warning` + "Chưa lưu" (`font-medium text-warning`). **Thay `amber-700/400`** |
| Đang lưu | `LoaderCircle size-3.5 animate-spin motion-reduce:animate-none` + "Đang lưu…" |
| Lưu lỗi | `CircleAlert text-destructive` + "Lưu lỗi". Dòng `role="alert"` + "Thử lại" giữ nguyên, thêm `rounded-lg bg-destructive/5 px-2 py-1.5` |

- Ghim: `fill-current text-primary-ink` khi bật, thay amber.
- Nút Lưu: primary indigo, giữ `kbd` (`font-mono text-[0.7rem] opacity-70`).

**Banner nháp:** thay `sky-*` bằng `rounded-xl border border-primary/30 bg-accent px-3 py-2 text-sm`. Icon `History text-primary-ink`, nút "Khôi phục" (primary sm) và "Bỏ" (ghost sm).

**Ô tiêu đề:** `text-2xl md:text-3xl leading-tight font-bold tracking-[-0.02em]`. Giữ `border-b-2 border-transparent focus-visible:border-ring`, chỉ báo focus giờ là gạch dưới indigo.

**Metadata:**
- Loại: `Segmented label="Loại"` thay cho NativeSelect.
- Trạng thái: `Segmented label="Trạng thái"` thay cho NativeSelect. Ba nút theo đúng thứ tự vòng đời INBOX → ACTIVE → ARCHIVED, nên nhìn là thấy note đang ở bước nào.
- Ngày: giữ `<input type="date">` và `text-base md:text-sm`, nền `bg-field`, đặt icon `CalendarDays` bên trái trong wrapper.
- Tag: `TagInput`, chip `bg-accent text-accent-foreground`, nút X giữ `p-1.5 -my-1` (vùng chạm 24px).
- Mobile: giữ nút tóm tắt `aria-expanded`. Nội dung đổi thành `<TypeLabel/> · <StatusChip/> · 26/10 · 2 tag` + `ChevronDown`. Nhập tag sai thì vẫn tự mở như cũ.

**Khung editor:**

```
grid min-h-[60dvh] overflow-hidden rounded-xl border bg-card shadow-elev-1 lg:min-h-0 lg:flex-1 lg:grid-cols-2
```

- Gốc form trên `lg`: `flex flex-col gap-3 lg:h-[calc(100dvh-3rem)]`. 3rem là `md:py-6` của main. Khung editor `lg:flex-1 lg:min-h-0`. Cách này bỏ được số cứng `md:h-[calc(100dvh-18rem)]` và tự co khi có banner nháp hoặc metadata xuống hai hàng.
- Đổi mọi `md:` của phần chia đôi sang `lg:`: `lg:grid-cols-2`, `lg:border-r`, `hidden lg:block`, segmented Viết/Xem thành `lg:hidden`.
- Header của từng pane, chỉ hiện từ `lg`: `hidden lg:flex h-9 items-center border-b px-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground`, nội dung "Markdown" / "Xem trước".
- Pane viết: giữ `focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset`.
- Pane xem: `bg-muted/40 px-5 py-4`, `role="region" aria-label="Xem trước"` (giữ).
- Segmented Viết/Xem dùng `Segmented`, icon `SquarePen` / `Eye`.

**`markdown-preview.tsx`:**

```
prose prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none
prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal
prose-pre:border prose-pre:rounded-lg
```

Bỏ `dark:prose-invert` (biến `--tw-prose-*` ở 1.6 đã theo theme). Placeholder: "Chưa có nội dung."

### 3.7 Note trong thùng rác (`trashed-note-view.tsx`): vẫn chỉ đọc

Không thêm ô nhập nào.

- Banner: `rounded-xl border border-warning/40 bg-warning-bg px-4 py-3`. Icon `Trash2 text-warning`. Chữ "Note này đang trong thùng rác. Khôi phục để sửa." Nút `Khôi phục` (primary, icon `RotateCcw`), **giữ focus vào tiêu đề sau khi khôi phục**.
- Tiêu đề: `h1` theo kiểu h1 note.
- Meta: `TypeLabel`, `StatusChip`, ngày, tag dùng `TagChip` dạng tĩnh (`span`, không phải nút).
- Nội dung: `rounded-xl border bg-card px-5 py-4 shadow-elev-1` + `MarkdownPreview className="md:prose-base"`.
- **Không** đặt "Xóa vĩnh viễn" ở đây. Nút này nằm ở trang `/trash`, đúng như ghi chú trong code.

### 3.8 Trang Thùng rác (`/trash`, mới, chỉ dùng API có sẵn)

- Header theo 2.5, rồi danh sách `variant="trash"`, phân trang như trang Ghi chú.
- Dialog xác nhận xóa vĩnh viễn:
  - Tiêu đề `Xóa vĩnh viễn "{tên}"?`, mô tả "Note sẽ bị xóa hẳn khỏi server, không khôi phục được."
  - Footer: `Hủy` (outline, `initialFocus`) và `Xóa vĩnh viễn` (destructive).
- Hook mới `useDeleteNotePermanently` trong `use-note-actions.ts`: optimistic qua `patchLists`, `onSettled: afterNoteSaved(qc, null)`, toast "Đã xóa vĩnh viễn". **Không có Hoàn tác.**
- **Không** ghi "tự xóa sau 30 ngày": cron dọn thùng rác thuộc GĐ2.

### 3.9 Dialog (`components/ui/dialog.tsx`)

- Overlay: `bg-black/40 dark:bg-black/60 supports-backdrop-filter:backdrop-blur-[2px]`, thay `bg-black/10`.
- Popup: `rounded-2xl bg-popover p-5 shadow-elev-3 ring-1 ring-border`. Giữ `max-h-[calc(100dvh-2rem)] overflow-y-auto`.
- `DialogTitle`: `text-lg leading-snug font-semibold` (bỏ `leading-none`). `DialogFooter`: `-mx-5 -mb-5 rounded-b-2xl bg-muted/50 p-4`.
- **Bottom sheet trên mobile** (ưu tiên Trung bình, nút xác nhận vào vùng ngón cái):

  ```
  max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0
  max-sm:rounded-b-none max-sm:data-open:slide-in-from-bottom-8 max-sm:data-open:zoom-in-100
  ```

  Footer thêm `max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]`. **Phải đo lại** dialog xung đột ở 390×844: ba nút vẫn phải nằm trong màn hình.
- Guard ("Ở lại / Bỏ thay đổi / Lưu rồi đi"): logic và `initialFocus` giữ nguyên, chỉ đổi phần nhìn.
- Xung đột: tiêu đề hai khung thêm chấm màu: "Bản của tôi" `bg-primary`, "Bản trên server" `bg-muted-foreground`. Khung so sánh `bg-muted/40` giữ chiều cao `max-h-[22dvh] md:max-h-[50dvh]`. Thứ tự nút giữ nguyên.

### 3.10 Toast (`components/ui/sonner.tsx`, `app/providers.tsx`)

- Bỏ `richColors`: bảng màu riêng của sonner lệch với token.
- Màu icon đặt qua prop `icons` có sẵn: `CircleCheckIcon className="size-4 text-success"`, `OctagonXIcon … text-destructive`, `TriangleAlertIcon … text-warning`, `InfoIcon … text-primary-ink`.
- `toastOptions.classNames`:

  ```
  toast: 'cn-toast rounded-xl! shadow-elev-3! font-sans'
  actionButton: 'bg-primary! text-primary-foreground! rounded-md! font-medium!'   // nút "Hoàn tác"
  ```

- Vị trí: `position="bottom-right"`, `offset={{ bottom: '1.5rem', right: '1.5rem' }}`, `mobileOffset={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}` để toast không đè lên tab bar. Sonner 2.x có `mobileOffset`.

### 3.11 Trang Tag (`tags-view.tsx`)

- Bỏ `mx-auto`. Container `max-w-3xl`, header theo 2.5 với số tag.
- Danh sách: `rounded-xl border bg-card shadow-elev-1 divide-y`.
- Mỗi dòng: `group flex h-12 items-center gap-3 px-4 pointer-coarse:h-14`:
  - `span grid size-7 place-items-center rounded-md bg-accent text-primary-ink` chứa `Hash size-3.5`.
  - GuardedLink `#tên` (`font-medium hover:text-primary-ink`, `min-w-0 flex-1 truncate`).
  - Thanh tỉ lệ `hidden sm:block h-1.5 w-24 rounded-full bg-muted` với phần bên trong `bg-primary/70` rộng bằng `noteCount / max`, `aria-hidden`.
  - Chữ "`12 note`" (`text-sm tabular-nums text-muted-foreground`).
  - `Pencil` và `Trash2` theo `revealOnHover` giống card (chỉ ẩn khi `pointer-fine`).
- Form đổi tên tại chỗ, dialog gộp, dialog xóa: logic giữ nguyên, chỉ nhận style mới.
- Thứ tự: theo API (tên). **Không** thêm ô lọc tag ở GĐ1.

### 3.12 Đăng nhập (`app/(auth)/login/*`)

Form một ô đăng nhập căn giữa là quy ước (Jakob's Law), nên ngoại lệ với nguyên tắc căn trái ở đây là hợp lý.

```tsx
<main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-10
                 before:pointer-events-none before:absolute before:inset-0
                 before:bg-[radial-gradient(40rem_28rem_at_50%_0%,var(--glow),transparent_70%)]">
  <div className="fixed top-3 right-3"><ThemeToggle /></div>
  <div className="relative w-full max-w-sm">
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-elev-2">
        <NotebookPen className="size-6" aria-hidden />
      </span>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">Notebook</h1>
      <p className="text-sm text-muted-foreground">Sổ tay học tập & cá nhân</p>
    </div>
    {/* form: rounded-2xl border bg-card p-6 shadow-elev-2 flex flex-col gap-4 */}
  </div>
</main>
```

- Input `h-11`, `text-base`, `bg-field`.
- Lỗi: `CircleAlert size-4` + chữ `text-destructive`, giữ `role="alert"` và `aria-describedby`.
- Nút: `h-11 w-full` primary.
- Nút hiện/ẩn mật khẩu (tùy chọn, ưu tiên Trung bình): `Eye`/`EyeOff`, `aria-pressed`, `aria-label="Hiện mật khẩu"`, đặt bên phải trong input, `pointer-coarse:size-10`.
- Glow chỉ 10% (light) / 18% (dark): muted-foreground trên vùng glow vẫn trên 5:1.

### 3.13 Phần nhỏ khác

- `health-status.tsx`: chấm màu `bg-success` / `bg-destructive` / `bg-muted-foreground/40`, thay emerald/red.
- `theme-toggle.tsx`: thêm prop `withLabel` (ghost sm, "Giao diện sáng"/"Giao diện tối"). Đổi icon vẫn bằng `dark:` để không lệch hydration.
- `logout-button.tsx`: nhận `className`, vẫn đi qua `useGuardedAction`.

---

## 4. File cần sửa hoặc tạo, theo thứ tự nên làm

| # | File | Việc |
|---|---|---|
| 1 | `app/layout.tsx` | Be Vietnam Pro + JetBrains Mono, `viewportFit: 'cover'` |
| 2 | `app/globals.css` | Token 1.3, `@theme` 1.3, base/prose/CodeMirror 1.6, sửa `--hl-*`, rule tab bar và reduced motion |
| 3 | `components/ui/button.tsx`, `input.tsx`, `native-select.tsx`, `dialog.tsx`, `sonner.tsx`; `app/providers.tsx` | Variant, `bg-field`, dialog, toast |
| 4 | **Mới** `components/ui/segmented.tsx`, `components/ui/skeleton.tsx` | |
| 5 | `lib/date.ts` + `lib/date.test.ts` | `formatRelative`, `formatShortDay` |
| 6 | **Mới** `components/notes/note-meta.tsx` | `TypeLabel`, `StatusChip`, `TagChip` |
| 7 | **Mới** `components/app-shell/nav.ts` (+ `nav.test.ts`), `use-nav-counts.ts`, `app-sidebar.tsx`, `mobile-tab-bar.tsx`, `more-sheet.tsx`, `app-main.tsx`, `skip-link.tsx` | Mảng `NAV` có comment chừa chỗ `Hôm nay` / `Tìm kiếm` |
| 8 | `app/(app)/layout.tsx` | Shell mới. **Xóa** `components/app-header.tsx` |
| 9 | `components/health-status.tsx`, `theme-toggle.tsx`, `logout-button.tsx` | Token, prop |
| 10 | **Mới** `components/empty-state.tsx`, `components/query-error.tsx`, `components/notes/note-list-skeleton.tsx` | |
| 11 | `components/notes/note-list.tsx` | Card mới, nhóm ghim, `variant="trash"` |
| 12 | `app/(app)/notes/notes-view.tsx`, `notes/page.tsx` | Header, segmented, prop `scope`, các trạng thái |
| 13 | **Mới** `app/(app)/inbox/page.tsx` | `NotesView scope="inbox"` trong `Suspense` |
| 14 | `components/notes/use-note-actions.ts` | `useDeleteNotePermanently` |
| 15 | **Mới** `app/(app)/trash/page.tsx`, `app/(app)/trash/trash-view.tsx` | |
| 16 | `components/notes/note-form.tsx`, `tag-input.tsx`, `components/editor/markdown-preview.tsx` | `top-0`, `lg:`, segmented, trạng thái lưu |
| 17 | `components/notes/trashed-note-view.tsx`, `conflict-dialog.tsx`, `app/(app)/notes/[id]/note-detail.tsx` | |
| 18 | `app/(app)/tags/tags-view.tsx` | |
| 19 | `app/(auth)/login/page.tsx`, `login-form.tsx` | |

**Kiểm tra sau khi làm:**
- Chạy lại bộ Playwright 108 bài, cả hai theme, 1280 và 390, `pointer: coarse`, cộng thêm ca cho `/inbox`, `/trash` và tab bar.
- Ca dễ hỏng nhất:
  - focus sau khi xóa (giờ có link phủ toàn card);
  - thanh Lưu dính ở `top-0` khi cuộn note dài;
  - dialog xung đột ở 390×844 nếu làm bottom sheet;
  - tab bar biến mất khi gõ tag ở trang Tag;
  - `Note mới` gọi ngay sau khi lưu.
- Chạy axe để kiểm contrast.
- `pnpm -r lint` (rule `no-restricted-imports`: mọi link mới đều phải là `GuardedLink`).

---

## 5. Những sửa lỗi phải giữ nguyên (checklist cho dev)

- [ ] Mọi link điều hướng trong app (sidebar, tab bar, sheet, tag, empty state) là `GuardedLink`. Skip link `#main` là `<a>` thường. Đăng xuất đi qua `useGuardedAction`.
- [ ] `:focus-visible` outline 2px `--ring`, đạt từ 6.7:1 trở lên ở cả hai theme. Ô nhập giữ `ring-1 ring-ring` + `border-ring`. Card dùng outline qua `has-[]`.
- [ ] Mọi size `pointer-coarse:*` của Button giữ nguyên. Nav, tab bar, chip tag và dòng tag đều có `pointer-coarse:h-8..14`.
- [ ] Mọi ô nhập `text-base md:text-sm`. CodeMirror 1rem dưới 768px.
- [ ] `TrashedNoteView` không có ô nhập hay `contenteditable`. Khôi phục xong thì focus vào tiêu đề.
- [ ] Thanh công cụ editor vẫn dính (`top-0`), nút Lưu luôn trong màn hình. `interactiveWidget: 'resizes-content'` giữ nguyên.
- [ ] Nháp localStorage và banner nháp: logic không đổi.
- [ ] `data-note-link`, `main h1[tabIndex=-1]`, `aria-pressed` cho Viết/Xem, `role="region"` cho xem trước, "Đóng" trong dialog.
- [ ] Không dùng `maximum-scale`.

---

## 6. Những gì cố ý KHÔNG làm

1. **Không đổi backend, không có endpoint đếm mới.** Số đếm lấy từ `total` với `limit=1`. `GET /notes/counts` chỉ là đề xuất cho sau này (2.6).
2. **Không thiết kế Hôm nay, tìm kiếm, Ctrl+K, quick capture, chế độ đọc.** Chỉ chừa chỗ: mục đầu sidebar, ô tìm dưới nút Note mới, ô 1 trên tab bar.
3. **Không dùng component `Sidebar` của shadcn.** Nó cần SidebarProvider, cookie state và Sheet riêng, quá nặng cho 4 mục điều hướng.
4. **Không thu gọn hay kéo giãn sidebar,** không làm icon rail cho tablet.
5. **Không gán màu riêng cho từng tag.** Đã có 5 màu status/loại, thêm màu tag sẽ thành nhiễu. Tag giữ màu trung tính, hover sang indigo.
6. **Không đổi status ngay trên card ở Inbox,** không vuốt để xóa/ghim (vuốt cần phương án thay thế theo WCAG 2.5.7). Để GĐ2 làm cùng quick capture.
7. **Không có "Dọn sạch thùng rác"** và không đếm ngược 30 ngày (cron dọn thuộc GĐ2).
8. **Không thêm dependency:** không framer-motion, date-fns, vaul hay shadcn Select. Animation dùng `tw-animate-css` có sẵn, ngày tương đối tự viết, sheet dựng từ `Dialog` base-ui.
9. **Không làm glassmorphism, parallax hay hiệu ứng chuyển trang.** Chỉ có glow nhẹ ở trang login, `backdrop-blur` ở thanh dính và tab bar (đã có từ trước).
10. **Không thêm theme "system".** Giữ `enableSystem={false}`, mặc định dark.
11. **Không tải italic** cho Be Vietnam Pro (chấp nhận faux italic trong preview).

---

## 7. Nguồn tham khảo

- NN/g, *Horizontal Attention Leans Left*: lý do căn trái nội dung, đặt sidebar bên trái. https://www.nngroup.com/articles/horizontal-attention-leans-left/
- NN/g, *Hamburger Menus and Hidden Navigation Hurt UX Metrics*: lý do chọn tab bar thay drawer. https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/
- Steven Hoober, *How Do Users Really Hold Mobile Devices?* (UXmatters 2013, có nghiên cứu tiếp theo): vùng ngón cái.
- WCAG 2.2: SC 1.4.3 / 1.4.11 (contrast), 2.4.1 (skip link), 2.4.11 (focus không bị che), 2.5.7 (thay thế cho thao tác kéo), 2.5.8 (vùng chạm).
- Be Vietnam Pro (Lâm Bảo, Tony Le, ViệtAnh Nguyễn): font thiết kế riêng cho dấu tiếng Việt. Subset kiểm tra tại `node_modules/.pnpm/next@16.4.3…/next/dist/compiled/@next/font/dist/google/font-data.json`.

**Nếu chỉ kịp làm một việc:** làm mục 1–3 và 11 trong bảng file. Token mới, nút indigo, overlay dialog đậm hơn và card có vạch màu theo loại kèm chip status sẽ giải quyết phần lớn cảm giác "toàn xám, các dòng giống hệt nhau", mà chưa cần đụng tới shell.