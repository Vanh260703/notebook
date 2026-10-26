# Notebook: sổ tay học tập & cá nhân

> Tài liệu cốt lõi của dự án: app này để làm gì, dùng ra sao và được xây thế nào.
> Cập nhật lần cuối: 2026-10-26

---

## 1. Dự án này là gì?

**Notebook** là app ghi chú cá nhân chạy trên web. Bạn dùng được ở mọi nơi: laptop, máy công ty hay điện thoại. App chỉ có một người dùng là bạn và không public bất kỳ nội dung nào. App lưu hai nhóm nội dung:

- **Kiến thức học được (Learning):** đoạn code, cách fix lỗi, ghi chú từ sách, khóa học, bài viết.
- **Chuyện cá nhân (Personal):** nhật ký, ý tưởng, mục tiêu, danh sách.

App có ba mục tiêu:

1. **Ghi nhanh**: mở app là viết được ngay, không phải nghĩ xem nên để ở đâu. Server có tắt thì vẫn ghi được.
2. **Tìm lại nhanh**: gõ vài chữ là ra, gõ có dấu hay không dấu đều được.
3. **Không quên**: app chủ động đưa kiến thức cũ ra để bạn ôn lại.

## 2. Vấn đề cần giải quyết

| Vấn đề hiện tại | Notebook giải quyết bằng |
|---|---|
| Kiến thức nằm rải rác ở Notion, Google Docs, tab trình duyệt, tin nhắn tự gửi cho mình | Gom về một chỗ duy nhất, có tag và tìm kiếm |
| Học xong rồi quên, gặp lại lỗi cũ thì phải Google lại từ đầu | Tìm kiếm full-text, sau này thêm flashcard để ôn |
| App lớn nặng và thừa tính năng, còn ghi chú local thì không mở được ở máy khác | App gọn, mở được qua internet trên mọi thiết bị |
| Sợ bị khóa dữ liệu trong một nền tảng | Dữ liệu nằm trên server của chính bạn, có nút xuất toàn bộ ra file `.md` |

## 3. Cách dùng hằng ngày

### Một ngày điển hình

- **Buổi sáng:** mở app, vào trang **Hôm nay** để thấy mọi note của ngày. Bạn tạo một note ghi kế hoạch trong ngày.
- **Khi đang code:** gặp lỗi Docker và tìm ra cách fix. Bấm `Ctrl + K` rồi chọn "Note mới", dán đoạn code, gắn tag `#docker`, lưu.
- **Trên điện thoại:** đọc được một ý hay. Mở app (đã cài ra màn hình chính dưới dạng PWA), bấm **Quick capture**, gõ một dòng. Note vào **Inbox** để về máy tính sắp xếp sau. Nếu lúc đó server ở nhà đang tắt hoặc mất sóng, note vẫn được giữ trên điện thoại và tự gửi lên khi kết nối lại.
- **Buổi tối:** viết nhật ký vào một note loại **Personal**. Muốn viết thêm note thứ hai, thứ ba trong ngày cũng được, tất cả đều hiện trên trang Hôm nay.
- **Cuối tuần:** viết một bài dài tổng kết những gì đã học, đọc lại bằng **chế độ đọc** như đọc blog.
- **Hai tháng sau:** gặp lại lỗi cũ. Gõ "dock vol" vào ô tìm kiếm là thấy ngay note cũ.

### Vòng đời của một ghi chú

```mermaid
flowchart LR
    A[Ghi nhanh<br/>Quick capture / Note mới] --> B[Inbox]
    B --> C[Sắp xếp<br/>gắn tag, chọn loại]
    C --> D[Kho ghi chú]
    D --> E[Tìm lại<br/>search, tag, filter]
    D --> F[Ôn tập<br/>review, flashcard]
    F --> D
```

## 4. Tính năng

### 4.1 MVP: bản đầu tiên cần có

