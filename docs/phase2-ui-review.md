## Review giao diện Giai đoạn 2

**Kết luận chung:** Phần nhìn nhất quán với hệ thống design GĐ1: token, chip, card có vạch màu, segmented, bottom sheet. Toàn bộ luồng ghi nhanh, outbox, lịch và chế độ đọc đều đi đúng hướng. Phần cần sửa nằm ở ba chỗ:
- Luồng ghi nhanh trên mobile còn hai chỗ có thể mất chữ hoặc tốn thêm lần chạm. Hai chỗ này mới thử trên Chrome desktop giả lập, chưa thử trên máy thật.
- Trạng thái outbox chưa tách "lỗi" khỏi "chờ", và không báo "đã gửi".
- Có vài chỗ chỉ dùng màu để truyền thông tin.

Tính số lần chạm của luồng ghi nhanh mobile (m-dark-capture.png): chạm "+" → gõ → Enter = **2 chạm**, tốt. Nếu iOS không tự bật bàn phím (A3) thì thành 3 chạm. Nếu Gboard ăn mất Enter trong lúc đang gõ dở một từ (A4) thì thành 4 chạm.

---

### A. Phải sửa

**A1. Đóng sheet ghi nhanh là mất chữ đang gõ**
- Chỗ: `components/capture/capture-dialog.tsx:13-20`, `capture-composer.tsx:77`.
- Vấn đề: `text` là state cục bộ trong `CaptureComposer`, mà Popup của base-ui bị unmount khi đóng. Lớp nền phủ khoảng 3/4 màn hình phía trên sheet, nên lỡ chạm vào đó (hoặc bấm Esc, ✕) là mất ý vừa gõ, không có cảnh báo. Với một công cụ ghi nhanh, đây là lỗi nặng nhất có thể gặp.
- Sửa: chuyển nháp ra `CommandProvider` (`captureDraft`, `setCaptureDraft`), hoặc lưu vào `sessionStorage['nb:capture-draft']`. Chỉ xóa nháp sau `enqueue` hoặc `expand`. Khi mở lại sheet thì điền lại nháp, đặt con trỏ ở cuối.
- Cùng loại: `app/(app)/today/today-view.tsx:202` có `key={date}`, nên bấm sang ngày khác trên lịch desktop là xóa chữ trong composer. Bỏ `key`, vì `date` chỉ được đọc lúc lưu. Riêng `placeholder` vẫn đổi theo ngày.

**A2. Dòng thời gian chỉ dùng màu để báo loại note**
- Chỗ: `components/today/timeline.tsx:78-86` và `140-141`.
- Vấn đề: chấm màu xanh/hồng có `aria-hidden`, và card không có `TypeLabel`. Như vậy vi phạm WCAG 1.4.1, trình đọc màn hình không biết note thuộc loại nào, và lệch với card ở danh sách (`note-list.tsx:193`). Xem m-dark-today.png, d-light-today.png.
- Sửa: thêm `<TypeLabel type={note.type} />` làm phần tử đầu của hàng meta (dòng 140), trước `StatusChip`.

**A3. iOS có thể không bật bàn phím khi mở sheet (cần thử trên iPhone, cả khi chạy PWA standalone)**
- Chỗ: `capture-composer.tsx:183`, `mobile-tab-bar.tsx:62`.
- Vấn đề: `autoFocus` nằm trong Popup được portal và có animation. Safari iOS chỉ bật bàn phím khi `focus()` chạy trong cùng lượt xử lý cử chỉ của người dùng. Ảnh chụp có vòng focus là từ Chrome desktop, nên chưa chứng minh được gì cho iOS.
- Sửa (chỉ làm nếu thử thấy lỗi): trong `onClick` của nút "+" và nút giả ở trang Hôm nay, tạo và focus một input ẩn **đồng bộ** trước khi gọi `openCapture()`. Sau đó composer lấy focus và gỡ input ẩn:
  ```ts
  const p = Object.assign(document.createElement('input'), { className: 'fixed top-0 left-0 size-px opacity-0' });
  p.style.fontSize = '16px'; p.dataset.focusProxy = ''; document.body.append(p); p.focus();
  openCapture();
  // CaptureComposer: useEffect(() => { if (autoFocus) { ref.current?.focus(); document.querySelector('[data-focus-proxy]')?.remove(); } }, []);
  ```

