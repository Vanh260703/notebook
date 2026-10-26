## Review giao diện Giai đoạn 1: notebook web

Mọi đường dẫn bên dưới đều tính từ `/home/anhn/my-project/notebook/apps/web/`.

**Kết luận chung:** phần lõi đã đúng hướng. Xóa có Hoàn tác thay vì hỏi xác nhận, bộ lọc nằm trên URL, có dialog xung đột, dùng `<select>` gốc, form đăng nhập có label, `aria-invalid` và `role=alert`, đã đặt `lang="vi"` và font có subset tiếng Việt. Vấn đề nằm ở trải nghiệm điện thoại và ở việc bảo vệ dữ liệu chưa lưu. Trên iOS Safari, `beforeunload` không chạy, nên khi dùng trên điện thoại gần như chưa có lớp bảo vệ nào. Focus ring của theme shadcn mặc định quá mờ ở cả hai theme. Vùng chạm phần lớn chỉ 28–32px.

---

## A. Nên sửa ngay

### 1. Mất thay đổi chưa lưu khi điều hướng (điểm đã biết số 1)
- **Vấn đề:**
  - Chỉ có `beforeunload`, mà iOS Safari không phát sự kiện này. Trên điện thoại, đóng tab hay bị hệ điều hành kill tab đều mất bài.
  - Bấm link trong app hoặc nút Back cũng mất.
  - Đăng xuất (`window.location.assign`) trên mobile cũng mất.
- **Chỗ liên quan:**
  - `components/notes/note-form.tsx:163-172`
  - Các `<Link>`: `components/app-header.tsx:36,45,62`, `components/notes/note-form.tsx:196`, `app/(app)/notes/[id]/note-detail.tsx:27`, `app/(app)/notes/notes-view.tsx:137`, `app/(app)/tags/tags-view.tsx:104`
  - Đăng xuất: `components/app-header.tsx:68-77`
- **Cách sửa, làm hai lớp:**
  - **(a) Chặn link bằng `onNavigate` của `<Link>`.** Next 16.4.3 có sẵn prop này (đã xem `next/dist/client/app-dir/link.d.ts:170`), nên không cần trò bắt sự kiện click ở capture phase.

    ```tsx
    // components/unsaved-guard.tsx
    'use client';
    type Guard = { dirty: React.MutableRefObject<boolean>; save: React.MutableRefObject<(() => Promise<boolean>) | null>; go: (href: string) => void };
    const Ctx = createContext<Guard | null>(null);
    export const useUnsavedGuard = () => useContext(Ctx)!;

    export function GuardedLink(props: ComponentProps<typeof Link>) {
      const g = useContext(Ctx);
      return <Link {...props} onNavigate={(e) => {
        props.onNavigate?.(e);
        if (g?.dirty.current) { e.preventDefault(); g.go(String(props.href)); }
      }} />;
    }
    ```

    - Provider đặt trong `app/(app)/layout.tsx`, giữ `pending: string | null` và hiện Dialog có ba nút: **Lưu rồi đi** (primary), **Bỏ thay đổi**, **Ở lại**. Focus mặc định vào "Ở lại", Esc cũng là "Ở lại".
    - Provider expose thêm `guardedPush(href)` cho các lần điều hướng bằng code. Ctrl+K ở GĐ2 sẽ cần, nên làm luôn để sau không phải sửa lại.
    - Trong NoteForm:

      ```ts
      useEffect(() => { g.dirty.current = dirty && !readOnly; return () => { g.dirty.current = false; }; }, [dirty, readOnly]);
      ```

      Gán `g.save.current` là một hàm gọi `save.mutateAsync()`, trả `true` khi lưu thành công.
    - Thay mọi `next/link` bằng `GuardedLink`. Thêm rule ESLint `no-restricted-imports` cho `next/link` ở mọi file trừ `unsaved-guard.tsx` để không bị sót.
    - Nút đăng xuất cũng kiểm tra `g.dirty.current` trước khi gọi.
  - **(b) Lưu nháp cục bộ:** localStorage key `nb:draft:<id>`, mỗi lần đổi thì ghi (debounce 500ms) `{ draft, baseVersion, savedAt }`. Lưu thành công hoặc hết dirty thì xóa key.
    - Khi mount, nếu có nháp khác với `base` thì hiện banner "Có bản nháp chưa lưu lúc HH:mm" kèm hai nút [Khôi phục] [Bỏ].
    - Lớp này lo những trường hợp lớp (a) không chặn được: nút Back, iOS kill tab, crash.
    - Nó không xung đột với autosave hay outbox ở GĐ2. Khi đó vẫn có thể chuyển nháp sang IndexedDB.

