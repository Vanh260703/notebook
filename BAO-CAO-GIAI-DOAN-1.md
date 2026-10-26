# Báo cáo Giai đoạn 1: Lõi

Ngày 2026-10-26. File này chỉ để bạn đọc, đọc xong thì xóa.

**Kết quả:** đạt tiêu chí "Xong khi" của Giai đoạn 1. Đã chạy thật trên trình duyệt (Chrome headless): đăng nhập được, viết/sửa/xóa được note có tag, editor Markdown thô (CodeMirror 6) kèm preview. `pnpm -r lint`, `pnpm -r test`, `pnpm -r build` và e2e với Postgres thật đều qua.

---

## 1. Quy trình đã chạy

1. Đọc CLAUDE.md, `docs/phase1-design.md`, PROJECT.md, báo cáo GĐ0 và code hiện có. Đối chiếu thiết kế với thư viện thật trong `node_modules` (nestjs-zod 5.5, zod 4.6.7, TypeORM 1.1.2, Next 16.4.3, rehype-highlight 7).
2. **packages/shared:** thêm zod schema và type theo mục 2 của thiết kế.
3. **API:** auth, notes, tags, filter lỗi, migration đổi default sang INBOX. Viết unit test và e2e với Postgres thật.
4. **Web:** login, danh sách, note mới, sửa note, tag, `proxy.ts`.
5. **Giữa chừng có đổi yêu cầu:** `APP_PASSWORD` chỉ cần từ **10** ký tự, không phải 20 (xem mục 4).
6. **Kiểm chứng:** lint, test, build, `migration:check`, build thử image Docker, rồi chạy thử bằng trình duyệt thật (Playwright + Chrome của máy). API chạy ở port 3101, web ở 3100, nên không đụng container đang chạy.

## 2. Những gì đã làm

### packages/shared

| File | Nội dung |
|---|---|
| `note.ts` | Hằng (`NOTE_DEFAULT_STATUS = 'INBOX'`, giới hạn độ dài...), `createNoteSchema`, `updateNoteSchema`, `listNotesQuerySchema`, `noteSchema`, `noteListItemSchema`, `noteListResponseSchema` và các type |
| `tag.ts` | `tagSchema`, `tagWithCountSchema`, `tagListResponseSchema`, `renameTagSchema` |
| `auth.ts` (mới) | `loginSchema`, `sessionSchema` |
| `error.ts` (mới) | `ERROR_CODES`, `apiErrorSchema`, `versionConflictErrorSchema`, `tagNameTakenErrorSchema` |
| `note.test.ts`, `auth.test.ts` (mới) | Test schema theo mục 7 của thiết kế |

### apps/api

```
src/
├── main.ts                 # NestExpressApplication + configureApp
├── app.setup.ts            # MỚI: body JSON 1 MB, Cache-Control: no-store, tắt x-powered-by, shutdown hooks
├── app.module.ts           # + AuthModule, NotesModule, TagsModule, APP_FILTER
├── common/
│   ├── config/auth-env.ts  # parseAuthEnv, AUTH_CONFIG (+ spec)
│   ├── decorators/public.decorator.ts
│   ├── filters/api-exception.filter.ts (+ spec)
│   └── http/read-cookie.ts (+ spec)
├── modules/
│   ├── auth/   auth.module, auth.controller, auth.service, session.service, session.guard (APP_GUARD),
│   │           login-rate-limiter, auth.dto (+ 3 spec)
│   ├── notes/  notes.module, notes.controller, notes.service, note.mapper, notes.dto, note.entity (sửa default)
│   ├── tags/   tags.module, tags.controller, tags.service, tags.dto
│   └── health/ health.controller (+ @Public())
└── database/migrations/1793009652201-NoteStatusDefaultInbox.ts
test/db/                    # MỚI: e2e với Postgres thật
├── setup-env.ts  constants.ts  helpers.ts
└── auth.e2e-spec.ts  notes.e2e-spec.ts  tags.e2e-spec.ts
jest.config.js              # bỏ qua test/db
jest.e2e.config.js          # MỚI; script test:e2e (chạy --runInBand)
```

**API đã có đủ theo mục 3 của thiết kế:**
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- `GET/POST /notes`, `GET/PATCH/DELETE /notes/:id`, `POST /notes/:id/restore`, `DELETE /notes/:id/permanent`.
- `GET /tags`, `PATCH /tags/:id` (có gộp tag), `DELETE /tags/:id`.

**Migration `NoteStatusDefaultInbox`:**
- File sinh ra chỉ có `ALTER COLUMN "status" SET DEFAULT 'INBOX'`, `down()` trả về `'ACTIVE'`. Không có dòng thừa.
- Đã chạy `run`, `check` ("No changes..."), `revert` rồi `run` lại trên DB dev.

### apps/web

```
proxy.ts                         # thiếu cookie nb_session thì về /login?next=...; matcher loại api, _next, login, file tĩnh
app/page.tsx                     # redirect('/notes')
app/providers.tsx                # + Toaster (sonner); không retry query khi lỗi 4xx
app/globals.css                  # + @tailwindcss/typography, màu highlight code cho sáng/tối, style CodeMirror
app/(auth)/login/                # page.tsx, login-form.tsx
app/(app)/layout.tsx             # header + footer (HealthStatus thu gọn ở footer)
app/(app)/notes/                 # page.tsx + notes-view.tsx (lọc type/status/tag qua URL, phân trang)
app/(app)/notes/new/             # page.tsx, new-note.tsx (dynamic ssr:false), new-note-form.tsx
app/(app)/notes/[id]/            # page.tsx, note-detail.tsx
app/(app)/tags/                  # page.tsx, tags-view.tsx (đổi tên, gộp khi trùng, xóa)
components/app-header.tsx        # nav, Note mới, đổi sáng/tối, đăng xuất
components/editor/               # markdown-editor (dynamic), codemirror-editor, markdown-preview
components/notes/                # note-form, note-list, tag-input, conflict-dialog, use-note-actions
components/ui/                   # + dialog, input, badge, sonner (shadcn), native-select
components/health-status.tsx     # thu gọn thành một dòng ở footer
lib/api/{client,auth,notes,tags,health}.ts   # lib/api.ts cũ chuyển thành lib/api/health.ts
lib/{query-keys,date,uuid,markdown,note-draft,labels,clipboard}.ts
lib/{date,uuid,markdown,note-draft}.test.ts  # vitest; package.json có thêm script "test"
```