**A4. Enter khi Gboard (Android) đang gạch chân một từ thì xuống dòng thay vì lưu (cần thử trên Android)**
- Chỗ: `capture-composer.tsx:166-170`.
- Vấn đề: khi gõ Telex trên Gboard, từ đang gõ dở là một lần composition. Lúc đó Enter phát `keyCode 229`, code bỏ qua đúng như thiết kế, nhưng trình duyệt lại chèn `\n`. Người dùng thấy con trỏ nhảy xuống dòng mà note chưa được lưu, phải bấm Enter lần nữa.
- Sửa: chỉ trên màn cảm ứng, chặn ngắt dòng bằng `beforeinput` gốc (thiết kế đã quy định "muốn nhiều dòng thì Mở rộng"):
  ```ts
  useEffect(() => {
    const el = ref.current; if (!el || !matchMedia('(pointer: coarse)').matches) return;
    const on = (e: InputEvent) => {
      if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') { e.preventDefault(); void saveRef.current(); }
    };
    el.addEventListener('beforeinput', on); return () => el.removeEventListener('beforeinput', on);
  }, []);
  ```
  `save` nên đọc `ref.current.value` thay vì state `text`, để lấy được chữ vừa chốt xong.

**A5. ARIA sai trong bảng lệnh**
- Chỗ: `components/command/command-palette.tsx:358-367`.
- Vấn đề: `<p role="status">` và `<p role="alert">` nằm bên trong `role="listbox"`. Listbox chỉ được chứa option hoặc group, nên đây là lỗi `aria-required-children`. axe không bắt được vì lần chạy không có ca "không có kết quả". Ngoài ra, live region được mount lúc đang hiện thì trình đọc màn hình thường không đọc.
- Sửa: đưa hai dòng này ra sau `</div>` của listbox. Thêm một vùng thông báo luôn có sẵn: `<p role="status" className="sr-only">{query ? \`${found.data?.items.length ?? 0} note khớp\` : ''}</p>`, đặt ngoài listbox, render ngay từ đầu.

---

### B. Nên sửa

**B1. Outbox gộp "lỗi" chung với "chờ gửi"**
- Chỗ: `app-sidebar.tsx:284-296`, `more-sheet.tsx:118-127`, `mobile-tab-bar.tsx:26`.
- Vấn đề: record `failed` (cần bạn xử lý tay) vẫn hiện là "N note chờ gửi" màu vàng, giống hệt record đang tự gửi lại.
- Sửa: `useOutbox` trả thêm `failedCount`. Khi `failedCount > 0` thì hiện trước tiên `<CircleAlert/> {failedCount} note gửi lỗi` với `text-destructive`, rồi mới đến dòng chờ gửi (chỉ đếm record pending).

**B2. Không có phản hồi "đã gửi" khi outbox tự gửi ở nền**
- Chỗ: `outbox-provider.tsx:52-60`.
- Vấn đề: sau khi có mạng lại, các note chờ biến mất mà không có thông báo nào. Người dùng không biết là đã lên server hay bị mất.
- Sửa: trong provider, theo dõi `records.length`. Khi giảm từ n > 0 về 0 do gửi (không phải do `remove`/`clear`) và đó không phải lần `sendNow` của composer, thì gọi `toast.success(\`Đã gửi ${n} note chờ lên server\`)` một lần.

**B3. Trên mobile hầu như không thấy note chờ gửi**
- Chỗ: `mobile-tab-bar.tsx:36-43`.
- Vấn đề: badge Inbox cộng chung số INBOX với số chờ gửi, cùng màu hổ phách. Ngoài trang Inbox và sheet "Thêm" thì không có dấu hiệu nào khác.
- Sửa: khi `pendingCount > 0`, thêm một chấm `CloudOff` nhỏ ở góc dưới icon: `absolute -bottom-1 -right-1 size-3.5 rounded-full bg-sidebar text-warning`. Thêm `sr-only` ", {pendingCount} chờ gửi".

**B4. Card chờ gửi bị lỗi ở trang Hôm nay không bấm được**
- Chỗ: `timeline.tsx:181-189`.
- Vấn đề: dòng "Gửi lỗi, xem ở Inbox" là chữ thường, không phải link.
- Sửa: bọc bằng `GuardedLink href="/inbox"`, class `underline-offset-4 hover:underline pointer-coarse:py-2`.