### 2. Note trong thùng rác nhìn như form bị hỏng (điểm đã biết số 2)
- **Vấn đề:**
  - Các ô chỉ mờ đi (`opacity-50`), không giải thích vì sao.
  - Tiêu đề `readOnly` nhưng nhìn y như đang sửa được.
  - Nút X của tag vẫn hiện.
  - Nút Ghim bị khóa mà không có lý do.
  - CodeMirror chỉ đặt `readOnly`, còn `contenteditable` vẫn bật. Trên điện thoại, chạm vào editor vẫn bật bàn phím ảo nhưng gõ không ra chữ.
- **Chỗ liên quan:** `components/notes/note-form.tsx:68, 214-224, 237-242, 245-267, 269-314, 336-359`; `components/notes/tag-input.tsx:67, 76-84`; `components/editor/codemirror-editor.tsx:43`
- **Cách sửa:** khi `readOnly`, render một view chỉ đọc riêng thay cho form.
  - Đặt `if (readOnly) return <TrashedNoteView …/>` sau khi đã gọi hết các hook.
  - Banner nằm trên cùng: icon `Trash2`, dòng "Note này đang trong thùng rác.", nút **Khôi phục** cỡ thường, variant default (không dùng `outline sm`).
  - Tiêu đề hiển thị bằng `<h1>`.
  - Metadata là một dòng chữ: `Học tập · Inbox · 26/10/2026`, tag dùng `Badge`, không có nút X.
  - Nội dung dùng `<MarkdownPreview>` full-width, không chia đôi, không có editor.
  - Ẩn hẳn Ghim, Lưu và `kbd`.
  - Khôi phục xong thì form hiện lại. Đưa focus vào ô tiêu đề để người dùng biết đã sửa được.
  - Nếu vẫn muốn giữ editor ở đâu đó thì truyền thêm `editable={!readOnly}` cho `<CodeMirror>` (prop của `@uiw`) để bàn phím không bật lên.
  - Không thêm "Xóa vĩnh viễn" ở đây. Việc đó thuộc UI thùng rác của GĐ2.

### 3. Dialog xung đột tràn màn hình điện thoại, nút chọn bản bị đẩy ra ngoài
- **Vấn đề:**
  - Trên màn 390px, hai khung xếp dọc, mỗi khung cao tối đa 40dvh, cộng header và footer có 3 nút xếp dọc là đã cao hơn viewport.
  - `DialogContent` dùng `fixed` + `-translate-y-1/2`, không có `max-h` và không cuộn được. Phần dưới, nơi có "Giữ bản của tôi", bị cắt mất.
  - Xung đột chủ yếu xảy ra khi dùng nhiều thiết bị, tức là đúng lúc đang cầm điện thoại.
- **Chỗ liên quan:** `components/ui/dialog.tsx:53`; `components/notes/conflict-dialog.tsx:20, 59`
- **Cách sửa:**
  - Trong `dialog.tsx`, thêm `max-h-[calc(100dvh-2rem)] overflow-y-auto` vào class của Popup.
  - Trong `conflict-dialog.tsx`, đổi `Side` sang `max-h-[22dvh] md:max-h-[50dvh]` để footer luôn nằm trong màn hình mà không cần cuộn.