**Dependency mới của web:** `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `sonner`. Dev: `@tailwindcss/typography`, `vitest`. API không thêm dependency nào.

**Giao diện:**
- Có chế độ sáng/tối ở mọi trang mới. CodeMirror, preview và màu highlight code đều đổi theo.
- Desktop: editor chia đôi Viết | Xem. Mobile: dùng tab.
- Lưu bằng nút Lưu hoặc `Ctrl/Cmd+S`. Có dấu "Chưa lưu" và cảnh báo `beforeunload`.
- Gặp 409: dialog hiện hai bản cạnh nhau, với ba nút Giữ bản của tôi / Dùng bản trên server / Sao chép.
- Gặp 404 `NOTE_IN_TRASH`: dialog "Khôi phục rồi lưu".
- Note trong thùng rác: hiện banner, chỉ cho đọc, có nút Khôi phục.
- Danh sách: ghim và xóa cập nhật ngay trên UI (optimistic). Xóa có toast "Hoàn tác".

### Cấu hình

| File | Thay đổi |
|---|---|
| `apps/api/.env.example` | `APP_PASSWORD=change-me-at-least-10-chars`, ghi chú `SESSION_SECRET`, thêm `COOKIE_SECURE=true` và `TEST_DATABASE_URL` |
| `.env.example` (gốc) | Sửa ghi chú mật khẩu (10 ký tự), giá trị mẫu mới, thêm `COOKIE_SECURE` (để comment) |
| `apps/api/.env` (local, không commit) | Thêm `TEST_DATABASE_URL=.../notebook_test`. **Không đổi** `APP_PASSWORD`/`SESSION_SECRET` sẵn có (32 và 64 ký tự, hợp lệ) |
| `docker-compose.yml` | `COOKIE_SECURE: ${COOKIE_SECURE:-true}` |
| `.github/workflows/ci.yml` | Thêm `TEST_DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` giả cho CI, và bước `pnpm --filter api test:e2e` |
| `.prettierignore` | Thêm `BAO-CAO-*.md` và `docs` |
| `README.md` | Thêm mục Đăng nhập và Test e2e |

## 3. Kết quả kiểm chứng

✅ là đã chạy thật trên máy này.

| Bước | Kết quả |
|---|---|
| `pnpm -r lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm -r test` | ✅ **69 test**: shared 23/23, api 36/36 (8 suite, có test `/health` mock DB cũ), web 10/10 |
| `pnpm --filter api test:e2e` (Postgres thật, DB `notebook_test`) | ✅ **35/35** (3 suite). Đã chạy 3 lần liên tiếp, đều qua, kể cả test hai PATCH song song |
| `pnpm -r build` | ✅ shared, api, web (Next build, TypeScript qua) |
| `pnpm format:check` | ✅ |
| `migration:run` / `check` / `revert` / `run` | ✅ "No changes in database schema were found" |
| Build image Docker API | ✅ Build thử với tag riêng rồi xóa. Không đụng container đang chạy |
| API chạy trên host, thiếu hoặc sai env auth | ✅ Dừng ngay với lỗi "Cấu hình auth không hợp lệ", không in giá trị |
| Chạy thử trên trình duyệt (Chrome headless) | ✅ Xem chi tiết bên dưới |

**Các ca e2e đã có** (theo mục 7 của thiết kế):
- 401 khi không có cookie, `/health` vẫn public. Mọi response đều có `Cache-Control: no-store`.
- Sai mật khẩu 5 lần đều 401, lần 6 là 429 kèm `Retry-After`. Mật khẩu đúng trong lúc bị khóa vẫn 429.
- Cookie có `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=31536000`, không có `Domain`. Với `COOKIE_SECURE=true` thì có `Secure`.
- POST: lần đầu 201, gửi lại cùng id là 200 và không ghi đè. Mặc định INBOX. `["Docker","docker "]` thành một tag.
- PATCH: version +1 (kể cả khi chỉ đổi tag hay ghim). Version cũ trả 409 với `current` parse được bằng schema. **Hai PATCH song song: đúng một 200 và một 409.** PATCH note đã xóa trả `NOTE_IN_TRASH`.
- DELETE, restore, permanent (409 `NOTE_NOT_IN_TRASH`), `trashed=true`.
- Lọc theo type/status/tag/date, phân trang, thứ tự (ghim trước), excerpt 300 ký tự.
- Tags: không đếm note đã xóa, đổi tên, 409 `TAG_NAME_TAKEN` rồi `merge`, xóa tag (CASCADE), ba note cùng tạo một tag mới song song không bị trùng tag.
- `:id` sai trả 400. **Body trên 1 MB trả 413** với `code: PAYLOAD_TOO_LARGE` (note khoảng 450 kB vẫn qua). JSON hỏng trả 400. `q=x` trả 501.

**Chạy thử trên trình duyệt** (script Playwright để ngoài repo, không commit):
- Vào `/notes` khi chưa đăng nhập thì về `/login?next=%2Fnotes`. Sai mật khẩu hiện thông báo. Đúng thì vào danh sách, cookie `Path=/`, HttpOnly, hạn 365 ngày.
- Tạo note: gõ Markdown trong CodeMirror, thêm tag, `Ctrl+S` thì URL đổi sang `/notes/<id>`. Preview có heading, checklist và code được highlight.
- Có xung đột thì dialog hiện ra. "Giữ bản của tôi" và "Dùng bản trên server" đều chạy đúng.
- Note bị xóa ở nơi khác: "Khôi phục rồi lưu" chạy đúng. Note trong thùng rác chỉ đọc được và khôi phục được.
- Ghim, xóa rồi Hoàn tác, lọc theo tag. Trang Tag: đổi tên trùng thì hỏi gộp, gộp xong đúng.
- Đăng xuất xóa cookie, vào lại `/notes` thì bị chuyển về login.
- Đã xem ảnh chụp ở chế độ sáng, tối và mobile (390 px).
- XSS: `<script>` và link `javascript:` trong note không được render ra.
- Dữ liệu thử đã xóa sạch, DB dev lại rỗng.

## 4. Chỗ lệch khỏi `docs/phase1-design.md` và lý do

1. **`APP_PASSWORD` từ 10 ký tự (đổi yêu cầu giữa chừng).** Đã dùng `z.string().min(10, 'APP_PASSWORD phải từ 10 ký tự')`, giá trị mẫu `change-me-at-least-10-chars`. Test có ca dưới 10 ký tự và ca đúng 10 ký tự. `SESSION_SECRET` vẫn `min(32)`. Bạn đã sửa sẵn thiết kế và PROJECT.md. README và `.env.example` gốc cũng đã sửa theo.
2. **Tên entity giữ là `Note`/`Tag`, không đổi thành `NoteEntity`.** Tránh đổi file GĐ0. Trong service, type của shared được import dạng `Note as NoteDto`.
3. **Type `ApiError` trong shared đổi tên thành `ApiErrorBody`.** Tên cũ trùng với class `ApiError` của web.
4. **`ListNotesQuery` không dùng thẳng `z.input<>`.** Với `z.coerce.number()` và `z.stringbool()`, kiểu input là `unknown`/`string`, nên web không gán `page: number` được. Type giờ ghi rõ `page?: number; limit?: number; trashed?: boolean`. Có thêm type output `CreateNoteData`, `UpdateNoteData`, `ListNotesParams`.
5. **Xóa mềm chỉ chạy khi `deletedAt IS NULL`.** Xóa lại vẫn trả 204 nhưng không đóng dấu lại `deletedAt`. Restore và permanent cũng dùng UPDATE/DELETE có điều kiện, rồi mới tra để phân biệt 404 hay 409, thay vì tìm trước rồi mới làm (tránh race).
6. **Có thêm `src/app.setup.ts` (`configureApp`).** main.ts và e2e dùng chung nó, nhờ vậy test kiểm tra đúng giới hạn 1 MB, `no-store`, `x-powered-by`.
7. **Lỗi của body-parser có đi qua filter của Nest.** Đã kiểm tra thật: 413 và JSON hỏng đều trả đúng dạng `ApiError`. Filter có thêm nhánh xử lý riêng cho hai lỗi này, và map thêm 409 sang `CONFLICT`, 501 sang `NOT_IMPLEMENTED`.
8. **`readCookie` bọc `decodeURIComponent` trong try/catch.** Bản trong thiết kế sẽ throw `URIError` (thành 500) khi gặp cookie mã hóa hỏng.
9. **Một số chỗ chắc chắn hơn:**
   - `rename` tag khóa dòng tag nguồn (`FOR UPDATE`).
   - `replaceNoteTags` sắp tên tag trước khi INSERT, để hai transaction không deadlock.
   - `retryAfter` tối thiểu 1 giây.
10. **e2e:**
    - **Không dùng `process.loadEnvFile` trong setup.** Jest cấp cho mỗi file test một bản sao `process.env`, nên chỉ file test đầu tiên nhận được biến (đã gặp lỗi thật). Chuyển sang `util.parseEnv`.
    - **e2e đặt `COOKIE_SECURE=false`.** `supertest.agent` không gửi cookie `Secure` qua http. Thuộc tính `Secure` được test riêng bằng app override `AUTH_CONFIG`.
    - **Test e2e nằm trong `test/db/`.** Config unit bỏ qua thư mục này.
11. **CI:** e2e dùng chung DB `notebook` của service postgres (nhờ `CI=true`), chạy sau `migration:check`.
12. **Web:**
    - `lib/api.ts` chuyển thành `lib/api/health.ts`, vì trùng tên với thư mục `lib/api/`.
    - Editor tách làm hai file: `markdown-editor.tsx` (`dynamic`, `ssr:false`) và `codemirror-editor.tsx`.
    - **Trang Note mới không prerender** (`ssr:false`). Nếu prerender lúc build thì `entryDate` thành ngày build và lệch hydration.
    - Dùng `<select>` gốc (`native-select.tsx`) thay cho shadcn Select: gọn hơn và tốt trên mobile.
    - Có thêm `lib/note-draft.ts`: so sánh và diff đã chuẩn hóa giống zod, để title có khoảng trắng thừa không bị coi là "chưa lưu".
    - `apiFetch`: lỗi mạng thành `ApiError` với `status 0`, `code: 'NETWORK'` (chỉ dùng phía client).
13. **Web có test vitest** (thiết kế ghi là tùy chọn): `localDate` với `TZ=Asia/Ho_Chi_Minh` lúc 06:00, UUID fallback, `stripMarkdown`, `diffDraft`.
14. **`.prettierignore` thêm `BAO-CAO-*.md` và `docs`.** `format:check` (có trong CI) đang báo lỗi ở `BAO-CAO-GIAI-DOAN-0.md` và `docs/phase1-design.md`. Hai file này là tài liệu bạn tự quản lý, giống PROJECT.md.

## 5. Việc bạn cần làm

- [ ] **Build lại container API:** `docker compose up -d --build`.
  - Container `notebook-api-1` đang chạy code GĐ0 (chưa có auth), nên `next dev` ở :3000 hiện chưa đăng nhập được.
  - `.env` gốc đã có đủ `APP_PASSWORD` và `SESSION_SECRET` hợp lệ. Compose tự truyền `COOKIE_SECURE` (mặc định `true`).
- [ ] **Mật khẩu đăng nhập:** `APP_PASSWORD` hiện là chuỗi hex ngẫu nhiên 32 ký tự từ GĐ0. Xem trong `.env`, hoặc đổi sang mật khẩu dễ nhớ hơn (từ 10 ký tự). Đổi ở **cả** `.env` gốc lẫn `apps/api/.env`, rồi restart API.
- [ ] **Restart `pnpm --filter web dev`.** Có thêm `proxy.ts` và dependency mới.
- [ ] **Safari hoặc điện thoại qua IP LAN khi dev:** đặt `COOKIE_SECURE=false` (trong `.env` gốc nếu API chạy bằng Docker). Không đặt trên server.
- [ ] **Migration đã chạy sẵn trên DB dev** (`NoteStatusDefaultInbox`). Container mới sẽ thấy là đã chạy, không cần làm gì thêm.
- [ ] **DB `notebook_test` đã được tạo** trong container postgres, và `TEST_DATABASE_URL` đã thêm vào `apps/api/.env`. Chạy e2e: `pnpm --filter api test:e2e`.
- [ ] **Theo quy trình ở CLAUDE.md:** nhờ `ui-ux-designer` review giao diện vừa làm.

## 6. Việc còn dở / lưu ý

- **Chưa chặn điều hướng trong app khi còn thay đổi chưa lưu.** Chỉ có `beforeunload` (đóng tab, tải lại trang). Bấm link trong app thì mất thay đổi chưa lưu. Next không có API chặn sẵn; nên làm cùng autosave ở GĐ2.
- **Ghim trong editor là một trường của form,** phải bấm Lưu mới ghi. Ghim trong danh sách thì ghi ngay.
- **Đổi tên tag lúc đang mở editor note:** web đã invalidate note, nhưng form đang mở vẫn giữ tên tag cũ. Lưu note đó sẽ tạo lại tag cũ (rủi ro 17, mức nhẹ).
- **Note trong thùng rác (chỉ đọc):** nút bỏ tag và ô ngày đã bị vô hiệu hóa nhưng nhìn chưa thật rõ là đang khóa. Để `ui-ux-designer` xem.
- **Chưa làm (đúng phạm vi GĐ1):** tìm kiếm (`q` trả 501), UI thùng rác, trang Hôm nay, outbox, tự gia hạn cookie.
- **`apps/web/AGENTS.md`** vẫn còn (việc mở từ GĐ0).

---

## Sửa theo review UI

Theo `docs/phase1-ui-review.md`. Đã làm toàn bộ nhóm **A (mục 1–6)** và nhóm **B (mục 7–18)**. **Không làm nhóm C (mục 19–27).** Không đổi API backend hay schema DB.

### Từng mục

| # | Đã sửa | Làm khác gợi ý / ghi chú |
|---|---|---|
| 1a | Guard điều hướng: `GuardedLink` (dùng `onNavigate` của Next 16.4.3), dialog **Lưu rồi đi / Bỏ thay đổi / Ở lại** (focus mặc định và Esc là "Ở lại"), `useGuardedRouter().push/replace` cho Ctrl+K ở GĐ2, nút Đăng xuất cũng qua guard. Mọi `next/link` đã đổi sang `GuardedLink`; ESLint `no-restricted-imports` chặn `next/link` ngoài `components/unsaved-guard.tsx` | Logic tách ra `lib/navigation-guard.ts` (không phụ thuộc React, có test). Provider đọc state qua `useSyncExternalStore` thay vì `MutableRefObject` trong context. Form đăng ký `{ isDirty, save, discard }`. **"Bỏ thay đổi" còn đưa form về bản đã lưu và xóa nháp**: nếu không, bấm "Note mới" khi đang ở `/notes/new` (cùng route, Next không mount lại) thì nội dung vẫn còn. Lưu lỗi hoặc 409 thì ở lại trang, form hiện lỗi hoặc dialog xung đột. Rule ESLint tắt bằng override trong `eslint.config.mjs`, không dùng comment disable |
| 1b | Nháp localStorage `nb:draft:<id>` dạng `{ noteId, draft, baseVersion, savedAt }`. Ghi sau 500 ms, **ghi ngay khi tab bị ẩn (`visibilitychange`), khi `pagehide` và khi unmount** (iOS kill tab ở nền). Lưu xong hoặc hết thay đổi thì xóa. Banner "Có bản nháp chưa lưu lúc …" có [Khôi phục] [Bỏ]. Mọi truy cập storage bọc try/catch (kể cả đọc `window.localStorage`), dữ liệu hỏng thì coi như không có | **Note mới dùng một ô riêng `nb:draft:new`**: mỗi lần mở `/notes/new` là một id mới, nên key theo id sẽ không bao giờ tìm lại được sau khi tải lại. Khôi phục thì **dùng lại id cũ**, POST idempotent nên không tạo note trùng. **Nháp viết trên version cũ hơn bản trên server**: banner ghi rõ, bấm Khôi phục thì mở dialog xung đột để chọn bản, không ghi đè im lặng. Storage tách thành interface `DraftStorage`, GĐ2 có thể thay bằng IndexedDB |
| 2 | Note trong thùng rác hiện view chỉ đọc riêng (`TrashedNoteView`): banner có icon `Trash2` và nút **Khôi phục** (variant default), tiêu đề `<h1>`, dòng metadata, tag dạng `Badge`, `MarkdownPreview` full-width. Không có Ghim, Lưu, kbd, nút X hay editor. Khôi phục xong form hiện lại và focus vào tiêu đề | Thêm `editable={!readOnly}` cho CodeMirror để phòng sau này có chỗ dùng editor chỉ đọc |
| 3 | `DialogContent`: `max-h-[calc(100dvh-2rem)] overflow-y-auto`. Khung so sánh trong dialog xung đột: `max-h-[22dvh] md:max-h-[50dvh]` | Đã đo ở 390×844: ba nút đều nằm trong màn hình |
| 4 | `NativeSelect`, ô ngày, ô tag dùng `text-base md:text-sm`. CodeMirror 1rem, từ 768px trở lên là 0.875rem. Không dùng `maximum-scale` | |
| 5 | `--ring` đổi thành 0.45 (sáng) và 0.8 (tối). `outline-ring` bỏ `/50`. Thêm `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }`. Khung editor có `focus-within:ring-2 ring-ring ring-inset` | **Button và Badge bỏ `outline-none` + `ring-ring/50`** để dùng outline chung. **Input, select, ô ngày, ô tag** vẫn giữ `outline-none` nhưng ring đổi thành `ring-1 ring-ring` cùng `border-ring` (viền đặc 2px, tương phản khoảng 7:1). **Ô tiêu đề dùng `border-b-2` đổi màu khi focus thay cho `underline`**, vì `text-decoration` không hiện gì khi ô còn trống |
| 6 | `pointer-coarse:` cho Button: `default` h-11, `sm` h-10, `icon` size-11, `icon-sm` size-10. Nút tag trong danh sách `pointer-coarse:px-2 py-1.5`. Nút X bỏ tag `p-1.5 -my-1` (24px). Cột hành động `gap-2`. Link nav, logo và link quay lại `pointer-coarse:py-2`. **Đăng xuất chuyển xuống footer** (`components/logout-button.tsx`), cạnh HealthStatus | Thêm `pointer-coarse:h-10` cho select, ô ngày và khung ô tag để cùng hàng với nút. Nút Đăng xuất ở footer có chữ (variant ghost, size sm), không chỉ là icon |
| 7 | Lưu note mới dùng `window.history.replaceState` sang `/notes/<id>`. Form không mount lại: focus, con trỏ và bàn phím ảo giữ nguyên, các lần lưu sau là PATCH | **Gợi ý gốc chưa đủ.** Next giữ cây route `/notes/new` cho entry đó (đã đọc `app-router.js` và `restore-reducer.js`), nên đã gặp hai lỗi thật. (1) Bấm "Note mới" ngay sau khi lưu: không ra form trống. (2) Back/Forward về entry đó: hiện form trống ở URL `/notes/<id>`. `NewNoteForm` xử lý cả hai: mở phiên mới khi URL quay về `/notes/new`; URL không phải note vừa tạo trong phiên thì `router.replace` tới đúng trang. Tải lại `/notes/<id>` vẫn mở đúng note |
| 8 | Thanh công cụ dính dưới header (`sticky top-12 …`). `viewport.interactiveWidget = 'resizes-content'`. Trên mobile, metadata gom thành nút tóm tắt "Học tập · Inbox · 26/10 · 2 tag" (`aria-expanded`), từ `md:` luôn mở | Chiều cao editor desktop đổi `17rem` → `18rem` vì thanh dính có thêm padding và viền. Tag nhập sai thì metadata tự mở để thấy lỗi |
| 9 | `pointer-fine:opacity-0` + `group-hover` + `group-focus-within` (đều có tiền tố `pointer-fine:`). Màn cảm ứng luôn hiện nút | |
| 10 | Trước khi xóa, chọn sẵn đích focus (dòng sau, rồi dòng trước, rồi `h1`), focus trong `requestAnimationFrame`. `h1` có `tabIndex={-1}` | Logic chọn đích tách ra `lib/list-focus.ts` (có test) |
| 11 | Lỗi lưu nằm lại trong thanh công cụ: dòng `role="alert"` "Lưu lỗi: …" màu destructive, có nút **Thử lại**, trạng thái ghi "Lưu lỗi". Bỏ `toast.success` khi lưu thường, chỉ giữ toast khi khôi phục | Lỗi lưu cũng không còn hiện bằng `toast.error` (đã có dòng lỗi cố định) |
| 12 | Bỏ `tablist/tab`, dùng hai nút `aria-pressed` trong `role="group"`. Khung xem trước có `role="region"` | |
| 13 | Ctrl+S không lưu khi dialog xung đột hoặc dialog thùng rác đang mở | |
| 14 | `color-scheme: light/dark` trong `:root`/`.dark`. Bỏ `[&>option]:bg-popover…` và `dark:[color-scheme:dark]` | **Tiền đề của review chỉ đúng một phần:** next-themes mặc định (`enableColorScheme`) đã gắn `style="color-scheme: …"` lên `<html>`. CSS mới chỉ làm dự phòng và gom về một chỗ |
| 15 | "Chưa lưu" đổi sang `text-amber-700 dark:text-amber-400`. Icon ghim `text-amber-600 dark:text-amber-400` (danh sách và form). Placeholder tiêu đề bỏ `/60` | |
| 16 | Chuỗi có dấu phẩy thì thêm tag ngay trong `onChange` (Gboard). Chọn gợi ý datalist cũng thêm ngay. Có `enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false}`. Chữ tag đang gõ dở tính là thay đổi chưa lưu và được thêm vào trước khi lưu (nút Lưu, Ctrl+S, "Lưu rồi đi") | Chọn gợi ý (`inputType` undefined hoặc `insertReplacementText`) **chỉ được nhận khi giá trị khớp đúng một gợi ý**, để autocorrect không tự thêm tag dở. Text và lỗi của ô tag chuyển lên NoteForm. **Sửa thêm một lỗi cũ:** thông báo "Tối đa 20 tag" bị xóa ngay sau khi hiện. Logic tách ra `lib/tag-input.ts` (có test) |
| 17 | Dialog: "Close" thành "Đóng" (nút X và nút footer). Danh sách dùng `h2`. `aria-label` khi không có tiêu đề là "Không có tiêu đề". Icon ghim `aria-hidden`, kèm `<span className="sr-only">Đã ghim, </span>` | |
| 18 | Đổi trang dùng `router.push` (cuộn lên đầu, Back về trang trước). Đổi bộ lọc vẫn `replace` + `scroll:false` | |

### File đã đổi (`apps/web` trừ khi ghi khác)

- **Mới:**
  - `components/unsaved-guard.tsx`, `components/logout-button.tsx`, `components/notes/trashed-note-view.tsx`
  - `lib/navigation-guard.ts`, `lib/local-draft.ts`, `lib/tag-input.ts`, `lib/list-focus.ts`
  - Test: `lib/navigation-guard.test.ts`, `lib/local-draft.test.ts`, `lib/tag-input.test.ts`, `lib/list-focus.test.ts`
- **Sửa:**
  - `components/notes/note-form.tsx`, `components/notes/tag-input.tsx`, `components/notes/note-list.tsx`, `components/notes/conflict-dialog.tsx`
  - `components/app-header.tsx`, `components/editor/codemirror-editor.tsx`
  - `components/ui/{button,badge,input,native-select,dialog}.tsx`
  - `app/layout.tsx` (viewport), `app/globals.css`, `app/(app)/layout.tsx` (provider, Đăng xuất ở footer)
  - `app/(app)/notes/notes-view.tsx`, `app/(app)/notes/[id]/note-detail.tsx`, `app/(app)/notes/new/new-note-form.tsx`, `app/(app)/tags/tags-view.tsx`
- **Gốc repo:** `eslint.config.mjs` (rule `no-restricted-imports` cho `next/link`)
- **Không đổi:** `apps/api`, `packages/shared`, migration, dependency

### Kết quả kiểm chứng (đã chạy thật)

| Bước | Kết quả |
|---|---|
| `pnpm -r lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm -r test` | ✅ **93 test**: shared 23, api 36, web 34 (trước là 10; thêm 24 test cho guard, nháp, focus sau khi xóa, ô tag) |
| `pnpm -r build` | ✅ shared, api, web (TypeScript qua) |
| `pnpm format:check` | ✅ |
| Chạy thử bằng Chrome headless (Playwright, script để ngoài repo) | ✅ **108/108** kiểm tra. Chạy ở desktop 1280×800 và điện thoại 390×844 (giả lập cảm ứng, `pointer: coarse` khớp), cả theme tối lẫn sáng, không có lỗi JS. API chạy ở :3101 với DB `notebook_test`, web ở :3100. **Không đụng DB dev** |

**Các ca đã chạy trên trình duyệt:**
- Link trong app và Đăng xuất bị chặn khi có thay đổi. Esc là Ở lại. "Lưu rồi đi" lưu xong mới đi; "Bỏ thay đổi" không lưu và xóa nháp.
- Đóng tab rồi mở lại thì có banner nháp. Khôi phục, Bỏ, nháp note mới khôi phục rồi POST đúng id cũ. Nháp trên version cũ mở dialog xung đột; khi dialog đang mở, Ctrl+S không gửi PATCH.
- Gõ tiếp ngay sau Ctrl+S vẫn vào editor. Lần lưu sau là PATCH. "Note mới" ngay sau khi lưu ra form trống. Back về `/notes/<id>` và tải lại đều hiện đúng note.
- Lỗi mạng: dòng lỗi vẫn còn sau 5 giây, bấm Thử lại thì lưu được.
- View thùng rác không có ô nhập nào, kể cả `contenteditable`. Khôi phục xong focus vào tiêu đề.
- Xóa bằng bàn phím trong danh sách: focus sang dòng sau.
- Focus ring 2px. Vùng chạm 40–44px. Chữ 16px ở select, ô ngày, ô tag và CodeMirror trên điện thoại.
- Kéo xuống cuối note dài: nút Lưu vẫn trong màn hình. Dialog xung đột vừa màn 390px.
- Phân trang: cuộn lên đầu, Back về trang trước.

**Chưa kiểm chứng:** chưa thử trên iPhone hay Android thật. Các hành vi riêng của iOS Safari (zoom khi focus, kill tab ở nền), `interactive-widget` của Chrome Android và datalist trên Firefox/Safari mới chỉ suy ra từ tài liệu và giả lập.

### Lưu ý

- **Nút Back của trình duyệt vẫn không chặn được** (Next không có API cho việc này). Trường hợp đó nhờ lớp nháp.
- **Nháp note mới chỉ có một ô.** Mở `/notes/new` ở hai tab cùng lúc thì tab ghi sau đè nháp của tab trước. Note đã có nháp riêng theo id, không bị ảnh hưởng.
- **Cách giữ form khi lưu note mới (mục 7) dựa vào hành vi bên trong router của Next 16.4.3.** Khi nâng Next, cần thử lại hai ca: bấm "Note mới" ngay sau khi lưu, và Back/Forward.
- **DB `notebook_test` còn dữ liệu thử từ lần chạy trình duyệt.** e2e tự TRUNCATE khi chạy nên không ảnh hưởng.
- **Nhóm C (19–27) chưa làm**, đúng phạm vi đã chốt.

---

## Thiết kế lại giao diện

Theo `docs/ui-redesign.md` (workspace có sidebar kiểu Linear/Notion, màu nhấn indigo). Làm đủ 19 dòng trong bảng file ở mục 4, theo đúng thứ tự. Chỉ đổi `apps/web`. **Không đổi** backend, schema, API, dependency (font qua `next/font`). Không làm các mục ở mục 6 của thiết kế.

### Đã làm

- **Token và font:** Be Vietnam Pro (400/500/600/700, `latin` + `vietnamese`) và JetBrains Mono (không preload). `viewportFit: 'cover'`. Toàn bộ màu `:root`/`.dark` theo mục 1.3 (hue 277), thêm token status/loại/elevation, `--radius` 0.5rem. Base: `::selection`, `accent-color`, font mono cho `code/kbd/pre`, prose theo token (bỏ `dark:prose-invert`), CodeMirror dùng JetBrains Mono, con trỏ và vùng chọn indigo. Sửa hai lỗi contrast `--hl-comment` (và đưa `--hl-*` sáng về L 0.50). Rule `prefers-reduced-motion`. Rule ẩn tab bar khi ô nhập đang focus. `scroll-padding` trên/dưới.
- **Primitive:** Button (indigo, `shadow-elev-1`, giữ mọi size `pointer-coarse:*`), Input / NativeSelect `bg-field`, Dialog (overlay `bg-black/40`, `dark:bg-black/60`, `rounded-2xl`, `shadow-elev-3`, `DialogTitle` bỏ `leading-none`, bottom sheet dưới 640px), Toast (bỏ `richColors`, icon màu theo token, dưới phải, nằm trên tab bar ở mobile). Mới: `Segmented` (`role="group"` + `aria-pressed`), `Skeleton`.
- **Shell:** sidebar `w-60` từ md (logo, Note mới, Inbox / Ghi chú / Tag / Thùng rác có số đếm, 8 tag nhiều note nhất, trạng thái server, đổi giao diện, Đăng xuất). Tab bar 5 ô dưới đáy ở mobile (Ghi chú, Inbox có badge, nút Note mới ở giữa, Tag, Thêm), ẩn ở màn soạn note và khi bàn phím mở. Sheet "Thêm" (Thùng rác, Sáng/Tối, trạng thái server, Đăng xuất ở cuối). Skip link "Bỏ qua tới nội dung", `<main id="main" tabIndex={-1}>`. Bỏ header và footer cũ. Số đếm lấy từ `total` của `GET /notes?limit=1` và `GET /tags`, không có endpoint mới.
- **Danh sách:** card có vạch màu theo loại, link phủ toàn card (giữ `data-note-link`), focus ring 2px trên cả card qua `has-[]`, chip loại/trạng thái/tag, ngày tương đối theo `updatedAt` (thêm ngày của note nếu khác ngày), nhóm "Đã ghim" / "Ghi chú khác" (h2 nhóm, card h3), hiện lần lượt khi mount (tắt khi reduced motion). Thanh lọc bằng segmented (trạng thái, loại) + select tag, "Bỏ lọc". Phân trang căn trái có chevron. Skeleton khi tải, `EmptyState`, `QueryError` (lỗi mạng có lời nhắn riêng).
- **Trang mới:** `/inbox` (dùng chung `NotesView` với `scope="inbox"`: cố định INBOX, ẩn lọc và chip trạng thái) và `/trash` (card biến thể `trash`: "Đã xóa …", Khôi phục, Xóa vĩnh viễn có dialog xác nhận, focus mặc định "Hủy", không có Hoàn tác, không "Dọn sạch", không đếm ngược 30 ngày). Hook mới `useDeleteNotePermanently`.
- **Editor:** thanh công cụ dính `top-0` (margin âm khớp padding mới của `main`), trạng thái lưu có icon (Đã lưu / Chưa lưu / Đang lưu / Lưu lỗi), ghim indigo, banner nháp indigo, ô tiêu đề 24→30px. Loại và Trạng thái là segmented. Ô ngày có icon, nền `bg-field`. Chip tag `bg-accent`. Chia đôi Viết | Xem dời từ `md` lên `lg`, mỗi pane có header "Markdown" / "Xem trước", khung editor tự co giãn (bỏ số cứng `calc(100dvh-18rem)`). Dưới `lg`: segmented Viết/Xem có icon. Logic (guard, nháp, `replaceState`, Ctrl+S, 409, thùng rác, `commitPendingTag`) giữ nguyên.
- **Note trong thùng rác:** banner `warning-bg`, h1 kiểu h1 note, chip meta, tag dạng chữ tĩnh, nội dung trong card. Vẫn không có ô nhập hay `contenteditable`, khôi phục xong focus vào tiêu đề.
- **Trang Tag:** header có số tag, danh sách card, ô `#` indigo, thanh tỉ lệ số note, nút sửa/xóa hiện khi hover (luôn hiện trên cảm ứng). Logic đổi tên/gộp/xóa giữ nguyên.
- **Đăng nhập:** logo, glow indigo nhẹ, form `rounded-2xl` `shadow-elev-2`, ô `h-11`, lỗi có icon (giữ `role="alert"`, `aria-describedby`), nút hiện/ẩn mật khẩu (`aria-pressed`).
- **Phần nhỏ:** HealthStatus dùng `bg-success`/`bg-destructive`. ThemeToggle có prop `withLabel` (đổi chữ bằng CSS, không lệch hydration). LogoutButton nhận `className`, vẫn qua `useGuardedAction`.