**B5. Trên iOS, bàn phím che hàng nút bên dưới ô nhập**
- Chỗ: `capture-composer.tsx:173-223`.
- Vấn đề: Safari iOS không hỗ trợ `interactive-widget=resizes-content`. Sheet `bottom-0` nằm dưới bàn phím, nên "Mở rộng", chọn loại và "Lưu" bị che (Enter vẫn lưu được).
- Sửa: trên mobile đặt ô nhập ở cuối, giống ô nhập của app nhắn tin: textarea `max-sm:order-last`, hàng nút `max-sm:order-first`. Thử lại trên iPhone.

**B6. Vùng chạm trong sheet ghi nhanh dưới 44px**
- Chỗ: `capture-composer.tsx:200-221`.
- Vấn đề: "Lưu" và "Mở rộng" dùng `size="sm"`, nên cao 40px. Segmented `pointer-coarse:h-9` chỉ cao 36px.
- Sửa:
  - Hai Button thêm `className="pointer-coarse:h-11"`.
  - Segmented truyền `itemClassName="pointer-coarse:h-11"`.
  - Nút "Đọc" ở `today-view.tsx:114`: `pointer-coarse:size-11`.

**B7. Khoảng trống thừa giữa tiêu đề và đoạn trích trên mobile**
- Chỗ: `timeline.tsx:121-134` (xem m-dark-today.png, card "Kế hoạch hôm nay").
- Vấn đề: nút 40px nằm cùng hàng với tiêu đề một dòng nên đẩy đoạn trích xuống khoảng 18px.
- Sửa: bỏ nút ra khỏi luồng: `<div className="absolute top-2 right-2 z-10">{actions}</div>`, `h2` thêm `pr-10`. Làm tương tự ở `note-list.tsx:238`.

**B8. Card Inbox trên mobile bị ép hẹp**
- Chỗ: `note-list.tsx:238-299` (xem m-dark-inbox.png).
- Vấn đề: 3 nút chiếm khoảng 140px, cột chữ còn khoảng 190px. "pnpm add…" xuống dòng vụn, "Vừa xong" nằm lơ lửng giữa card. Nút ✓ chỉ có icon, dễ hiểu nhầm thành "xong/xóa".
- Sửa (riêng `variant==='inbox'` dưới `md`):
  - `li` thêm `max-md:flex-col`.
  - Khối nút thêm `max-md:mt-2 max-md:mr-0 max-md:self-end`.
  - Bỏ `max-md:sr-only` ở chữ "Đang dùng" (dòng 277) và bỏ `max-md:size-7 max-md:px-0` (dòng 274), để nút có chữ.

**B9. Ngày hôm nay trong dải tuần chỉ phân biệt bằng màu, và mất dấu khi đang được chọn**
- Chỗ: `week-strip.tsx:56`, `month-calendar.tsx:109`.
- Sửa: hôm nay khi không được chọn thì thêm `isToday && !isSelected && 'ring-1 ring-inset ring-primary-ink/60'`. Ở dải tuần thêm `font-bold` giống lịch tháng.

**B10. Mục lục trong chế độ đọc trên mobile chỉ có ở đầu bài**
- Chỗ: `reading-view.tsx:153`, `toc.tsx:83-95`.
- Vấn đề: đã cuộn xuống giữa bài thì không mở lại được mục lục. Thiết kế đặt nút này trên thanh dính.
- Sửa: dưới `xl`, đặt nút ghost `ListTree` "Mục lục" trong `bar` (cạnh "Sửa"). Nút mở `Dialog` có sẵn (thành bottom sheet) chứa `TocList` với `active`, bấm vào một mục thì đóng sheet. Bỏ `<details>`.

**B11. Bảng lệnh trống đẩy nhóm "Gần đây" xuống khuất**
- Chỗ: `command-palette.tsx:219-224` (xem d-dark-palette.png, chỉ thấy được 1 note gần đây).
- Vấn đề: 8 lệnh hiện trước, mà phần lớn trùng với sidebar.
- Sửa: khi `query === ''`, đặt nhóm "Gần đây" lên trước, nhóm Lệnh chỉ còn Ghi nhanh, Note mới, Đổi giao diện. Các lệnh điều hướng chỉ hiện khi gõ khớp.

---

### C. Tùy chọn

