# Báo cáo Giai đoạn 0: khung dự án

Ngày 2026-10-26. File này chỉ để bạn đọc, đọc xong thì xóa.

**Kết quả:** đạt tiêu chí "Xong khi" của Giai đoạn 0. `docker compose up` chạy được cả postgres và api, `/health` trả `200 {"status":"ok","db":"up"}`, web chạy local gọi được API qua proxy `/api/*`.

---

## 1. Quy trình đã chạy

1. **Chốt ORM.** PROJECT.md ghi TypeORM, còn CLAUDE.md ghi Prisma. Bạn chọn TypeORM, CLAUDE.md đã sửa cho khớp.
2. **backend-architect** review thiết kế: entity, data-source, docker compose, Dockerfile, packages/shared, CI. Agent này chỉ thiết kế, không sửa file. Nó đối chiếu với mã nguồn TypeORM 0.3.31.
3. **fullstack-developer** dựng khung theo bản review, rồi chạy kiểm chứng thật: build, migration, Docker, proxy của web.
4. **Mình review lại:** đọc các file chính và tự chạy lại build, lint, test và `/health`.
5. **Ngoài lề:** tạo `.env.backup` (chỉ chứa public key) và xóa `notebook-backup.key`, như đã trao đổi.

## 2. Những gì đã tạo

```
notebook/
├── package.json              # packageManager pnpm@12.14.0, script build/lint/test/format
├── pnpm-workspace.yaml       # apps/*, packages/*, catalog zod, allowBuilds
├── tsconfig.base.json  eslint.config.mjs  .prettierrc.json  .prettierignore
├── .gitignore  .dockerignore # chặn .env, .env.*, *.key
├── .env.example  .env        # .env là bản local (chmod 600), giá trị ngẫu nhiên
├── .env.backup               # AGE_RECIPIENT (public key) + RCLONE_REMOTE
├── docker-compose.yml        # postgres + api, cho cả server và laptop
├── docker-compose.dev.yml    # chỉ laptop: mở postgres ra 127.0.0.1
├── README.md                 # cách chạy dev, migration, deploy
├── .github/workflows/ci.yml
├── packages/shared/          # @notebook/shared, build tsc ra CommonJS + .d.ts
│   └── src/ index, note (NOTE_TYPES, NOTE_STATUSES, schema), tag (tagNameSchema), health, tag.test
├── apps/api/                 # NestJS 11 + TypeORM 1.1.2
│   ├── Dockerfile
│   └── src/ main, app.module, database/{data-source, migrations/…-Init},
│            notes/note.entity, tags/tag.entity, health/{controller, module, spec}
│       test/health.e2e-spec.ts
└── apps/web/                 # Next.js 16 + Tailwind 4 + shadcn/ui + TanStack Query
    ├── next.config.ts        # rewrite /api/:path* → API_URL, báo lỗi rõ khi thiếu
    ├── app/ layout, page, providers, globals.css
    ├── components/ health-status, ui/button
    ├── lib/ api (fetchHealth), utils
    └── .env.example  .env.local  AGENTS.md (do next dev tự sinh)
```

### Phiên bản chính