### File (`apps/web`)

- **Mới:**
  - `app/(app)/inbox/page.tsx`, `app/(app)/trash/page.tsx`, `app/(app)/trash/trash-view.tsx`
  - `components/app-shell/{nav.ts, nav.test.ts, use-nav-counts.ts, app-sidebar.tsx, mobile-tab-bar.tsx, more-sheet.tsx, tab-item.tsx, app-main.tsx, skip-link.tsx}`
  - `components/{empty-state, query-error, page-header, pagination}.tsx`
  - `components/notes/{note-meta, note-list-skeleton, note-editor-skeleton}.tsx`
  - `components/ui/{segmented, skeleton}.tsx`
  - `lib/list-params.ts` + `lib/list-params.test.ts`, `lib/use-hydrated.ts`
- **Sửa:** `app/layout.tsx`, `app/globals.css`, `app/providers.tsx`, `app/(app)/layout.tsx`, `app/(app)/notes/{page,notes-view}.tsx`, `app/(app)/notes/[id]/note-detail.tsx`, `app/(app)/notes/new/new-note.tsx` (skeleton khi tải), `app/(app)/tags/tags-view.tsx`, `app/(auth)/login/{page,login-form}.tsx`, `components/ui/{button,input,native-select,dialog,sonner}.tsx`, `components/notes/{note-list,note-form,tag-input,trashed-note-view,conflict-dialog,use-note-actions}.ts(x)`, `components/editor/markdown-preview.tsx`, `components/{health-status,theme-toggle,logout-button}.tsx`, `lib/date.ts`, `lib/date.test.ts`
- **Xóa:** `components/app-header.tsx`
- **Không đổi:** `apps/api`, `packages/shared`, migration, `package.json`/lockfile, `eslint.config.mjs`. `new-note-form.tsx` và một phần `note-form.tsx` đã có thay đổi chưa commit từ trước khi làm việc này, không thuộc đợt này.