- **Segmented ở dark:** mục đang chọn (`bg-card`, L 0.215) **tối hơn** nền rãnh (`bg-muted`, 0.255), trông như bị lõm xuống. Rõ nhất trong sheet ghi nhanh và dialog Sắp xếp (d-dark-triage.png). Sửa ở `segmented.tsx:46`: thêm `dark:aria-pressed:bg-[oklch(0.33_0.016_277)]`.
- **Độ dài dòng ở chế độ đọc:** trên desktop khoảng 78 ký tự/dòng, vì `max-w-[68ch]` tính theo chữ 16px của `article`. Đổi thành `md:max-w-[38rem]`, khoảng 65 ký tự với chữ 18px. Có thể làm dịu chữ thân bài ở dark: `[data-reading] .prose{--tw-prose-body:oklch(0.88 0.008 277)}`.
- **Câu thông báo khi gửi chậm:** "Đã lưu trên máy, sẽ tự gửi khi có mạng" (`capture-composer.tsx:126`) hiện cả khi mạng vẫn có, chỉ là server chậm. Đổi câu theo `navigator.onLine`: "…sẽ tự gửi lại".
- **Nút "Gửi lại" không phản hồi:** `pending-list.tsx:119-127`. Khi `nextAttemptAt <= now` thì đặt `disabled` và thêm `animate-spin motion-reduce:animate-none` cho icon.
- **`opacity-70` khi đang tải:** ở `notes-view.tsx:300`, `today-view.tsx:235`, `trash-view.tsx:63`, làm chữ muted tạm thời mất contrast. Đổi thành `aria-busy` cộng một thanh mảnh `h-0.5 animate-pulse bg-primary` phía trên danh sách.
- **Dòng "N kết quả":** `role="status"` ở `notes-view.tsx:261` chỉ mount khi đang tìm, nên lần tìm đầu có thể không được đọc. Để vùng `role="status"` luôn render, chỉ đổi nội dung bên trong.
- **Quá nhiều nút primary ở desktop Hôm nay:** có 3 nút primary cùng lúc (sidebar, "Note mới cho ngày này", "Lưu"). Đổi nút ở header (`today-view.tsx:186`) sang `buttonVariants({ variant: 'outline', size: 'sm' })`.
- **Dải tuần thiếu tên tháng:** khi lật sang tuần khác thì không biết đang ở tháng nào. Thêm một dòng `text-xs text-muted-foreground` hiện tháng của `anchor`. Phím mũi tên trong lưới lịch vẫn để sau, như báo cáo đã ghi.
- **Mũi tên ▼ của `<datalist>` trong TagInput:** sáng trắng, lệch tông (d-dark-triage.png). Ẩn bằng `[&::-webkit-calendar-picker-indicator]:hidden`.
- **"Quay lại" ở chế độ đọc:** `reading-view.tsx:38` dựa vào `history.length > 1`, không đáng tin (lịch sử có thể dẫn ra ngoài app). Thay bằng cờ `sessionStorage` do `GuardedLink` đặt khi điều hướng trong app.
- **Đoạn trích gộp các mục danh sách:** "Viết báo cáo Đi chợ" (m-dark-today.png) là hai mục bị dính liền. Cho `stripMarkdown` nối các mục bằng " · ", giống cách đã làm với bảng.
- **Link "Xem" trong dòng "Đã ẩn N note lưu trữ":** `notes-view.tsx:277`, vùng chạm khoảng 36px. Thêm `pointer-coarse:min-h-11`.
- **Chip trạng thái ở Thùng rác:** không có ích ở đó. Ẩn bằng `showStatus={false}` ở `trash-view.tsx:64`.
- **Phím tắt một ký tự `C`:** WCAG 2.1.4 (mức A) yêu cầu tắt hoặc đổi được phím tắt một ký tự. App chỉ có một người dùng, nếu bạn không nhập bằng giọng nói thì chấp nhận được.

### Điểm làm tốt (giữ nguyên)
- `enterKeyHint`, chữ 16px ở mọi ô nhập, kiểm tra IME (`isImeComposing`).
- Tab bar ẩn khi bàn phím mở, toast nằm trên tab bar.
- Lịch dùng `<table>` + `aria-pressed`/`aria-current`, ô 44px trên màn cảm ứng.
- `<mark>` dựng bằng React, không dùng HTML.
- Dialog xác nhận xóa focus mặc định vào nút Hủy.
- Thùng rác báo hạn bằng icon + chữ, không chỉ bằng màu.

### Ưu tiên nếu ít thời gian
Làm A1 (giữ nháp khi đóng sheet), sau đó thử A3 và A4 trên một iPhone và một máy Android thật. Ba mục này quyết định trải nghiệm ghi nhanh có đúng "2 chạm, không mất chữ" hay không.