| # | Tính năng | Mô tả |
|---|---|---|
| 1 | Đăng nhập | Một mật khẩu duy nhất, mỗi thiết bị đăng nhập một lần là dùng được một năm. Không có tài khoản, không có đăng ký |
| 2 | Tạo, sửa, xóa note | Viết bằng Markdown, có preview, highlight code block. Sửa cùng note trên hai thiết bị sẽ được báo xung đột thay vì ghi đè im lặng |
| 3 | Loại note | `LEARNING`, `PERSONAL` |
| 4 | Tag | Gắn nhiều tag cho mỗi note, lọc theo tag, đổi tên và xóa tag |
| 5 | Tìm kiếm | Full-text trên tiêu đề và nội dung, gõ không dấu vẫn ra, gõ một phần của từ cũng ra |
| 6 | Trang Hôm nay / theo ngày | Gom mọi note của một ngày thành dòng thời gian, mỗi ngày bao nhiêu note cũng được. Có lịch để nhảy sang ngày khác |
| 7 | Inbox / Quick capture | Ghi một dòng thật nhanh, sắp xếp sau. Có **outbox** để không mất note khi server tắt (xem mục 5) |
| 8 | Chế độ đọc | Đọc note dài như đọc blog: chữ to, căn giữa, mục lục sinh từ heading, thời gian đọc ước tính |
| 9 | Responsive + PWA | Dùng tốt trên điện thoại, cài được ra màn hình chính |
| 10 | Thùng rác | Xóa mềm, khôi phục được trong 30 ngày, sau đó tự xóa vĩnh viễn |
| 11 | Export | Tải toàn bộ note về dưới dạng file `.zip` chứa các file `.md` |

### 4.2 Giai đoạn sau

- **Liên kết giữa các note:** viết `[[tên note]]` để link và xem backlinks.
- **Flashcard / spaced repetition:** đánh dấu `Q:` / `A:` trong note, app nhắc ôn đúng lúc.
- **"Ngày này năm trước":** hiện lại các note cũ viết vào cùng ngày.
- **Heatmap:** biểu đồ số ngày có viết, giống contribution graph của GitHub.
- **Upload ảnh:** chèn ảnh chụp màn hình vào note. Ảnh lưu trên ổ đĩa của server (Docker volume), phục vụ qua API sau lớp auth và nằm trong bản backup.
- **AI:** tóm tắt note, gợi ý tag, hỏi đáp trên chính kho note của bạn (Claude API).
- **Graph view:** vẽ mạng lưới các note liên kết với nhau.

Không làm: chia sẻ công khai hay blog public. Mọi nội dung chỉ mình bạn đọc.

## 5. Kiến trúc

```mermaid
flowchart LR
    U[Trình duyệt<br/>laptop / điện thoại] --> W

    subgraph Vercel
        W[Next.js<br/>giao diện + rewrite /api/*]
    end

    W -- "/api/* → proxy<br/>https://&lt;máy&gt;.&lt;tailnet&gt;.ts.net" --> F[Tailscale Funnel]

    subgraph Home[Server ở nhà · docker compose]
        A[NestJS API<br/>:3001]
        D[(PostgreSQL<br/>chỉ nội bộ)]
        B[Cron backup]
    end

    F --> A
    A --> D
    B -- "pg_dump → mã hóa → rclone" --> G[Google Drive]
```

### Các quyết định quan trọng

1. **Frontend trên Vercel, backend trên server ở nhà.** Vercel tự build và chạy Next.js. NestJS và PostgreSQL chạy bằng docker compose trên một máy ở nhà chạy 24/7 (mini PC, laptop cũ). Chấp nhận rủi ro server có lúc tắt; bạn tự kiểm tra `/health` hằng ngày.

2. **Tailscale Funnel cấp URL public cho server ở nhà.** Vercel chạy ngoài internet nên không gọi được `localhost` hay IP nội bộ. Funnel cho một URL HTTPS cố định dạng `https://<máy>.<tailnet>.ts.net`, miễn phí. Không cần IP public, không cần mở port router, không bị ảnh hưởng bởi CGNAT hay IP động. Chỉ port của API được mở ra ngoài.