### Chỗ lệch khỏi `docs/ui-redesign.md` và lý do

1. **Lỗi hydration do sidebar (thiết kế không lường trước).** Sidebar đọc `?tag=` nên nằm trong `<Suspense>`. Trên trang render động (`/notes/[id]`), boundary này đôi khi hydrate sau khi các query đếm (do tab bar bên ngoài boundary khởi động) đã có dữ liệu, nên render khác HTML của server: React lỗi #418, gặp lặp lại ở theme sáng. Đã tìm ra diff thật bằng bản dev chạy từ bản sao ngoài repo. Sửa bằng `lib/use-hydrated.ts` (`useSyncExternalStore`, snapshot server là `false`): số đếm và danh sách tag chỉ hiện sau khi hydrate xong.
2. **Cuối sidebar xếp dọc** (trạng thái server / Giao diện sáng / Đăng xuất), không để "Giao diện" và "Đăng xuất" chung một hàng: với Be Vietnam Pro hai nút có chữ không vừa 216px, nút Đăng xuất bị cắt.
3. **Vị trí toast dùng biến CSS `--toast-offset-bottom`** thay cho `mobileOffset` cố định: "mobile" của sonner là ≤ 600px còn tab bar hiện tới 767px, nên với offset của thiết kế, toast đè lên tab bar ở khoảng 600–767px. `--border-radius` của toast dùng `calc(var(--radius) * 1.4)`, vì biến `--radius-xl` của `@theme inline` không có lúc chạy.
4. **Selector CodeMirror thêm `.cm-editor`** (ví dụ `.markdown-editor .cm-editor .cm-scroller`): CodeMirror chèn style lúc chạy với cùng độ ưu tiên, chèn sau nên thắng, font JetBrains Mono và padding sẽ không ăn.
5. **Code inline trong preview** dùng `[&_:not(pre)>code]:*` thay cho `prose-code:bg-muted px-1 …`: `prose-code:` áp cả vào `code` bên trong khối `pre`.
6. **Thanh công cụ dính dùng `-mt-[max(1rem,env(safe-area-inset-top))]`** thay cho `-mt-4`, để khớp đúng `pt` của `main` khi có tai thỏ (PWA). Khung editor thêm `lg:grid-rows-[minmax(0,1fr)]`, mỗi pane là cột flex (header + vùng cuộn), để CodeMirror và preview cuộn bên trong khung.
7. **Giữ focus khi ghim/bỏ ghim trong danh sách.** Có nhóm "Đã ghim" thì card chuyển sang `<ul>` khác (mount lại), focus rơi về `body`. Nút ghim nay có `focusableWhenDisabled` (base-ui), và focus được trả về nút ghim của card đó sau khi đổi nhóm.
8. **`useRestoreNote` thành optimistic** (bỏ note khỏi danh sách ngay, lỗi thì rollback). Cần cho trang Thùng rác: khôi phục xong focus sang card kế tiếp như khi xóa. Các chỗ đang dùng hook này (Hoàn tác, view thùng rác) vẫn chạy đúng.
9. **Icon trong bộ lọc chỉ hiện từ md**, để 4 nút trạng thái vừa một hàng ở 390px (đúng như sơ đồ mobile của thiết kế, vốn không có icon).
10. **Nút tag trong card có `aria-label="Lọc theo tag <tên>"`**: ký tự `#` là `aria-hidden`, nếu không thì trình đọc màn hình chỉ đọc "docker". Số "+N" có thêm chữ sr-only " tag".
11. **Dòng "Đã lưu"** hiện "Đã lưu 17:59" khi lưu trong hôm nay, ngày khác thì kèm ngày. Giờ đầy đủ nằm ở `title`. Dòng tóm tắt metadata trên mobile dùng `formatShortDay` ("Hôm nay", "Hôm qua", "26/10").
12. **Thêm `pointer-coarse:h-10` cho `Input`.** Thiết kế ghi "giữ", nhưng `Input` trước đây chưa có. Dòng tag dùng `min-h-12` thay cho `h-12`, vì form đổi tên có thể xuống hàng khi có lỗi.
13. **Note không tồn tại:** `EmptyState` kèm một `h1` sr-only (trang cần h1). Lỗi khác: `QueryError` cùng nút "Về danh sách".
14. **Tách thêm vài file nhỏ** để dùng chung: `page-header`, `pagination`, `note-editor-skeleton` (dùng cả khi tải `/notes/new`), `tab-item`, `lib/list-params`, helper `formatDeleted` / `formatTime` / `formatSavedAt` / `isDifferentDay` trong `lib/date.ts`.