### 4. iOS tự phóng to trang khi chạm vào ô có cỡ chữ dưới 16px
- **Vấn đề:** cứ chạm vào select, ô ngày, ô tag hay editor là iOS Safari zoom trang. Layout 390px bị lệch ngang cho tới khi người dùng tự pinch thu nhỏ lại.
- **Chỗ liên quan:** `components/ui/native-select.tsx:10` (`text-sm`); `components/notes/note-form.tsx:312` (ô ngày `text-sm`); `components/notes/tag-input.tsx:98`; `app/globals.css:198` (CodeMirror `0.875rem`). Component `Input` thì đã đúng (`text-base md:text-sm`).
- **Cách sửa:**
  - Đổi cả ba ô trên sang `text-base md:text-sm`.
  - CSS cho CodeMirror:

    ```css
    .markdown-editor .cm-editor { font-size: 1rem; }
    @media (min-width: 768px) { .markdown-editor .cm-editor { font-size: 0.875rem; } }
    ```

  - Không dùng `maximum-scale=1`: nó chặn người dùng tự zoom, vi phạm WCAG 1.4.4.

### 5. Focus ring gần như không nhìn thấy ở cả hai theme
- **Vấn đề:**
  - Theme sáng: `--ring` = oklch(0.708) ở 50% trên nền trắng chỉ khoảng 1.5:1. Viền `border-ring` khoảng 2.6:1.
  - Theme tối: `ring/50` trên #0a0a0a khoảng 1.9:1.
  - Cả hai đều dưới mức 3:1 mà WCAG 1.4.11 yêu cầu, nên 2.4.7 (Focus Visible) trên thực tế cũng không đạt.
  - Một số chỗ chỉ dựa vào outline mặc định với màu `ring/50`: link nav, nút tag trong danh sách, tab Viết/Xem, link quay lại, nút X của tag, nút HealthStatus.
  - Ô tiêu đề và CodeMirror tắt outline mà không có gì thay thế.
- **Chỗ liên quan:** `app/globals.css:69, 104, 122, 200-202`; `components/notes/note-form.tsx:277, 337-342`; `components/app-header.tsx:49`; `components/notes/note-list.tsx:33, 59`; `components/notes/tag-input.tsx:80`; `components/health-status.tsx:32`
- **Cách sửa:**

  ```css
  :root { --ring: oklch(0.45 0 0); }  /* khoảng 7:1 trên nền trắng */
  .dark { --ring: oklch(0.8 0 0); }   /* khoảng 10:1 trên nền tối */
  @layer base {
    * { @apply border-border outline-ring; }  /* bỏ /50 */
    :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
  }
  ```

  - Ô editor (`note-form.tsx:337`): thêm `focus-within:ring-2 focus-within:ring-ring focus-within:ring-inset`.
  - Ô tiêu đề (`note-form.tsx:277`): thêm `focus-visible:underline decoration-ring decoration-2 underline-offset-8`.

### 6. Vùng chạm quá nhỏ, nút xóa nằm sát nút ghim
- **Vấn đề:**
  - Kích thước nút: `icon` 32px, `icon-sm` 28px, `sm` 28px.
  - Trong danh sách, Ghim và Xóa là hai nút 28px xếp dọc, chỉ cách nhau 4px.
  - Nút tag trong danh sách cao khoảng 16–18px.
  - Nút X bỏ tag khoảng 16px, không đạt WCAG 2.2 SC 2.5.8 (tối thiểu 24px).
  - Đổi theme và Đăng xuất nằm sát nhau ở góc trên bên phải. Bấm nhầm đăng xuất trên điện thoại nghĩa là phải gõ lại mật khẩu từ 10 ký tự.
- **Chỗ liên quan:** `components/ui/button.tsx:22-32`; `components/notes/note-list.tsx:55-63, 67-92`; `components/notes/tag-input.tsx:76-84`; `components/notes/note-form.tsx:196-202, 320-332`; `components/app-header.tsx:45-57, 67-77`
- **Cách sửa:** Tailwind 4.3 có sẵn variant `pointer-coarse:`, chỉ áp dụng cho màn cảm ứng.
  - Trong `button.tsx`:
    - `default`: thêm `pointer-coarse:h-11`
    - `sm`: thêm `pointer-coarse:h-10`
    - `icon`: thêm `pointer-coarse:size-11`
    - `icon-sm`: thêm `pointer-coarse:size-10`
  - Nút tag trong danh sách: `pointer-coarse:px-2 pointer-coarse:py-1.5`.
  - Nút X của tag: đổi sang `p-1.5 -my-1` để đạt tối thiểu 24px.
  - Cột hành động trong danh sách: đổi `gap-1` thành `gap-2`.
  - Link nav và link quay lại: thêm `pointer-coarse:py-2`.
  - Chuyển Đăng xuất xuống footer, cạnh HealthStatus. Với một người dùng có cookie một năm thì đây là thao tác hiếm khi cần.