3. **Next.js proxy request `/api/*` sang API** bằng `rewrites` trong `next.config`. Trình duyệt chỉ thấy một domain (`*.vercel.app`), nên cookie đăng nhập là cookie cùng domain: không phải xử lý CORS, không bị Safari chặn cookie bên thứ ba. Frontend fetch phía client bằng TanStack Query; app nằm sau đăng nhập nên không cần SSR cho dữ liệu.

4. **URL của API chỉ xuất hiện ở một chỗ:** biến `API_URL` trên Vercel. Nhờ vậy đổi sang Cloudflare Tunnel hay cách khác sau này chỉ là sửa một biến (xem mục 10.5).

5. **Outbox cho note mới.** Khi tạo note (quick capture hoặc note mới), frontend ghi note vào IndexedDB trước, báo "Đã lưu" ngay, rồi gửi lên server. Gửi thất bại thì giữ lại và gửi lại khi có sự kiện `online`, khi mở lại app, hoặc định kỳ. Gửi thành công mới xóa khỏi outbox. `id` của note là UUID tạo ở client, nên gửi lặp lại không tạo note trùng. Outbox chỉ áp dụng cho việc **tạo note**; sửa note khi offline không hỗ trợ.

6. **Không lưu note thành file trên server.** Nội dung Markdown nằm trong PostgreSQL. Khi muốn có file `.md` thì dùng Export.

## 6. Tech stack

| Tầng | Công nghệ | Ghi chú |
|---|---|---|
| Monorepo | pnpm workspaces (thêm Turborepo nếu cần) | Chia sẻ type và schema giữa web và api |
| Frontend | Next.js (App Router), TypeScript | Deploy lên Vercel |
| UI | Tailwind CSS, shadcn/ui | |
| Editor | CodeMirror 6 | Viết Markdown thô, có phím tắt |
| Render Markdown | react-markdown, remark-gfm, rehype-highlight | Bảng, checklist, highlight code |
| Data fetching | TanStack Query | Cache, optimistic update |
| Outbox | IndexedDB (qua `idb-keyval` hoặc `idb`) | Hàng đợi note chưa gửi |
| Backend | NestJS, TypeScript | Chạy trong Docker trên server ở nhà |
| ORM | TypeORM (`@nestjs/typeorm`) | Entity + migration, `synchronize: false`; search dùng QueryBuilder |
| Database | PostgreSQL | Container cùng máy, không mở port ra ngoài |
| Auth | Một mật khẩu trong env + cookie httpOnly có ký HMAC | Không có bảng user, không JWT |
| Validation | zod trong `packages/shared` | NestJS dùng `ZodValidationPipe` (`nestjs-zod`), không dùng class-validator |
| Lịch chạy | `@nestjs/schedule` | Dọn thùng rác |
| Đưa ra internet | Tailscale Funnel | |
| Backup | `pg_dump`, `age` (mã hóa), `rclone` → Google Drive | Chạy bằng crontab trên server |
| Container | Docker, docker compose | Dev local và chạy trên server |
| CI | GitHub Actions | Lint, test, build |

## 7. Mô hình dữ liệu

```mermaid
erDiagram
    Note ||--o{ NoteTag : ""
    Tag  ||--o{ NoteTag : ""

    Note {
        uuid id PK "tạo ở client"
        string title
        text content "Markdown"
        enum type "LEARNING | PERSONAL, mặc định LEARNING"
        enum status "INBOX | ACTIVE | ARCHIVED, mặc định INBOX"
        date entryDate "ngày của note theo giờ địa phương, client gửi"
        boolean pinned
        int version "tăng mỗi lần sửa"
        datetime createdAt
        datetime updatedAt
        datetime deletedAt "xóa mềm"
        tsvector search "generated column"
    }
    Tag {
        uuid id PK
        string name "unique, chữ thường"
    }
    NoteTag {
        uuid noteId FK
        uuid tagId FK
    }
```

App chỉ có một người dùng nên **không có bảng `User` và không có cột `userId`**.

**Note theo ngày:** không có loại note "daily" riêng. Note nào cũng có `entryDate`, và một ngày có bao nhiêu note cũng được. Trang "Hôm nay" chỉ là truy vấn `WHERE "entryDate" = <ngày>`. Có `entryDate` riêng, không dùng thẳng `createdAt`, vì hai lý do:

