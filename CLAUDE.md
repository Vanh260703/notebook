# CLAUDE.md

Đặc tả đầy đủ của dự án nằm ở [PROJECT.md](PROJECT.md). Đọc nó trước khi thiết kế hay viết code.

## Stack của dự án (ưu tiên hơn mặc định của agent)

- Monorepo pnpm workspaces: `apps/web` (Next.js App Router → Vercel), `apps/api` (NestJS → Docker), `packages/shared` (type, zod schema dùng chung).
- Backend: NestJS + **TypeORM** (`synchronize: false`, chỉ đổi schema qua migration) + PostgreSQL (full-text search bằng `tsvector` + GIN + `f_unaccent`), chạy docker compose trên server ở nhà, đưa ra internet bằng Tailscale Funnel.
- Frontend: Next.js trên Vercel, Tailwind, shadcn/ui, CodeMirror 6, react-markdown, TanStack Query (fetch phía client), outbox IndexedDB cho note mới.
- Auth: một mật khẩu trong env + cookie httpOnly ký HMAC, guard toàn cục, `@Public()` cho route mở. Không có bảng `User`, không có `userId`, không JWT.
- Validation: zod trong `packages/shared`, NestJS dùng `ZodValidationPipe`. Không dùng class-validator.
- Next.js proxy `/api/*` sang `API_URL` bằng `rewrites`, cùng một domain nên không cần CORS. Không hardcode URL của API ở chỗ nào khác.

Nếu một agent đề xuất công nghệ khác (Prisma, Drizzle, Hono, tRPC, microservices, Kafka...), hãy theo stack ở trên. Chỉ đổi khi đã hỏi người dùng.

## Subagent trong `.claude/agents/`

| Agent | Dùng khi |
|---|---|
| `backend-architect` | Thiết kế/review TypeORM entity và migration, API contract (mục 7–8 của PROJECT.md), search, auth, Dockerfile, luồng deploy. Chỉ thiết kế, không viết code triển khai. Dự án này là monolith NestJS nhỏ cho một người dùng, đừng thiết kế quá tay. |
| `fullstack-developer` | Làm một tính năng trọn vẹn từ TypeORM entity → NestJS module → trang Next.js (ví dụ CRUD note, trang Hôm nay, inbox). Dùng type/zod chung trong `packages/shared`. |
| `ui-ux-designer` | Review giao diện, layout, mobile/PWA, accessibility, editor và luồng ghi nhanh. Agent này chỉ đọc, không sửa file. |

Gợi ý quy trình cho mỗi giai đoạn trong lộ trình (mục 12):
1. `backend-architect` chốt schema và API cho phần sắp làm.
2. `fullstack-developer` triển khai.
3. `ui-ux-designer` review phần giao diện vừa làm, sau đó sửa theo góp ý.