---

## B. Nên sửa

### 7. Lưu note mới làm form mount lại từ đầu
- **Vấn đề:** `router.replace` sang `/notes/[id]` làm form mount lại. Mất focus, mất vị trí con trỏ, bàn phím ảo đóng. Nhấn Ctrl+S rồi gõ tiếp thì chữ không vào đâu cả.
- **Chỗ liên quan:** `components/notes/note-form.tsx:80`; `app/(app)/notes/[id]/note-detail.tsx:37`
- **Cách sửa:** thay bằng `window.history.replaceState(null, '', \`/notes/${note.id}\`)`. Next từ 14.1 tự đồng bộ `usePathname` với lệnh này. Form vẫn mounted, `base` đã có, nên các lần lưu sau sẽ là PATCH. Sau khi đổi, thử tải lại trang để chắc `/notes/[id]` vẫn mở đúng.

### 8. Viết dài trên điện thoại thì nút Lưu trôi khỏi màn hình (không có Ctrl+S)
- **Vấn đề:** trên mobile, editor cao dần theo nội dung và cả trang cuộn. Hàng metadata chiếm 2–3 dòng ở 390px, đẩy editor xuống thấp.
- **Chỗ liên quan:** `components/notes/note-form.tsx:195, 280-315, 336-341`
- **Cách sửa:**
  - Cho thanh công cụ dính dưới header: `sticky top-12 z-30 -mx-3 border-b bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4`.
  - Trong `app/layout.tsx`, thêm `export const viewport: Viewport = { interactiveWidget: 'resizes-content' }` để Chrome Android co layout lại khi bàn phím mở.
  - Trên mobile, gom metadata thành một nút tóm tắt "Học tập · Inbox · 26/10 · 2 tag". Bấm thì mở ra, còn từ `md:` trở lên luôn mở.

### 9. Nút ghim/xóa bị ẩn theo breakpoint `sm:` chứ không theo khả năng hover
- **Vấn đề:** trên iPad hay tablet rộng từ 640px, hai nút này vô hình (`opacity-0`) nhưng chạm vào vẫn kích hoạt.
- **Chỗ liên quan:** `components/notes/note-list.tsx:77-78, 89`
- **Cách sửa:** đổi `sm:opacity-0` thành `pointer-fine:opacity-0`. Thêm `group-focus-within:opacity-100` để người dùng bàn phím đang focus vào tiêu đề cũng thấy nút.

### 10. Xóa trong danh sách làm mất vị trí focus bàn phím
- **Vấn đề:** dòng bị gỡ ngay (optimistic) nên focus rơi về `body`.
- **Chỗ liên quan:** `components/notes/note-list.tsx:86`
- **Cách sửa:** trước khi gọi `del.mutate`, tìm sẵn đích focus. Ưu tiên link của dòng kế tiếp, không có thì dòng trước, không có nữa thì `h1`. Sau đó gọi `requestAnimationFrame(() => target?.focus())`.

### 11. Lưu lỗi chỉ báo bằng toast tự tắt
- **Vấn đề:** khi server ở nhà tắt (tình huống PROJECT.md đã tính trước), lỗi chỉ hiện trong toast khoảng 4 giây. Sau đó trạng thái vẫn ghi "Chưa lưu", không có lỗi nào nằm lại trên màn hình. Toast "Đã lưu" mỗi lần lưu lại trùng với dòng trạng thái.
- **Chỗ liên quan:** `components/notes/note-form.tsx:79, 95, 185-191`
- **Cách sửa:**
  - Khi `save.isError`, dòng trạng thái hiện "Lưu lỗi: {message}" màu `text-destructive`, kèm nút "Thử lại".
  - Bỏ `toast.success` khi lưu thường, chỉ giữ toast cho khôi phục.