- `createdAt` là timestamp UTC. Note viết lúc 6h sáng giờ Việt Nam (UTC+7) sẽ bị tính sang ngày hôm trước. `entryDate` là ngày theo giờ địa phương, do frontend gửi lên (bắt buộc; DB không có default vì `CURRENT_DATE` tính theo UTC). Outbox lưu `entryDate` lúc ghi, không phải lúc gửi được.
- Cho phép ghi lùi ngày, ví dụ sáng nay mới viết nhật ký của tối hôm qua.

**Xung đột khi sửa:** `PATCH /notes/:id` gửi kèm `version` mà client đang có. Nếu khác `version` trong DB, API trả `409` kèm bản hiện tại để frontend báo cho bạn chọn giữ bản nào. Sửa thành công thì `version` tăng 1.

**Tìm kiếm:** dùng full-text search có sẵn của PostgreSQL, chưa cần Elasticsearch. Ba điểm cần làm đúng:

- `unaccent()` không phải hàm `IMMUTABLE` nên không dùng thẳng trong generated column được. Phải bọc lại.
- Dùng config `'simple'`, không dùng `'english'`: stemming tiếng Anh làm hỏng từ tiếng Việt.
- Full-text chỉ khớp nguyên từ. Để gõ "dock" ra "docker", query dùng prefix: mỗi từ người dùng gõ thành `từ:*`, nối bằng `&`.

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

ALTER TABLE "Note" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') ||
  setweight(to_tsvector('simple', f_unaccent(coalesce("content", ''))), 'B')
) STORED;

CREATE INDEX "Note_search_idx" ON "Note" USING GIN ("search");
```

Với TypeORM:

- Cột `search` khai báo trong entity: `@Column({ type: 'tsvector', generatedType: 'STORED', asExpression: '...', select: false, insert: false, update: false })`, với `asExpression` đúng như biểu thức trong SQL trên.
- Migration đầu tiên sinh bằng `typeorm migration:generate`, rồi thêm tay `CREATE EXTENSION unaccent` và `CREATE FUNCTION f_unaccent` vào đầu hàm `up()`, vì cột generated cần hàm này có trước. Migration sinh ra có dòng `INSERT INTO "typeorm_metadata"` cho cột generated: giữ nguyên, và tên DB phải là `notebook` ở mọi môi trường.
- GIN index khai báo bằng `@Index('Note_search_idx', ['search'], { type: 'gin' })` (TypeORM 1.x), migration tự sinh ra.
- CI chạy `migration:check` (`migration:generate --check`) để chắc không còn khác biệt nào giữa entity và DB.
- Bảng ghi tên tường minh (`@Entity('Note')`, `@JoinTable({ name: 'NoteTag' })`). Quan hệ ManyToMany ghi `onDelete: 'CASCADE'` ở cả hai phía.
- `type`, `status` là `varchar` + `CHECK`, danh sách giá trị lấy từ hằng trong `packages/shared`.
- Tên tag chuẩn hóa ở zod: trim, NFC, chữ thường. Nên chuẩn hóa NFC cả `title` và `content`.
- Query search bằng QueryBuilder: `.where("note.search @@ to_tsquery('simple', :q)")`, sắp xếp theo `ts_rank`.

**Xóa mềm:** `deletedAt` là `@DeleteDateColumn`, dùng `softDelete()`, `restore()` và `withDeleted: true` khi xem thùng rác.

**Kiểm tra `version`:** dùng cột `int` thường, **không** dùng `@VersionColumn` (nó tự tăng cả khi `save()`, `softDelete()`, `restore()` và không chặn ghi đè). `PATCH` phải update có điều kiện `WHERE id = :id AND version = :version` kèm `version = version + 1`; không có dòng nào được cập nhật thì trả `409`.

**Index:** `entryDate`, `status`, kèm điều kiện `WHERE "deletedAt" IS NULL`: khai báo bằng `@Index({ where: '"deletedAt" IS NULL' })`.

## 8. API chính (NestJS)

Mọi endpoint đều yêu cầu cookie đăng nhập, trừ `/health` và `/auth/login`. Next.js rewrite bỏ tiền tố `/api`, nên `/api/notes` trên trình duyệt thành `/notes` ở NestJS.

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/health` | Kiểm tra API và kết nối DB |
| `POST` | `/auth/login` | Kiểm tra mật khẩu, set cookie |
| `POST` | `/auth/logout` | Xóa cookie |
| `GET` | `/notes?q=&type=&tag=&status=&date=&trashed=&page=` | Danh sách note có lọc. `q` để tìm kiếm, `date=2026-10-26` cho trang Hôm nay, `trashed=true` để xem thùng rác |
| `GET` | `/notes/:id` | Chi tiết một note |
| `POST` | `/notes` | Tạo note với `id` do client gửi. Nếu `id` đã tồn tại thì trả về note đó (để outbox gửi lại an toàn) |
| `PATCH` | `/notes/:id` | Sửa note, gửi kèm `version`. Lệch phiên bản thì trả `409` |
| `DELETE` | `/notes/:id` | Xóa mềm (vào thùng rác) |
| `POST` | `/notes/:id/restore` | Khôi phục từ thùng rác |
| `DELETE` | `/notes/:id/permanent` | Xóa vĩnh viễn một note trong thùng rác |
| `GET` | `/days?from=&to=` | Số note của từng ngày trong khoảng (cho lịch và heatmap) |
| `GET` | `/tags` | Danh sách tag và số note của mỗi tag |
| `PATCH` | `/tags/:id` | Đổi tên tag |
| `DELETE` | `/tags/:id` | Xóa tag (gỡ khỏi mọi note) |
| `GET` | `/export` | Tải file `.zip` chứa toàn bộ note dạng `.md` (stream, không dựng file tạm) |

