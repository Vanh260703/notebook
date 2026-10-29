# Notebook

Sổ tay học tập & cá nhân cho một người dùng. Đặc tả đầy đủ: [PROJECT.md](PROJECT.md).

```
apps/web         Next.js (App Router) → Vercel, proxy /api/* sang API_URL
apps/api         NestJS + TypeORM → Docker trên server ở nhà
packages/shared  @notebook/shared: hằng, type, zod schema dùng chung (build ra CommonJS)
```

Yêu cầu: Node 22, pnpm 12 (`corepack enable`), Docker + Compose v2.

## Chạy dev trên laptop

```bash
pnpm install

# 1. Biến môi trường (không commit các file này)
cp .env.example .env                           # nơi duy nhất chứa secret; docker compose và API trên host đều đọc
#   - Điền POSTGRES_PASSWORD, APP_PASSWORD, SESSION_SECRET bằng `openssl rand -hex 32`
#   - Bỏ comment dòng COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
#     (mở PostgreSQL ra 127.0.0.1; KHÔNG bật trên server)
#   - Port 5432 trên máy đã bị chiếm thì đặt POSTGRES_HOST_PORT
cp apps/web/.env.example apps/web/.env.local   # API_URL=http://localhost:3001
# Tùy chọn: apps/api/.env cho giá trị riêng khi chạy API trên host (PORT, COOKIE_SECURE...).
# Không đặt secret ở đó. DATABASE_URL tự ghép từ POSTGRES_PASSWORD + POSTGRES_HOST_PORT.

# 2. PostgreSQL + API trong Docker (API tự chạy migration khi khởi động)
docker compose up -d
curl http://127.0.0.1:3001/health        # {"status":"ok","db":"up"}

# 3. Build package dùng chung rồi chạy web
pnpm -r build
pnpm --filter web dev                     # http://localhost:3000
```

Muốn sửa API với hot reload thì chạy API trên host thay cho container (cùng port 3001, chỉ chạy một trong hai):

```bash
docker compose up -d postgres
docker compose stop api
pnpm --filter @notebook/shared dev &      # tsc --watch
pnpm --filter api start:dev
```

Kiểm tra trước khi push: `pnpm -r build && pnpm -r lint && pnpm -r test && pnpm format:check`.

## Đăng nhập

- Mật khẩu là `APP_PASSWORD` (từ 10 ký tự), cookie ký bằng `SESSION_SECRET` (từ 32 ký tự, khác mật khẩu). Thiếu, quá ngắn hoặc còn giá trị mẫu `change-me...` thì API không khởi động.
- Đổi `SESSION_SECRET` rồi restart API = đăng xuất mọi thiết bị.
- Cookie mặc định có `Secure`. Chrome/Firefox chấp nhận trên `http://localhost`; Safari với localhost hoặc mở từ điện thoại qua IP LAN (`http://192.168.x.x:3000`) thì đặt `COOKIE_SECURE=false` trong `.env` gốc (hoặc `apps/api/.env` nếu chỉ muốn áp dụng khi chạy API trên host). Không đặt `false` trên server.
- Sai mật khẩu 5 lần trong 15 phút thì khóa đăng nhập toàn cục 15 phút (thiết bị đã đăng nhập không bị ảnh hưởng; restart API để mở khóa ngay).

## Test e2e API (Postgres thật)

```bash
# Một lần: tạo DB test trong container postgres. TEST_DATABASE_URL mặc định trỏ tới notebook_test
# (ghép từ .env gốc); đặt trong apps/api/.env nếu muốn dùng DB khác.
docker compose exec postgres createdb -U notebook notebook_test
pnpm --filter api test:e2e
```

Test TRUNCATE dữ liệu, nên từ chối chạy nếu tên DB không kết thúc bằng `_test` (trừ khi `CI=true`).

## Migration (TypeORM)

Schema chỉ đổi qua migration (`synchronize: false`). CLI tự ghép `DATABASE_URL` từ `.env` gốc (hoặc lấy từ `apps/api/.env` nếu có đặt), nên cần PostgreSQL mở port (`COMPOSE_FILE` có `docker-compose.dev.yml`).

```bash
# Sau khi sửa entity: sinh migration mới từ diff giữa entity và DB
pnpm --filter api migration:generate src/database/migrations/<TenMigration>
# Xem lại file sinh ra (sửa tay nếu cần, ví dụ thêm extension/hàm), rồi áp dụng
pnpm --filter api migration:run
# Phải báo "No changes in database schema were found" (CI cũng chạy bước này)
pnpm --filter api migration:check

pnpm --filter api migration:show          # trạng thái
pnpm --filter api migration:revert        # lùi migration cuối
```

Lưu ý:

- Migration `Init` có phần thêm tay `CREATE EXTENSION unaccent` + hàm `f_unaccent` (IMMUTABLE) ở đầu `up()`, vì cột generated `Note.search` cần hàm này có trước.
- Migration `SearchV2` có phần thêm tay `CREATE TEXT SEARCH CONFIGURATION public.vn_unaccent` (dùng cho highlight kết quả tìm). TypeORM không theo dõi config này nên `migration:check` không báo; đổi biểu thức cột `search` thì đọc kỹ file sinh ra, phải có `CREATE INDEX "Note_search_idx"`.
- Không sửa chuỗi `NOTE_SEARCH_EXPRESSION` trong `note.entity.ts` nếu không định sinh migration mới.
- Tên DB phải là `notebook` ở mọi môi trường (TypeORM lưu biểu thức cột generated trong `typeorm_metadata` theo tên DB).
- API trong Docker tự chạy migration còn thiếu lúc khởi động (`migrationsRun: true`). Lùi migration trên server:
  `docker compose exec api node node_modules/typeorm/cli.js migration:revert -d dist/database/data-source.js`

## Hành vi chạy nền

- **Dọn thùng rác:** API tự xóa vĩnh viễn note nằm trong thùng rác quá 30 ngày, chạy lần đầu 60 giây sau khi khởi động rồi mỗi giờ (`TrashPurgeService`, không cần cấu hình). Có xóa thì ghi log `TrashPurge`. Không chạy khi `NODE_ENV=test`.
- **Outbox (web):** note mới được ghi vào IndexedDB `notebook` (store `outbox`) của trình duyệt trước rồi mới gửi. Xem và gửi lại ở đầu trang Inbox. Đăng xuất xóa outbox và nháp `nb:draft:*` trên máy đó.

## Phím tắt (web)

- `Ctrl/Cmd + K`: bảng lệnh (tìm note, chuyển trang, ghi nhanh). `Shift + Enter` trên một note: mở chế độ đọc.
- `C`: ghi nhanh (khi không đang gõ trong ô nhập).
- `Ctrl/Cmd + S`: lưu note trong trình soạn.

## Deploy

- Server ở nhà: `.env` không có dòng `COMPOSE_FILE`, rồi `git pull && docker compose up -d --build`.
- Vercel: Root Directory `apps/web`, đặt `API_URL` (rewrites được tính lúc build, đổi `API_URL` thì phải redeploy).