### 12. Tab Viết/Xem khai báo `role="tab"` nhưng thiếu phần còn lại của pattern
- **Vấn đề:** không có `aria-controls`, không có `tabpanel`, không xử lý phím mũi tên. Khung preview có `aria-label` nhưng không có role nên nhãn bị bỏ qua.
- **Chỗ liên quan:** `components/notes/note-form.tsx:318-334, 350-356`
- **Cách sửa:** cách gọn nhất là bỏ `tablist`/`tab`, dùng hai nút có `aria-pressed` (kiểu segmented control). Khung preview thêm `role="region"`.

### 13. Nhấn Ctrl+S khi dialog xung đột đang mở sẽ PATCH lại bằng version cũ và lại nhận 409
- **Chỗ liên quan:** `components/notes/note-form.tsx:147-149`
- **Cách sửa:** `if (canSave && !conflict && !trashedOnSave) save.mutate();`

### 14. `color-scheme` không đổi theo theme
- **Vấn đề:** ở theme tối, thanh cuộn, popup của select, date picker và autofill vẫn hiện màu sáng. Hiện đang vá từng chỗ riêng lẻ.
- **Chỗ liên quan:** `app/globals.css:51, 86`; `components/ui/native-select.tsx:10`; `components/notes/note-form.tsx:312`
- **Cách sửa:** thêm `color-scheme: light` vào `:root` và `color-scheme: dark` vào `.dark`. Sau đó bỏ `[&>option]:bg-popover…` và `dark:[color-scheme:dark]`.

### 15. Một số chỗ thiếu contrast ở theme sáng
- **"Chưa lưu":** `amber-600` trên nền trắng khoảng 3.2:1, chữ 12px nên không đạt. Đổi sang `text-amber-700 dark:text-amber-400` (khoảng 5:1).
  - Chỗ sửa: `components/notes/note-form.tsx:207`
- **Icon ghim:** `amber-500` khoảng 2.1:1. Đổi sang `text-amber-600 dark:text-amber-400` để đạt 3:1 cho hình đồ họa.
  - Chỗ sửa: `components/notes/note-list.tsx:37, 81` và `components/notes/note-form.tsx:223`
- **Placeholder tiêu đề:** `muted-foreground/60` chỉ khoảng 2.3:1, trong khi đây là nhãn nhìn thấy duy nhất của ô. Bỏ `/60`.
  - Chỗ sửa: `components/notes/note-form.tsx:277`

### 16. Ô nhập tag chưa hợp với bàn phím ảo
- **Vấn đề:**
  - Gboard trên Android gửi `key: "Unidentified"`, nên gõ dấu phẩy không tách tag.
  - Chọn một gợi ý từ datalist chỉ điền chữ vào ô, chưa thêm tag.
  - Gõ dở một tag rồi nhấn Ctrl+S thì tag đó không được lưu. Nếu không còn thay đổi nào khác, nút Lưu không làm gì cả.
- **Chỗ liên quan:** `components/notes/tag-input.tsx:53-60, 87-99`
- **Cách sửa:**
  - Trong `onChange`: nếu chuỗi chứa `,`, hoặc `nativeEvent.inputType` là `'insertReplacementText'`/`undefined` (tức vừa chọn từ datalist), thì gọi `add()` ngay.
  - Thêm `enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false}`.
  - Coi chữ tag đang gõ dở là dirty, và thêm nó vào trước khi lưu.

### 17. Nhãn và heading
- `components/ui/dialog.tsx:65`: chữ "Close" là tiếng Anh, đổi thành "Đóng".
- `app/(app)/notes/notes-view.tsx:64` dùng `h1`, còn `components/notes/note-list.tsx:35` nhảy thẳng xuống `h3`. Đổi thành `h2`.
- `components/notes/note-list.tsx:74, 87`: khi tiêu đề rỗng, `aria-label` thành "Ghim " hoặc "Xóa ". Thêm chữ dự phòng "Không có tiêu đề".
- `components/notes/note-list.tsx:37`: icon ghim nằm trong link. Đổi `aria-label` trên svg thành `<span className="sr-only">Đã ghim, </span>` và đặt `aria-hidden` cho icon.