## 9. Cấu trúc thư mục

```
notebook/
├── apps/
│   ├── web/                  # Next.js → deploy lên Vercel
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/outbox.ts     # hàng đợi IndexedDB cho note mới
│   │   └── next.config.ts    # rewrites /api/* → API_URL
│   └── api/                  # NestJS → Docker trên server ở nhà
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/          # mỗi tính năng một module: controller, service, entity, test
│       │   │   ├── auth/
│       │   │   ├── notes/
│       │   │   ├── tags/
│       │   │   ├── export/
│       │   │   └── health/
│       │   ├── common/           # dùng chung giữa các module: guard, decorator (@Public), filter, pipe
│       │   ├── types/            # type chỉ dùng ở backend (type dùng chung với web để ở packages/shared)
│       │   └── database/
│       │       ├── data-source.ts  # cấu hình TypeORM, dùng cho cả app và CLI
│       │       └── migrations/
│       └── Dockerfile
├── packages/
│   └── shared/               # type, zod schema dùng chung
├── scripts/
│   └── backup.sh             # pg_dump → age → rclone
├── docker-compose.yml        # postgres + api
├── .env.example
├── pnpm-workspace.yaml
└── PROJECT.md                # tài liệu này
```

## 10. Docker & deploy

### 10.1 Dev ở máy local

```bash
docker compose up -d    # PostgreSQL + NestJS API (3001)
pnpm --filter web dev   # Next.js tại http://localhost:3000, API_URL=http://localhost:3001
```

Next.js chạy ngoài Docker khi dev để hot reload nhanh hơn.

### 10.2 Dockerfile cho API (multi-stage)

1. **deps**: cài dependencies bằng pnpm.
2. **build**: `nest build` (migration được biên dịch cùng vào `dist/`).
3. **runtime**: image `node:*-alpine` gọn, chỉ chứa `dist/` và production dependencies, chạy bằng user không phải root. TypeORM bật `migrationsRun: true` nên tự chạy migration còn thiếu lúc khởi động, trước khi nhận request.

### 10.3 Server ở nhà