### Kết quả kiểm chứng (đã chạy thật)

| Bước | Kết quả |
|---|---|
| `pnpm -r lint` | ✅ 0 lỗi, 0 cảnh báo |
| `pnpm -r test` | ✅ **125 test**: shared 23, api 39, web 63. Web trước là 34, thêm 29 test: `nav.test.ts` (12), `date.test.ts` (16, trước là 3), `list-params.test.ts` (4) |
| `pnpm -r build` | ✅ shared, api, web. Route mới `/inbox`, `/trash` đều prerender tĩnh |
| `pnpm format:check` | ✅ |
| Chạy thử bằng Chrome headless (Playwright, script để ngoài repo) | ✅ **236/236** kiểm tra. Desktop 1280×800 và điện thoại 390×844 (cảm ứng, `pointer: coarse`), cả theme tối lẫn sáng. API ở :3101 với DB `notebook_test`, web (bản build production) ở :3100. **Không đụng DB dev hay dev server :3000.** Chạy xong đã tắt cả hai |
| axe-core (WCAG 2.2 AA) | ✅ 0 vi phạm, kể cả contrast, ở `/notes`, editor, note trong thùng rác, `/trash`, `/tags`, `/login` (desktop, hai theme) và `/notes` (mobile, hai theme) |

**Các ca đã chạy trên trình duyệt:**
- Bộ 108 kiểm tra cũ, sửa theo DOM mới: guard, nháp, Ctrl+S, 409, thùng rác chỉ đọc, focus sau khi xóa, vùng chạm, chữ 16px, nút Lưu luôn trong màn hình, dialog xung đột ở 390×844, phân trang.
- Skip link là phần tử nhận focus đầu tiên và đưa focus vào `main`.
- `aria-current` đúng ở `/notes`, `/notes?tag=`, `/inbox`, `/tags`, `/trash`. Không mục nào sáng ở `/notes/new`.
- Số đếm trên sidebar khớp API. Tag ở sidebar và link quay lại đều đi qua guard.
- `/inbox` chỉ có note INBOX, không có lọc hay chip trạng thái.
- Segmented lọc đổi URL đúng. Bấm vào trích đoạn mở note (link phủ card). Focus link thì cả card có outline 2px.
- Ghim bằng bàn phím: focus vẫn ở nút ghim.
- `/trash`: khôi phục và xóa vĩnh viễn (dialog, focus "Hủy", Hủy thì không xóa), focus sang card kế tiếp, API trả 404 sau khi xóa, thùng rác rỗng thì hiện empty state.
- Editor ở `lg` chia đôi, vừa một màn hình, thanh công cụ ở `top: 0`. Ở 1000px là Viết/Xem và vẫn có sidebar.
- Mobile:
  - Tab bar 64px, nút Note mới 48px, card cuối không bị tab bar che, toast nằm trên tab bar.
  - Badge Inbox có chữ sr-only.
  - Sheet "Thêm" là bottom sheet, đổi được theme, vào được Thùng rác.
  - Tab bar biến mất khi gõ ở ô đổi tên tag và hiện lại khi rời ô.
  - Tab bar ẩn ở màn soạn note.
  - Dialog guard và dialog xung đột là bottom sheet, mọi nút nằm trong màn hình.