### 18. Phân trang
- **Vấn đề:** dùng `replace` kèm `scroll:false`. Bấm "Sau" ở cuối danh sách thì sang trang mới vẫn đứng ở cuối trang. Nút Back cũng không quay về trang trước.
- **Chỗ liên quan:** `app/(app)/notes/notes-view.tsx:55, 154, 165`
- **Cách sửa:** khi đổi trang thì dùng `router.push(url)` và để cuộn lên đầu như mặc định.

---

## C. Tùy chọn

19. **Nhấn Enter hoặc mũi tên xuống ở ô tiêu đề thì chuyển xuống editor.** Lấy `EditorView` qua `onCreateEditor` của `@uiw` rồi gọi `view.focus()`. Có ích cho luồng ghi nhanh.
    - Chỗ sửa: `components/notes/note-form.tsx:269-278`, `components/editor/codemirror-editor.tsx`
20. **Bỏ con số đặt tay trong chiều cao editor trên desktop.** `md:h-[calc(100dvh-17rem)]` bị lệch khi có banner hoặc khi tag xuống dòng. Nên dựng trang thành `flex flex-col`, cho editor `flex-1 min-h-0`.
    - Chỗ sửa: `components/notes/note-form.tsx:336`
21. **Trang đăng nhập.**
    - Sai mật khẩu thì ô bị xóa và nút bị khóa. Nếu người dùng vừa bấm chuột vào nút thì focus rơi mất, nên cần focus lại ô mật khẩu trong `onError`.
    - Thêm nút "Hiện mật khẩu" và `enterKeyHint="go"`.
    - Chỗ sửa: `app/(auth)/login/login-form.tsx:48, 62-73`
22. **Nhãn của nút đổi theme nên nói rõ trạng thái sẽ chuyển tới**, ví dụ "Chuyển sang giao diện sáng" (đọc `resolvedTheme` sau khi đã mount).
    - Chỗ sửa: `components/theme-toggle.tsx:15`
23. **Typography.**
    - Inter là mặc định của shadcn. Nếu muốn có cá tính hơn mà vẫn hỗ trợ tiếng Việt, có thể dùng Be Vietnam Pro, font thiết kế riêng cho tiếng Việt.
    - `--font-mono` được dùng ở `app/globals.css:204` nhưng không được định nghĩa ở đâu, nên editor đang dùng font mono của hệ thống, chữ có dấu hiển thị không đều.
    - Nên nạp một font mono qua `next/font` có subset `vietnamese` (kiểm tra subset trước khi chọn).
24. **Đặt `document.title` theo tiêu đề note** để phân biệt tab và lịch sử trình duyệt. Hiện mọi note đều là "Note · Notebook".
    - Chỗ sửa: `app/(app)/notes/[id]/page.tsx:4`
25. **Trạng thái rỗng khi đang lọc nên có nút "Bỏ lọc" ngay bên trong.** Trạng thái đang tải có thể dùng skeleton 3 dòng thay cho chữ "Đang tải…".
    - Chỗ sửa: `app/(app)/notes/notes-view.tsx:129-141`
26. **Xóa trống ô ngày thì trên màn hình rỗng nhưng state vẫn giữ ngày cũ.** Nên reset về giá trị trong state khi blur.
    - Chỗ sửa: `components/notes/note-form.tsx:311`
27. **Trang Tag: bấm Hủy hoặc Esc khi đổi tên thì focus bị mất.** Nên trả focus về nút bút chì.
    - Chỗ sửa: `app/(app)/tags/tags-view.tsx:226, 235`

---

**Ảnh hưởng tới các giai đoạn sau:** không có chỗ nào chặn GĐ2. Chỉ cần lưu ý ở mục 1:
- Guard điều hướng cần có `guardedPush()` cho Ctrl+K.
- Cơ chế nháp cục bộ nên thiết kế để sau này dễ chuyển sang IndexedDB, dùng chung với outbox.

**Nếu chỉ kịp sửa một việc:** làm mục 1, cả hai lớp (a) và (b). Đây là lỗi duy nhất làm mất dữ liệu người dùng, và trên điện thoại hiện chưa có lớp bảo vệ nào.