| Phần | Phiên bản |
|---|---|
| Web | next 16.4.3, react 19.3.1, tailwindcss 4.3.3, @tanstack/react-query 5.104.5, shadcn 4.22.1 |
| API | @nestjs/* 11.2.8, @nestjs/typeorm 11.0.3, typeorm 1.1.2, pg 8.23.1, nestjs-zod 5.5.0, jest 30 |
| Shared | zod 4.6.7 (ghim chung qua `catalog:`), vitest 5 |
| Công cụ | TypeScript 6.0.3, ESLint 9, Prettier 3.9 |
| Docker / CI | node 22-alpine, postgres 17-alpine |

**Không dùng bản mới nhất, vì lỗi tương thích:**
- **NestJS 11 thay vì 12:** nestjs-zod chỉ hỗ trợ NestJS 10 và 11.
- **@nestjs/typeorm 11 thay vì 12:** bản 12 chỉ có ESM, Jest không nạp được.
- **TypeScript 6 thay vì 7:** typescript-eslint, ts-node và @nestjs/cli chưa chạy với TS 7.
- **ESLint 9 thay vì 10:** các plugin của eslint-config-next chưa hỗ trợ ESLint 10.

## 3. Các quyết định thiết kế chính (từ review)

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Tên bảng | `@Entity('Note')`, `@Entity('Tag')`, `@JoinTable({ name: 'NoteTag' })` | Mặc định TypeORM đặt tên `note`, khi đó SQL viết tay `"Note"` sẽ lỗi |
| `search` | Cột generated, biểu thức để trong hằng `NOTE_SEARCH_EXPRESSION` | TypeORM so sánh biểu thức qua bảng `typeorm_metadata`. Sửa chuỗi này là sinh ra migration mới |
| GIN index | `@Index(..., { type: 'gin' })` | Có ở TypeORM 1.x, migration tự sinh ra và `--check` theo dõi được |
| `version` | `int` thường, **không** dùng `@VersionColumn` | `@VersionColumn` tự tăng cả khi `softDelete`, `restore`, `save` |
| `entryDate` | `date`, kiểu string `'YYYY-MM-DD'`, **không** có default ở DB | `CURRENT_DATE` tính theo UTC sẽ lệch ngày. Thêm parser để query raw không bị đổi sang `Date` |
| NoteTag | `onDelete: 'CASCADE'` ở **cả hai** phía | Thiếu ở phía Tag thì `DELETE /tags/:id` lỗi |
| Tên tag | zod: trim, NFC, chữ thường | Tránh "việt" gõ dạng NFD (thường gặp trên iOS/macOS) thành một tag khác |
| Enum | `varchar(16)` + `CHECK`, nguồn chuẩn là hằng trong shared | Đổi enum Postgres rất phiền |
| `migrationsRun` | Chỉ đặt ở `app.module`, không đặt trong `data-source.ts` | Đặt ở `data-source.ts` thì mọi lệnh CLI tự chạy migration mà không báo |
| Port Postgres | Server: không publish. Laptop: `docker-compose.dev.yml` bật qua `COMPOSE_FILE` trong `.env` | Không dùng `override.yml` vì compose tự nạp file đó cả trên server |
| shared | Build bằng tsc ra CommonJS | Giữ `rootDir` của Nest là `src`, để đường dẫn `dist/` và migration không bị đổi |

## 4. Kết quả kiểm chứng

✅ là đã chạy thật trên máy này. CI chưa chạy trên GitHub vì chưa có repo.

| Bước | Kết quả |
|---|---|
| `pnpm install` / `-r build` / `-r lint` / `-r test` / `format:check` | ✅ Tất cả qua, sau khi cài lại từ đầu. Test: shared 4/4, api 4/4 (unit và e2e cho `/health` 200/503). **Mình đã chạy lại build, lint, test: qua** |
| `migration:generate` → `run` → `check` | ✅ "No changes in database schema were found" |
| Schema trong psql | ✅ Có bảng `Note`, `Tag`, `NoteTag`. `Note_search_idx` là GIN. FK của NoteTag đều `ON DELETE CASCADE`. `f_unaccent` là IMMUTABLE |
| Tìm kiếm | ✅ "dock:*" và "dock:* & vol:*" ra note "Sửa lỗi Docker volume". Gõ không dấu "sua & loi" và gõ có dấu "nhật:*" đều ra đúng note. Truy vấn đi qua GIN index |
| Xóa note / tag | ✅ Liên kết trong NoteTag tự xóa theo |
| `migration:check` bắt được lệch | ✅ Drop GIN index thử thì check báo exit 1, tạo lại thì exit 0 |
| `migration:revert` rồi `run` lại | ✅ Xóa sạch bảng, extension và dòng metadata |
| `docker compose up -d --build` | ✅ Cả 2 container healthy, image API khoảng 58 MB, chạy bằng user `node` |
| `curl 127.0.0.1:3001/health` | ✅ 200 `{"status":"ok","db":"up"}`. **Mình đã chạy lại: qua** |
| Dừng postgres | ✅ `/health` trả 503 sau khoảng 2 giây, bật lại thì về 200 |
| API tự chạy migration khi khởi động | ✅ Có log "Migration Init… has been executed successfully" |
| Web proxy | ✅ `curl localhost:3000/api/health` trả JSON từ API. Thiếu `API_URL` thì build dừng với lỗi rõ ràng |
| Dọn dữ liệu test | ✅ DB rỗng, chỉ còn migration Init |

## 5. Chỗ khác so với bản review

- **TypeORM 1.1.2, không phải 0.3.x:** GIN index khai báo bằng `{ type: 'gin' }`, không cần viết tay. Phần viết tay trong migration chỉ còn `unaccent` và `f_unaccent`.
- **`pnpm deploy` không có `--legacy`:** với pnpm 12, bỏ cờ này thì image nhỏ hơn (58 MB so với 88 MB) và không kéo theo typescript, ts-node.
- **Port Postgres trên laptop đặt qua `POSTGRES_HOST_PORT`:** hiện là **5434**, vì máy bạn đã có tiến trình khác dùng 5432 và 5433.
- **Bổ sung thêm:**
  - `/health` có timeout 2 giây.
  - Log có thêm mức `schema` để thấy migration đã chạy.
  - Font Inter có subset tiếng Việt.
  - CI có thêm bước `format:check`.

## 6. Mình review lại: nhận xét

**Ổn:**
- **Code bám đúng bản review và PROJECT.md.** URL của API chỉ có trong `next.config.ts`. Frontend chỉ gọi đường dẫn tương đối `/api/*`. Không có User, JWT hay class-validator.
- **Bảo mật cơ bản:** Postgres không publish port, API chỉ nghe ở `127.0.0.1:3001`. `.env`, `.env.backup`, `*.key` bị chặn khỏi git và khỏi build Docker.
- **Test NFC đúng nghĩa:** chuỗi đầu vào đúng là dạng NFD. Mình đã kiểm tra từng byte.
- **Package `cn`** trong web là package chính thức của shadcn (repo `shadcn-ui/cn`), dùng thay cho clsx và tailwind-merge.

**Lưu ý, chưa phải lỗi:**
- **PROJECT.md đã cũ ở vài chỗ:**
  - Mục 7 nói tạo GIN bằng tay và nhắc `@VersionColumn`, chưa ghi `entryDate` không có default và chưa nhắc chuẩn hóa NFC.
  - Mục 10.1 chưa nói tới `docker-compose.dev.yml` và `COMPOSE_FILE`.
  - Nên cập nhật trước Giai đoạn 1.
- **`/health` phải gắn `@Public()`** khi thêm guard auth ở Giai đoạn 1.
- **`rewrites` tính lúc build:** đổi `API_URL` trên Vercel thì phải redeploy. README đã ghi.
- **Lên NestJS 12** khi nestjs-zod hỗ trợ.

## 7. Việc bạn cần làm

- [ ] **Docker:** đăng nhập lại, hoặc chạy `newgrp docker`. User đã trong nhóm docker nhưng phiên hiện tại chưa nhận, nên agent phải chạy lệnh docker qua `sg docker`.
- [ ] **Kiểm tra key đã lưu:** thử bản trong trình quản lý mật khẩu bằng lệnh
      `age -d -i ~/k.txt /tmp/claude-1001/-home-anhn-my-project-notebook/1e796065-66fa-4ebd-9f27-0496dd6b14c1/scratchpad/test.age`.
      Lệnh in ra `test` là bản lưu đúng. Xong thì xóa `~/k.txt`.
- [ ] **`apps/web/AGENTS.md`:** chọn giữ hoặc tắt. File do `next dev` tự sinh. Muốn tắt thì đặt `agentRules: false` trong `next.config.ts`.
- [ ] **Trước Giai đoạn 1, chốt trạng thái mặc định của note mới.** Hiện DB mặc định `ACTIVE`, quick capture sẽ gửi `INBOX`. Nhưng sơ đồ ở mục 3 lại cho "Note mới" vào Inbox.
- [ ] **Khi sẵn sàng:** `git init`, tạo repo GitHub để CI chạy thật.

## 8. Trạng thái hiện tại trên máy

- **Container `notebook-postgres-1` và `notebook-api-1` đang chạy.** DB trong volume `notebook_pgdata`, đang rỗng. Muốn dừng: `docker compose down`, thêm `-v` nếu muốn xóa luôn dữ liệu.
- **Chạy web:** `pnpm --filter web dev`, mở http://localhost:3000.