- Không có lỗi JS. Bản dev chạy thử cũng không có cảnh báo React.

**Ảnh chụp** nằm ở `/tmp/claude-1001/-home-anhn-my-project-notebook/21170f50-1591-48c9-a930-b6d3050e4ad8/scratchpad/redesign-shots/`:
- `before-*`: 20 ảnh, giao diện cũ.
- `after-*`: 34 ảnh, gồm list, editor, Tag, login, note trong thùng rác, `/trash`, `/inbox`, dialog guard, sheet "Thêm", ở desktop/mobile × tối/sáng.
- `check-*`: ảnh chụp trong lúc chạy kiểm tra.

**Chưa kiểm chứng:** chưa thử trên iPhone hay Android thật (safe-area, ẩn tab bar khi bàn phím mở, bottom sheet). Mới chạy axe ở các trang kể trên, chưa chạy với dialog đang mở.

### Lưu ý

- **Be Vietnam Pro preload 8 file woff2** (4 weight × 2 subset). Bản dev có cảnh báo "preloaded but not used within a few seconds" ở vài trang. Có thể bỏ bớt weight hoặc `preload` nếu thấy chậm.
- **DB `notebook_test` còn dữ liệu demo** (seed để chụp ảnh). e2e tự TRUNCATE khi chạy nên không ảnh hưởng.
- **Số đếm sidebar tốn 3 request nhỏ** khi mở app (đúng như mục 2.6 của thiết kế). `GET /notes/counts` vẫn chỉ là đề xuất.