- docker compose với `restart: unless-stopped` cho mọi service; bật Docker khởi động cùng máy.
- API publish `127.0.0.1:3001:3001` (chỉ máy đó gọi được). PostgreSQL không publish port.
- Tailscale Funnel: bật Funnel cho tailnet trong trang admin, rồi chạy `tailscale funnel --bg 3001`. URL public là `https://<máy>.<tailnet>.ts.net`.
- Deploy bản mới: `git pull && docker compose up -d --build`.

### 10.4 Luồng deploy

```mermaid
flowchart LR
    G[git push main] --> V[Vercel tự build<br/>apps/web]
    G --> GA[GitHub Actions<br/>lint + test + build]
    G -. "trên server" .-> S[git pull<br/>docker compose up -d --build]
    S --> M[TypeORM chạy migration<br/>lúc API khởi động]
```

Trên Vercel: Root Directory là `apps/web`, đặt biến `API_URL`.

### 10.5 Đổi sang Cloudflare Tunnel sau này

Khi mua domain riêng và muốn đổi, không mất dữ liệu, không bị đăng xuất (cookie gắn với domain Vercel):

1. Chuyển DNS của domain về Cloudflare, cài `cloudflared`, tạo named tunnel trỏ vào `localhost:3001`.
2. Chạy song song với Funnel, thử URL mới.
3. Sửa `API_URL` trên Vercel sang URL mới, redeploy.
4. Tắt Funnel.

Điều kiện để việc đổi dễ như trên: không hardcode URL `ts.net` ở đâu ngoài `API_URL`, và giới hạn đăng nhập không dựa vào IP client (mỗi lớp proxy truyền IP bằng header khác nhau).

### 10.6 Backup

**Cài đặt một lần**

1. **Khóa mã hóa (trên laptop):** `age-keygen -o notebook-backup.key`. Public key (`age1...`) đưa lên server làm `AGE_RECIPIENT`. Private key cất vào trình quản lý mật khẩu, **không để trên server**: hỏng server hay lộ Drive đều không ảnh hưởng, nhưng mất khóa này là mất khả năng khôi phục.
2. **Quyền ghi Google Drive:** trên server chạy `rclone config`, tạo remote `gdrive` loại `drive`, scope `drive.file` (rclone chỉ thấy file do chính nó tạo), chọn không auto config. Chạy lệnh `rclone authorize "drive" "..."` mà rclone in ra trên laptop có trình duyệt, đăng nhập Google, dán token ngược về server. Kiểm tra bằng `rclone mkdir gdrive:notebook-backups`.
3. **Crontab trên server:** `0 3 * * * /opt/notebook/scripts/backup.sh >> /var/log/notebook-backup.log 2>&1`.

Lưu ý:
- Để trống client ID thì rclone dùng client dùng chung, đủ cho một file mỗi đêm. Nếu tự tạo OAuth client trên Google Cloud, phải chuyển app sang **In production**; để ở Testing thì token hết hạn sau 7 ngày và backup ngừng chạy mà không báo.
- Service account không dùng được với Gmail cá nhân (không có dung lượng My Drive), phải dùng OAuth như trên.
- Xóa file trên Drive mặc định chỉ vào thùng rác, vẫn tính dung lượng, nên dùng `--drive-use-trash=false`.

**Script `scripts/backup.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .env.backup            # AGE_RECIPIENT, RCLONE_REMOTE

name="notebook_$(date +%F_%H%M).dump.age"

docker compose exec -T postgres pg_dump -U notebook -Fc notebook \
  | age -r "$AGE_RECIPIENT" \
  | rclone rcat "$RCLONE_REMOTE/$name"

rclone delete --min-age 30d --drive-use-trash=false "$RCLONE_REMOTE"
echo "$(date -Is) OK $name"
```

Stream thẳng lên Drive, không ghi file tạm. `pipefail` làm script báo lỗi nếu `pg_dump` hỏng thay vì đẩy file rỗng lên. Host chỉ cần cài `age` và `rclone`, không cần Postgres client.

**Theo dõi:** khi kiểm tra server hằng ngày, xem `tail -3 /var/log/notebook-backup.log` có dòng `OK` của đêm qua. Tùy chọn: thêm `curl` ping Healthchecks.io (miễn phí) cuối script để được email khi backup không chạy.

**Thử khôi phục mỗi tháng** (chạy nơi có private key):

```bash
rclone copy gdrive:notebook-backups/<file>.dump.age .
docker compose exec -T postgres createdb -U notebook restore_test
age -d -i notebook-backup.key <file>.dump.age \
  | docker compose exec -T postgres pg_restore -U notebook -d restore_test
# kiểm tra dữ liệu rồi dropdb restore_test
```

Export `.md` là lớp dự phòng thứ hai.

### 10.7 Biến môi trường

| Biến | Dùng ở | Ví dụ |
|---|---|---|
| `DATABASE_URL` | api | `postgresql://notebook:pass@postgres:5432/notebook` |
| `APP_PASSWORD` | api | mật khẩu (từ 10 ký tự) |
| `SESSION_SECRET` | api | chuỗi ngẫu nhiên dài, dùng ký cookie |
| `PORT` | api | `3001` |
| `API_URL` | web | `https://<máy>.<tailnet>.ts.net` (đích của rewrite) |
| `AGE_RECIPIENT` | backup | public key của `age` |
| `RCLONE_REMOTE` | backup | `gdrive:notebook-backups` |

## 11. Bảo mật & riêng tư

- **Auth một mật khẩu:** `POST /auth/login` so sánh với `APP_PASSWORD` bằng `timingSafeEqual`. Đúng thì set cookie chứa thời điểm cấp, ký bằng HMAC với `SESSION_SECRET`, hạn 1 năm. Một guard toàn cục kiểm tra chữ ký và hạn của cookie ở mọi request; route không cần đăng nhập đánh dấu bằng decorator `@Public()`.
- **Đăng xuất mọi thiết bị:** đổi `SESSION_SECRET` rồi restart API.
- Cookie đặt `httpOnly`, `Secure`, `SameSite=Lax`.
- **Giới hạn đăng nhập toàn cục**, không theo IP: tối đa 5 lần sai mỗi 15 phút.
- Funnel chỉ mở port của API. PostgreSQL không mở port, router không mở port nào.
- File `.env` không commit. Bản backup được mã hóa trước khi rời server.

## 12. Lộ trình

| Giai đoạn | Việc chính | Xong khi |
|---|---|---|
| **0. Khung dự án** | Monorepo pnpm, docker compose (postgres + api), TypeORM entity + migration cho search, CI lint/test | `docker compose up` chạy được, web local gọi được API |
| **1. Lõi** | Auth một mật khẩu, CRUD note có `version`, tag, editor Markdown và preview | Đăng nhập, viết, sửa, xóa được note có tag |
| **2. Dùng hằng ngày** | Tìm kiếm, trang Hôm nay và lịch, inbox / quick capture + outbox, chế độ đọc, thùng rác + cron dọn | Dùng thay được cách ghi chú hiện tại |
| **3. Lên mạng** | Server ở nhà + Tailscale Funnel, deploy Vercel, PWA, backup Google Drive, export | Mở được trên điện thoại ở bất cứ đâu, có backup hằng đêm |
| **4. Nâng cao** | Backlinks, flashcard, heatmap, upload ảnh, AI | Tùy nhu cầu, làm dần |

## 13. Câu hỏi còn mở

- [ ] Bài viết dài có cần ảnh sớm không? Nếu có, đưa upload ảnh từ Giai đoạn 4 lên Giai đoạn 2.

### Đã chốt

- Editor: viết Markdown thô bằng CodeMirror 6, preview riêng; không làm WYSIWYG.
- Note mới (cả "Note mới" lẫn quick capture) mặc định `status = INBOX`, đúng vòng đời ở mục 3.
- Host NestJS: server ở nhà, đưa ra internet bằng Tailscale Funnel; có thể đổi sang Cloudflare Tunnel khi có domain.
- Offline: không làm offline-first; chỉ có outbox cho việc tạo note.
- Public note / blog: không. Mọi nội dung chỉ mình bạn đọc.
