# Thiết kế Giai đoạn 1 ("Lõi")

Các API thư viện dưới đây đã đối chiếu với mã thật trong `node_modules`:
- **TypeORM 1.1.2:** `UpdateQueryBuilder` và `SoftDeleteQueryBuilder` tự set `updatedAt`. `InsertQueryBuilder.orIgnore()` sinh `ON CONFLICT DO NOTHING`. `QueryFailedError` có `driverError` và chép luôn `code` của pg lên chính nó.
- **nestjs-zod 5.5:** `ZodValidationException` có `getZodError()`.
- **zod 4.6.7:** có `z.iso.date()` (từ chối `2026-02-30`), `z.stringbool()`, `z.int32()`.
- **Next 16:** `middleware` đổi tên thành `proxy.ts`, chạy runtime Node.
- **Node 22:** `process.loadEnvFile` không ghi đè biến đã có sẵn.

---

## 1. Auth

### 1.1 Cookie

| Thuộc tính | Giá trị |
|---|---|
| Tên | `nb_session` (không dùng tiền tố `__Host-`: nó bắt buộc `Secure`, nên dev trên http sẽ hỏng; `vercel.app` lại nằm trong Public Suffix List nên app khác không set cookie đè được) |
| Giá trị | `v1.<issuedAtGiây>.<base64url(HMAC-SHA256(SESSION_SECRET, "v1.<issuedAt>"))>` |
| `HttpOnly` | luôn bật |
| `Secure` | theo `COOKIE_SECURE` (mặc định `true`) |
| `SameSite` | `Lax` |
| `Path` | **`/` ghi tường minh** (xem rủi ro số 1) |
| `Domain` | **không đặt**, để thành cookie host-only của domain trình duyệt đang thấy |
| `Max-Age` | 365 ngày. Express nhận `maxAge` tính bằng **ms** |

```ts
// modules/auth/session.service.ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'nb_session';
const MAX_AGE_S = 365 * 24 * 3600;
const CLOCK_SKEW_S = 300;

@Injectable()
export class SessionService {
  constructor(@Inject(AUTH_CONFIG) private readonly cfg: AuthConfig) {}

  private mac(payload: string): Buffer {
    return createHmac('sha256', this.cfg.sessionSecret).update(payload).digest();
  }

  issue(now = Date.now()): { value: string; expiresAt: string } {
    const iat = Math.floor(now / 1000);
    const payload = `v1.${iat}`;
    return {
      value: `${payload}.${this.mac(payload).toString('base64url')}`,
      expiresAt: new Date((iat + MAX_AGE_S) * 1000).toISOString(),
    };
  }

  /** Trả về iat (giây) nếu hợp lệ, null nếu không. Không bao giờ throw. */
  verify(value: string | undefined, now = Date.now()): number | null {
    if (!value) return null;
    const [ver, iatStr, sig, ...rest] = value.split('.');
    if (rest.length || ver !== 'v1' || !iatStr || !/^\d{1,12}$/.test(iatStr) || !sig) return null;
    const expected = this.mac(`${ver}.${iatStr}`);
    const got = Buffer.from(sig, 'base64url');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null; // check độ dài trước, nếu không timingSafeEqual sẽ throw
    const iat = Number(iatStr);
    const nowS = Math.floor(now / 1000);
    if (iat > nowS + CLOCK_SKEW_S || nowS - iat > MAX_AGE_S) return null;
    return iat;
  }

  cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.cfg.cookieSecure, sameSite: 'lax', path: '/', maxAge: MAX_AGE_S * 1000 };
  }
  clearOptions(): CookieOptions {
    const { maxAge: _, ...o } = this.cookieOptions();
    return o; // res.clearCookie phải dùng cùng path/secure/sameSite
  }
}

// common/http/read-cookie.ts: Express 5 không parse cookie, không cần cài cookie-parser
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
}
```

Tự gia hạn cookie (cấp lại trong `/auth/me` khi cookie đã hơn 30 ngày): không làm ở Giai đoạn 1. Thêm sau chỉ mất vài dòng.

### 1.2 `Secure` khi dev và khi đi qua proxy

- `res.cookie()` của Express chỉ ghi thuộc tính `Secure` vào header, không kiểm tra `req.secure`. Vì vậy **không cần `trust proxy`**: Funnel hay Next nói chuyện với API bằng http cũng không sao.
- **Không bật/tắt theo `NODE_ENV`.** Container API trên laptop cũng chạy `NODE_ENV=production`. Dùng biến riêng `COOKIE_SECURE` (`true` | `false`, mặc định `true`):
  - Chrome và Firefox chấp nhận cookie `Secure` trên `http://localhost`, nên đa số trường hợp dev không cần tắt.
  - Safari (ít nhất là một số bản) không lưu cookie `Secure` trên `http://localhost`.
  - Thử từ điện thoại qua IP LAN `http://192.168.x.x:3000` thì trình duyệt nào cũng bỏ cookie `Secure`.
  - Hai trường hợp trên thì đặt `COOKIE_SECURE=false` trong `apps/api/.env`.
- Khi `COOKIE_SECURE=false`, log `warn` lúc khởi động.
- Thêm `COOKIE_SECURE: ${COOKIE_SECURE:-true}` vào `docker-compose.yml` và ghi chú vào hai file `.env.example`.

### 1.3 Set-Cookie khi đi qua rewrite của Next

- **Xác nhận được:** rewrite tới URL ngoài (cả `next dev` lẫn Vercel) chuyển nguyên header `Set-Cookie` và `Cookie`, không viết lại domain. Cookie không có `Domain` nên trình duyệt gắn nó với host đang thấy: `localhost` khi dev, `<app>.vercel.app` khi chạy thật. Đúng với mục 5.3.
- **Rủi ro cần chặn:**
  - **`Path`.** Trình duyệt gọi `/api/auth/login`, nên nếu thiếu `Path` thì path mặc định là `/api/auth`. Khi đó cookie không được gửi kèm `/api/notes`: đăng nhập "thành công" nhưng mọi request sau đều 401.
  - **Không bao giờ đặt `Domain`.**
  - **Mỗi URL preview của Vercel là một host riêng**, nên phải đăng nhập riêng. Chấp nhận.
  - **Cache.** Thêm middleware toàn cục `Cache-Control: no-store` trong `main.ts` cho mọi response API, để CDN của Vercel không bao giờ cache response có `Set-Cookie` hay dữ liệu note. Export ở Giai đoạn 3 tự đặt header riêng.
  - **Route handler trùng tên.** Không tạo `app/api/**/route.ts` trong web: nó sẽ che mất rewrite.

### 1.4 So sánh mật khẩu

```ts
// modules/auth/auth.service.ts
private readonly expected = sha256(this.cfg.appPassword.normalize('NFC')); // tính một lần
checkPassword(input: string): boolean {
  return timingSafeEqual(sha256(input.normalize('NFC')), this.expected); // cùng 32 byte, độ dài khác nhau cũng không lộ
}
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();
```

### 1.5 Guard toàn cục và `@Public()`

- `src/common/decorators/public.decorator.ts` chứa `export const IS_PUBLIC_KEY = 'isPublic'; export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);`
- Guard đặt ở `modules/auth/session.guard.ts`, không đặt trong `common`: nó phụ thuộc `SessionService`, để cạnh auth thì `common` không phải import ngược vào module. Đăng ký bằng `{ provide: APP_GUARD, useClass: SessionGuard }` trong `AuthModule`. APP_GUARD khai báo ở module nào cũng có hiệu lực toàn app.

```ts
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly session: SessionService) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    if (this.session.verify(readCookie(req.headers.cookie, SESSION_COOKIE)) !== null) return true;
    throw new UnauthorizedException({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Chưa đăng nhập' });
  }
}
```

- Route public: `HealthController` (**nhớ thêm `@Public()`**), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- `GET /auth/me` để public và luôn trả `200 { authenticated, expiresAt }`. Màn hình login không bị lỗi 401 vô nghĩa trong console, và logic phía client đơn giản hơn.

### 1.6 Giới hạn đăng nhập

- Tự viết khoảng 20 dòng, **không dùng `@nestjs/throttler`**. Throttler đếm mọi request chứ không chỉ lần sai, mặc định lại theo IP (mục 10.5 cấm), muốn dùng phải viết tracker và storage riêng nên còn dài hơn.
- Lưu in-memory là đủ: chỉ có một process, attacker không restart được server.

```ts
@Injectable()
export class LoginRateLimiter {
  static readonly MAX = 5;
  static readonly WINDOW_MS = 15 * 60_000;
  private failures: number[] = []; // timestamp, cửa sổ trượt

  private prune(now: number) { this.failures = this.failures.filter((t) => now - t < LoginRateLimiter.WINDOW_MS); }
  retryAfterSeconds(now = Date.now()): number {
    this.prune(now);
    if (this.failures.length < LoginRateLimiter.MAX) return 0;
    return Math.ceil((this.failures[0] + LoginRateLimiter.WINDOW_MS - now) / 1000);
  }
  recordFailure(now = Date.now()) { this.prune(now); this.failures.push(now); }
  reset() { this.failures = []; }
}
```

Luồng xử lý `login`:
1. Nếu `retryAfterSeconds() > 0`: trả **429** `{ code: 'TOO_MANY_ATTEMPTS', retryAfter }` kèm header `Retry-After: <giây>`, **không kiểm tra mật khẩu**. Nếu vẫn kiểm tra trong lúc bị khóa thì attacker đoán được không giới hạn.
2. Sai mật khẩu: `recordFailure()`, trả **401** `INVALID_PASSWORD`. Lần sai thứ 5 vẫn là 401, từ lần thứ 6 mới là 429.
3. Đúng mật khẩu: `reset()`, set cookie, trả `200 Session`.

Header `Retry-After` do exception filter đặt từ `body.retryAfter`, để không phụ thuộc vào `@Res`.

### 1.7 Fail fast khi khởi động

```ts
// common/config/auth-env.ts. KHÔNG gọi trong data-source.ts: CLI migration trong CI không có APP_PASSWORD.
const authEnvSchema = z
  .object({
    APP_PASSWORD: z.string().min(10, 'APP_PASSWORD phải từ 10 ký tự'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET phải từ 32 ký tự'),
    COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  })
  .refine((e) => e.APP_PASSWORD !== e.SESSION_SECRET, 'APP_PASSWORD và SESSION_SECRET phải khác nhau')
  .refine((e) => ![e.APP_PASSWORD, e.SESSION_SECRET].some((v) => v.startsWith('change-me')), 'Còn giá trị mẫu từ .env.example');
// giá trị mẫu "change-me-at-least-10-chars" vẫn qua được min(10) nếu không có refine này

export function parseAuthEnv(env: NodeJS.ProcessEnv): AuthConfig { /* safeParse, lỗi thì throw Error có danh sách issue; KHÔNG in giá trị */ }
```

- Cung cấp qua `{ provide: AUTH_CONFIG, useFactory: () => parseAuthEnv(process.env) }` trong `AuthModule`.
- Thiếu hoặc sai biến thì `NestFactory.create` throw, process thoát, docker restart lặp với log rõ ràng.
- Test thì override provider này.

### 1.8 CSRF

`SameSite=Lax` và quy tắc "mọi thay đổi đều không dùng GET" là đủ:
- Với request cross-site, trình duyệt chỉ gửi cookie Lax khi điều hướng top-level bằng GET.
- `*.vercel.app` nằm trong Public Suffix List, nên app Vercel khác cũng tính là cross-site.
- Đã đặt `SameSite` tường minh nên Chrome không áp ngoại lệ "Lax-by-default 2 phút cho POST".
- Body chỉ là JSON (`ZodValidationPipe` từ chối body rỗng hoặc sai). Form cross-site không gửi được `application/json` nếu không qua preflight, mà API không bật CORS.

Điều kiện bắt buộc: **không endpoint GET nào có side effect.** Không cần CSRF token.

---

## 2. Zod schema trong `packages/shared`

```ts
// note.ts (thêm vào file hiện có)
import { z } from 'zod';
import { tagNameSchema, tagSchema } from './tag';

export const NOTE_DEFAULT_TYPE = 'LEARNING' satisfies NoteType;
export const NOTE_DEFAULT_STATUS = 'INBOX' satisfies NoteStatus;
export const NOTE_TITLE_MAX = 300;
export const NOTE_CONTENT_MAX = 200_000; // ký tự; body limit API là 1 MB (tiếng Việt tối đa ~3 byte/ký tự)
export const NOTE_TAGS_MAX = 20;
export const NOTE_EXCERPT_LENGTH = 300;
export const LIST_LIMIT_DEFAULT = 50;
export const LIST_LIMIT_MAX = 100;

const titleSchema = z.string().trim().normalize('NFC').max(NOTE_TITLE_MAX);
const contentSchema = z.string().normalize('NFC').max(NOTE_CONTENT_MAX); // không trim: khoảng trắng có nghĩa trong Markdown
export const entryDateSchema = z.iso.date(); // 'YYYY-MM-DD', theo giờ địa phương của client
const tagNamesSchema = z
  .array(tagNameSchema)
  .max(NOTE_TAGS_MAX)
  .transform((names) => [...new Set(names)]); // bỏ trùng SAU khi chuẩn hóa ("Docker" và "docker" là một)

// ---- Request ----
export const createNoteSchema = z.strictObject({
  id: z.uuid(),
  entryDate: entryDateSchema,
  title: titleSchema.default(''),
  content: contentSchema.default(''),
  type: noteTypeSchema.default(NOTE_DEFAULT_TYPE),
  status: noteStatusSchema.default(NOTE_DEFAULT_STATUS),
  pinned: z.boolean().default(false),
  tags: tagNamesSchema.default([]),
});

export const updateNoteSchema = z
  .strictObject({
    version: z.int32().min(1),
    title: titleSchema.optional(),
    content: contentSchema.optional(),
    type: noteTypeSchema.optional(),
    status: noteStatusSchema.optional(),
    entryDate: entryDateSchema.optional(),
    pinned: z.boolean().optional(),
    tags: tagNamesSchema.optional(), // có thì THAY TOÀN BỘ danh sách tag
  })
  .refine(({ version: _, ...rest }) => Object.values(rest).some((v) => v !== undefined), {
    message: 'Cần ít nhất một trường để sửa',
  });

export const listNotesQuerySchema = z.object({ // không strict: bỏ qua query lạ (cache-buster...)
  q: z.string().trim().normalize('NFC').max(200).transform((v) => v || undefined).optional(), // GĐ2: GĐ1 trả 501
  type: noteTypeSchema.optional(),
  status: noteStatusSchema.optional(),        // không gửi = mọi status
  tag: tagNameSchema.optional(),              // một tag; sau này đổi thành mảng vẫn tương thích ngược
  date: entryDateSchema.optional(),           // GĐ1 làm luôn (một WHERE), UI ở GĐ2
  trashed: z.stringbool().default(false),     // GĐ1 làm API, UI ở GĐ2
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
});

// ---- Response ----
export const noteSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  content: z.string(),
  type: noteTypeSchema,
  status: noteStatusSchema,
  entryDate: z.iso.date(),
  pinned: z.boolean(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  tags: z.array(tagSchema), // sắp theo name
});
export const noteListItemSchema = noteSchema.omit({ content: true }).extend({ excerpt: z.string() });
export const noteListResponseSchema = z.object({
  items: z.array(noteListItemSchema),
  page: z.int(),
  limit: z.int(),
  total: z.int(),
  hasMore: z.boolean(),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteListItem = z.infer<typeof noteListItemSchema>;
export type NoteListResponse = z.infer<typeof noteListResponseSchema>;
export type CreateNoteInput = z.input<typeof createNoteSchema>;   // web dùng type này khi gửi
export type UpdateNoteInput = z.input<typeof updateNoteSchema>;
export type ListNotesQuery = z.input<typeof listNotesQuerySchema>;
```

```ts
// tag.ts (thêm)
export const tagSchema = z.object({ id: z.uuid(), name: z.string() });
export const tagWithCountSchema = tagSchema.extend({ noteCount: z.int() });
export const tagListResponseSchema = z.object({ items: z.array(tagWithCountSchema) });
export const renameTagSchema = z.strictObject({ name: tagNameSchema, merge: z.boolean().default(false) });
export type Tag = z.infer<typeof tagSchema>;
export type TagWithCount = z.infer<typeof tagWithCountSchema>;

// auth.ts
export const loginSchema = z.strictObject({ password: z.string().min(1).max(1024) });
export const sessionSchema = z.object({ authenticated: z.boolean(), expiresAt: z.iso.datetime().nullable() });
export type Session = z.infer<typeof sessionSchema>;

// error.ts
export const ERROR_CODES = [
  'VALIDATION_FAILED', 'BAD_REQUEST', 'UNAUTHORIZED', 'INVALID_PASSWORD', 'TOO_MANY_ATTEMPTS',
  'NOT_FOUND', 'NOTE_NOT_FOUND', 'NOTE_IN_TRASH', 'NOTE_NOT_IN_TRASH', 'VERSION_CONFLICT',
  'TAG_NOT_FOUND', 'TAG_NAME_TAKEN', 'CONFLICT', 'PAYLOAD_TOO_LARGE', 'NOT_IMPLEMENTED', 'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  statusCode: z.int(),
  code: z.string(), // để lỏng: client cũ không vỡ khi server thêm mã mới
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(), // path dạng "tags.0"
  retryAfter: z.int().optional(),
});
export const versionConflictErrorSchema = apiErrorSchema.extend({ code: z.literal('VERSION_CONFLICT'), current: noteSchema });
export const tagNameTakenErrorSchema = apiErrorSchema.extend({ code: z.literal('TAG_NAME_TAKEN'), existing: tagSchema });
export type ApiError = z.infer<typeof apiErrorSchema>;
```

**Ghép với nestjs-zod:** mỗi module có file `*.dto.ts`, ví dụ `export class CreateNoteDto extends createZodDto(createNoteSchema) {}`. Làm tương tự cho `UpdateNoteDto`, `ListNotesQueryDto`, `RenameTagDto`, `LoginDto`.
- `APP_PIPE ZodValidationPipe` hiện có tự validate mọi `@Body()` và `@Query()` có kiểu là ZodDto. Giá trị nhận được là **output** của schema, tức đã có default, đã chuẩn hóa và đã bỏ trùng.
- `:id` dùng `ParseUUIDPipe`.

**Có validate response không:** không bật `ZodSerializerInterceptor`.
- Service luôn trả qua mapper `toNoteDto(entity)`: đổi `Date` sang `toISOString()`, sắp tag theo name, có kiểu `Note` của shared nên TypeScript đã bắt lệch kiểu.
- Response schema dùng ở hai chỗ: e2e test (`noteSchema.parse(res.body)`) và client khi đọc lỗi 409.
- Bật interceptor sẽ phải xử lý chuyện `Date` khác `string` mà gần như không thêm được gì.

---

## 3. API contract

Lỗi luôn có dạng `ApiError`. Dưới đây "không có quyền" là `401 UNAUTHORIZED`, áp dụng cho mọi route không public.

### Auth

| Endpoint | Request | Thành công | Lỗi |
|---|---|---|---|
| `POST /auth/login` (public) | `{ password }` | `200 Session` + `Set-Cookie` | `400 VALIDATION_FAILED`, `401 INVALID_PASSWORD`, `429 TOO_MANY_ATTEMPTS` + `Retry-After` |
| `POST /auth/logout` (public) | không có body | `204`, xóa cookie | không |
| `GET /auth/me` (public) | không | `200 { authenticated, expiresAt \| null }` | không |

### Notes

**`GET /notes?…`** trả `200 NoteListResponse`.
- **Phân trang offset** (`page`, `limit`), có `total` lấy từ `getCount()`. Một người dùng, vài nghìn note, không cần cursor.
- **Item không có `content`**, chỉ có `excerpt = left(content, 300)` tính trong SQL; client tự bỏ ký hiệu Markdown khi hiển thị. GĐ2 có thể thêm field `snippet` (từ `ts_headline`) mà không phá contract.
- **Thứ tự do server chọn theo chế độ**, không có tham số `sort`:
  - mặc định: `pinned DESC, "updatedAt" DESC, id DESC` (thêm `id` để offset ổn định)
  - `trashed=true`: `"deletedAt" DESC`
  - có `date`: `"createdAt" ASC` (dòng thời gian)
  - có `q` (GĐ2): `ts_rank DESC, "updatedAt" DESC`
- `trashed=true`: `withDeleted()` + `"deletedAt" IS NOT NULL`. Các filter khác vẫn áp dụng.
- `tag`: `EXISTS (SELECT 1 FROM "NoteTag" nt JOIN "Tag" t ON t.id = nt."tagId" WHERE nt."noteId" = note.id AND t.name = :tag)`.
- `q` ở GĐ1: `501 NOT_IMPLEMENTED`. Không lờ đi im lặng, vì client sẽ tưởng là đã lọc.
- **Không lọc `status` mặc định.** Note mới là INBOX mà GĐ1 chưa có UI Inbox; nếu mặc định chỉ hiện ACTIVE thì note vừa viết sẽ biến mất khỏi danh sách.
- Cách làm: một QueryBuilder chọn các cột trừ `content` + `addSelect('left(note.content, 300)', 'excerpt')` + `.offset().limit()` (không join nên không dính bẫy skip/take). Sau đó một query lấy tag cho các id trong trang: `WHERE nt."noteId" = ANY($1)`.

**`GET /notes/:id`** trả `200 Note`, **kể cả khi note đang trong thùng rác** (`deletedAt` khác null; UI hiện banner, chỉ cho đọc). Lỗi: `400` (uuid sai), `404 NOTE_NOT_FOUND`.

**`POST /notes`** nhận `CreateNoteInput`, idempotent theo `id`:
- `201 Note`: vừa tạo.
- `200 Note`: `id` đã tồn tại. Trả **bản trong DB, không so sánh payload, không ghi đè**. Outbox coi cả 2xx là thành công.
- `id` đã tồn tại và note **đã bị xóa mềm**: vẫn `200`, trả note có `deletedAt`, **không khôi phục**. Trường hợp này chỉ xảy ra khi response lần đầu bị mất mà bạn đã kịp xóa note.
- Note đã xóa vĩnh viễn rồi bị gửi lại thì sẽ được tạo lại. Hiếm, chấp nhận.
- Lỗi: `400 VALIDATION_FAILED`, `413`.

```ts
// notes.service.ts
async create(dto: CreateNoteDto): Promise<{ created: boolean; note: Note }> {
  return this.dataSource.transaction(async (em) => {
    const { tags, ...fields } = dto;
    const res = await em.createQueryBuilder()
      .insert().into(NoteEntity).values({ ...fields, version: 1 })
      .orIgnore()                 // ON CONFLICT DO NOTHING
      .returning(['id']).updateEntity(false)
      .execute();
    const created = (res.raw as unknown[]).length > 0;
    if (created && tags.length) await this.tags.replaceNoteTags(em, fields.id, tags);
    const note = await em.findOneOrFail(NoteEntity, { where: { id: fields.id }, withDeleted: true, relations: { tags: true } });
    return { created, note: toNoteDto(note) };
  });
}
// controller: @Res({ passthrough: true }) res, rồi res.status(created ? 201 : 200)
```

**`PATCH /notes/:id`** nhận `UpdateNoteInput`: chỉ gửi trường đã đổi, `version` bắt buộc.
- `tags` (mảng tên) **thay toàn bộ liên kết**. Server tự upsert tag còn thiếu.
- **Mọi PATCH thành công đều tăng `version` một lần**, kể cả khi chỉ đổi tag hay pin.
- Trả `200 Note` (có tags, `version` mới).
- Lỗi: `400`, `404 NOTE_NOT_FOUND`, **`404 NOTE_IN_TRASH`** (sửa note đã xóa mềm), **`409 VERSION_CONFLICT` + `current: Note`**.

```ts
async update(id: string, dto: UpdateNoteDto): Promise<Note> {
  return this.dataSource.transaction(async (em) => {
    const { version, tags, ...rest } = dto;
    const fields = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const res = await em.createQueryBuilder()
      .update(NoteEntity)
      .set({ ...fields, version: () => '"version" + 1' })   // updatedAt do TypeORM tự set
      .where('"id" = :id AND "version" = :version AND "deletedAt" IS NULL', { id, version })
      .execute();
    if (!res.affected) {
      const cur = await em.findOne(NoteEntity, { where: { id }, withDeleted: true, relations: { tags: true } });
      if (!cur) throw new NotFoundException({ statusCode: 404, code: 'NOTE_NOT_FOUND', message: 'Không tìm thấy note' });
      if (cur.deletedAt) throw new NotFoundException({ statusCode: 404, code: 'NOTE_IN_TRASH', message: 'Note đang trong thùng rác' });
      throw new ConflictException({ statusCode: 409, code: 'VERSION_CONFLICT', message: 'Note đã được sửa ở nơi khác', current: toNoteDto(cur) });
    }
    if (tags) await this.tags.replaceNoteTags(em, id, tags);
    return toNoteDto(await em.findOneOrFail(NoteEntity, { where: { id }, relations: { tags: true } }));
  });
}
```

Vì sao đúng khi hai request đến cùng lúc: `UPDATE` khóa dòng. Ở READ COMMITTED, request thứ hai chờ, rồi Postgres tính lại điều kiện `version = :v` trên dòng mới nên không khớp và thành 409. Không bao giờ dùng `save()` cho PATCH.

```ts
// tags.service.ts: dùng chung cho create/update, luôn chạy trong em của transaction
async replaceNoteTags(em: EntityManager, noteId: string, names: string[]) {
  await em.query(`DELETE FROM "NoteTag" WHERE "noteId" = $1`, [noteId]);
  if (!names.length) return;
  await em.query(`INSERT INTO "Tag"("name") SELECT unnest($1::varchar[]) ON CONFLICT ("name") DO NOTHING`, [names]);
  await em.query(`INSERT INTO "NoteTag"("noteId","tagId") SELECT $1, id FROM "Tag" WHERE "name" = ANY($2::varchar[])`, [noteId, names]);
}
```

**`DELETE /notes/:id`** (xóa mềm):
- `204`, **không tăng `version`**: `version` đánh dấu phiên bản nội dung, và PATCH lên note đã xóa vẫn bị chặn bởi `deletedAt IS NULL`. `updatedAt` vẫn bị TypeORM tự cập nhật khi `softDelete`; chấp nhận.
- Xóa lại note đã ở trong thùng rác vẫn `204` (idempotent). Không có note thì `404`.

**Restore và permanent: làm API ngay ở GĐ1** (rẻ; UI GĐ1 chỉ dùng restore cho toast "Hoàn tác"):
- `POST /notes/:id/restore`: `200 Note`, không tăng version. Note không ở trong thùng rác cũng trả `200` (idempotent). `404` nếu không có.
- `DELETE /notes/:id/permanent`: `204` nếu note đang trong thùng rác. **`409 NOTE_NOT_IN_TRASH`** nếu chưa xóa mềm, để không lỡ tay xóa thẳng note đang dùng. `404` nếu không có.

### Tags

- **`GET /tags`** trả `200 { items: TagWithCount[] }`, sắp theo name, **gồm cả tag có 0 note** để bạn thấy mà xóa. Chỉ đếm note chưa xóa:
  ```sql
  SELECT t.id, t.name, count(n.id)::int AS "noteCount"
  FROM "Tag" t
  LEFT JOIN "NoteTag" nt ON nt."tagId" = t.id
  LEFT JOIN "Note" n ON n.id = nt."noteId" AND n."deletedAt" IS NULL
  GROUP BY t.id ORDER BY t.name
  ```
- **Tạo tag:** chỉ tạo ngầm qua `tags` của POST/PATCH note. Không có `POST /tags`.
- **`PATCH /tags/:id`** nhận `{ name, merge? }`, chạy trong transaction:
  - Tên mới trùng tên hiện tại (sau chuẩn hóa): `200`, không làm gì.
  - Trùng một tag khác, không có `merge`: **`409 TAG_NAME_TAKEN` + `existing`**. UI hỏi "Gộp vào #docker?" rồi gửi lại với `merge: true`.
  - `merge: true`: `INSERT INTO "NoteTag" SELECT "noteId", :target FROM "NoteTag" WHERE "tagId" = :src ON CONFLICT DO NOTHING`, rồi `DELETE FROM "Tag" WHERE id = :src`. Trả `200 TagWithCount` của tag đích.
  - `404 TAG_NOT_FOUND`. Nếu bị race và gặp `23505`, filter đổi thành 409.
  - Không tăng `version` của các note liên quan.
- **`DELETE /tags/:id`**: `204`, NoteTag tự xóa theo nhờ CASCADE. `404` nếu không có.
- **Tag mồ côi không tự xóa ở GĐ1.** Nếu tự xóa thì note trong thùng rác mất tag khi được khôi phục. Cron dọn thùng rác ở GĐ2 sẽ xóa những tag không còn dòng NoteTag nào.

### Giới hạn kích thước

- Express mặc định chỉ nhận **100 kB JSON**. Trong `main.ts`: `NestFactory.create<NestExpressApplication>(AppModule)` rồi `app.useBodyParser('json', { limit: '1mb' })`.
- zod chặn `content` ở 200 000 ký tự, `title` ở 300, tối đa 20 tag.
- Kiểm tra bằng e2e rằng body quá 1 MB trả 413. Lỗi này phát sinh từ body-parser; nếu nó không đi qua filter của Nest thì body sẽ là dạng mặc định, chấp nhận được.

---

## 4. Migration đổi default sang INBOX

1. **Entity:**
   - `@Column({ type: 'varchar', length: 16, default: NOTE_DEFAULT_STATUS })`
   - `type` cũng dùng `NOTE_DEFAULT_TYPE`; giá trị vẫn là 'LEARNING' nên không sinh diff.
2. `pnpm --filter @notebook/shared build` (entity import từ dist), rồi `pnpm --filter api migration:generate src/database/migrations/NoteStatusDefaultInbox`.
3. **Đọc file sinh ra.** Nó chỉ được có `ALTER TABLE "Note" ALTER COLUMN "status" SET DEFAULT 'INBOX'` (và `down()` set lại `'ACTIVE'`). Nếu có `DROP COLUMN "search"` hay động tới `typeorm_metadata`, CHECK, index thì dừng lại tìm nguyên nhân, không commit.
4. `migration:run`, rồi `migration:check` phải báo không còn khác biệt.
5. **Không thêm `UPDATE` dữ liệu:** DB đang rỗng, và note ACTIVE cũ (nếu có) vẫn đúng nghĩa.
6. Server cũng không dựa vào default của DB, vì `createNoteSchema` đã `.default('INBOX')`. Default ở DB chỉ là lớp an toàn thứ hai.

---

## 5. Cấu trúc file backend

```
src/
├── main.ts                      # NestExpressApplication, useBodyParser 1mb, middleware Cache-Control: no-store,
│                                #   tắt x-powered-by, enableShutdownHooks
├── app.module.ts                # + AuthModule, NotesModule, TagsModule; APP_PIPE (sẵn có), APP_FILTER ApiExceptionFilter
├── common/
│   ├── config/auth-env.ts       # parseAuthEnv + AUTH_CONFIG token + type AuthConfig
│   ├── decorators/public.decorator.ts
│   ├── filters/api-exception.filter.ts
│   └── http/read-cookie.ts
├── modules/
│   ├── auth/  auth.module.ts  auth.controller.ts  auth.service.ts (checkPassword)
│   │          session.service.ts  session.guard.ts (APP_GUARD)  login-rate-limiter.ts  auth.dto.ts
│   │          *.spec.ts
│   ├── notes/ notes.module.ts  notes.controller.ts  notes.service.ts  note.entity.ts
│   │          note.mapper.ts (toNoteDto, toListItem)  notes.dto.ts
│   ├── tags/  tags.module.ts (exports TagsService)  tags.controller.ts  tags.service.ts (replaceNoteTags, list, rename, remove)
│   │          tag.entity.ts  tags.dto.ts
│   └── health/ (thêm @Public())
└── database/migrations/…-NoteStatusDefaultInbox.ts
```

- **Transaction đặt trong service** bằng `this.dataSource.transaction(em => …)`. Hàm của `TagsService` dùng chung nhận `em` làm tham số, để chạy trong transaction của Notes.
- Controller mỏng. Không dùng repository custom, không thêm lớp trung gian.
- **`ApiExceptionFilter`** (`@Catch()` cho mọi lỗi), xử lý theo thứ tự:
  1. `ZodValidationException`: `400 VALIDATION_FAILED`, `issues` lấy từ `getZodError().issues`, map thành `{ path: path.join('.'), message }`.
  2. `HttpException` có body là object chứa `code`: trả nguyên body. Có `retryAfter` thì đặt thêm header `Retry-After`.
  3. `HttpException` khác: suy `code` từ status (400 `BAD_REQUEST`, 401 `UNAUTHORIZED`, 404 `NOT_FOUND`, 413 `PAYLOAD_TOO_LARGE`, 429 `TOO_MANY_ATTEMPTS`).
  4. `QueryFailedError`, đọc `err.code`: `22P02`/`22007`/`22008`/`22003` thành `400 BAD_REQUEST`; `23505` thành `409 CONFLICT`; `23503` thành `409 CONFLICT`.
  5. Còn lại: `500 INTERNAL` và `Logger.error(stack)`. **Không** trả message của Postgres ra ngoài.

Lỗi `22P02` chủ yếu đã được `ParseUUIDPipe` chặn từ trước; filter chỉ là lưới an toàn.

---

## 6. Frontend

**Route** (Next 16: `params`/`searchParams` của page là Promise; trang client dùng `useParams`/`useSearchParams` trong `<Suspense>`. Đọc docs trong `node_modules/next/dist/docs` theo AGENTS.md):

```
app/
├── (auth)/login/page.tsx        # form mật khẩu; đã đăng nhập (GET /auth/me) thì replace(next)
├── (app)/layout.tsx             # khung: nav, link Ghi chú / Tag, nút đăng xuất
├── (app)/notes/page.tsx         # danh sách; filter qua URL ?tag=&type=&status=&page=
├── (app)/notes/new/page.tsx     # id = newId() tạo một lần (useState); Lưu = POST, rồi router.replace(`/notes/${id}`)
├── (app)/notes/[id]/page.tsx    # editor + preview
├── (app)/tags/page.tsx          # đổi tên (xử lý 409, gợi ý gộp) và xóa
└── page.tsx                     # redirect('/notes'); HealthStatus chuyển xuống footer
proxy.ts
lib/api/{client.ts, notes.ts, tags.ts, auth.ts}  lib/query-keys.ts  lib/date.ts  lib/uuid.ts
components/editor/{markdown-editor.tsx (dynamic, ssr:false), markdown-preview.tsx}
components/notes/{note-form.tsx, note-list.tsx, tag-input.tsx, conflict-dialog.tsx}
```

**Chặn khi chưa đăng nhập: hai lớp.**
1. **`proxy.ts` kiểm tra lạc quan.** Không có cookie `nb_session` thì redirect `/login?next=…`. Proxy chạy phía server nên đọc được cookie httpOnly. Nó không kiểm HMAC, nhờ vậy `SESSION_SECRET` không phải lên Vercel. **Matcher phải loại `/api`, `/_next`, `/login`, file tĩnh**, ví dụ `matcher: ['/((?!api|_next|login|favicon.ico|.*\\..*).*)']`. Thiếu `api` thì chính request `POST /api/auth/login` bị redirect.
2. **Kiểm tra thật: trong `apiFetch`.** Gặp 401 với `code !== 'INVALID_PASSWORD'` thì `queryClient.clear()` và `location.assign('/login?next=' + path)`.

```ts
// lib/api/client.ts
export class ApiError extends Error { constructor(public status: number, public body: ApiError_) { super(body.message); } }
export async function apiFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = apiErrorSchema.safeParse(json).data ?? { statusCode: res.status, code: 'INTERNAL', message: `HTTP ${res.status}` };
    if (res.status === 401 && body.code !== 'INVALID_PASSWORD') redirectToLogin();
    throw new ApiError(res.status, body);
  }
  return json as T;
}
```

**Query keys:**
```ts
export const qk = {
  me: ['auth', 'me'] as const,
  notes: ['notes'] as const,
  noteList: (q: ListNotesQuery) => ['notes', 'list', q] as const,
  note: (id: string) => ['notes', 'detail', id] as const,
  tags: ['tags'] as const,
};
```
Sau mỗi mutation: `setQueryData(qk.note(id), response)`, rồi `invalidateQueries({ queryKey: ['notes', 'list'] })` và `invalidateQueries({ queryKey: qk.tags })`.

**Optimistic update:** chỉ làm hai chỗ đáng làm.
- **Bật/tắt pin trong danh sách.** Item có sẵn `version`. Gặp 409 thì rollback, refetch, báo toast.
- **Xóa.** Bỏ khỏi danh sách ngay, hiện toast "Đã chuyển vào thùng rác · Hoàn tác" (gọi restore).

Lưu note và tạo note **không** làm optimistic: cần `version` mới từ server. Outbox ở GĐ2 sẽ gắn vào đúng `POST /notes` này.

**UUID và entryDate:**
```ts
// lib/uuid.ts: randomUUID chỉ có trong secure context (http://192.168.x.x thì KHÔNG có)
export const newId = () => globalThis.crypto.randomUUID?.() ?? uuidV4FromRandomValues(); // getRandomValues dùng được cả khi không phải secure context
// lib/date.ts: KHÔNG dùng toISOString().slice(0, 10) (đó là ngày UTC)
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```
`entryDate` lấy lúc mở trang "Note mới" và hiện thành ô ngày để sửa được (cho phép ghi lùi ngày).

**Lưu: chọn nút Lưu và `Ctrl/Cmd+S`, chưa làm autosave ở GĐ1.**
- Có dấu "chưa lưu" và `beforeunload` khi còn thay đổi chưa lưu.
- Nút Lưu bị khóa khi đang có request (mỗi lúc chỉ một request).
- Lý do: 409 rõ nghĩa ("lần lưu này xung đột"), không phải xếp hàng các lần lưu, không phải lo `version` chạy đua giữa các lần autosave. Autosave thêm sau được: dùng lại đúng mutation này, debounce, mỗi lúc một request.
- Form giữ `baseVersion` và `baseNote`. PATCH chỉ gửi các trường khác `baseNote`. Lưu thành công thì gán `base = response`.
- **Không reset form khi query detail refetch.** Chỉ khởi tạo theo `id`, ví dụ `key={id}`.
- **Editor:** `@uiw/react-codemirror` + `@codemirror/lang-markdown` + `@codemirror/language-data` (highlight trong code fence). Preview: `react-markdown` + `remark-gfm` + `rehype-highlight`; **không thêm `rehype-raw`** để không mở đường XSS. Desktop chia đôi Viết | Xem; mobile dùng tab.

**Xử lý 409 trên UI:** `ConflictDialog` hiện "Note đã được sửa ở nơi khác (phiên bản N, lúc HH:mm)", hai bản đặt cạnh nhau ở chế độ chỉ đọc, kèm ba nút:
1. **Giữ bản của tôi:** PATCH lại các trường của mình với `version = current.version`.
2. **Dùng bản trên server:** thay form bằng `current`.
3. **Sao chép bản của tôi:** copy vào clipboard.

`404 NOTE_IN_TRASH` khi lưu thì hiện dialog có hai nút: "Khôi phục rồi lưu" (gọi restore, sau đó PATCH) và "Sao chép nội dung".

---

## 7. Test

**`packages/shared` (vitest):**
- `createNoteSchema`: default INBOX/LEARNING; tag được chuẩn hóa và bỏ trùng; strict từ chối key lạ; `entryDate` sai thì lỗi.
- `updateNoteSchema`: chỉ có `version` thì lỗi; `version` 0 hoặc lớn hơn int32 thì lỗi.
- `listNotesQuerySchema`: ép kiểu page/limit; `trashed=false` cho ra `false`; `q=''` cho ra `undefined`.

**`apps/api` unit (jest, không cần DB):**
- `SessionService`:
  - Ký rồi kiểm lại thì khớp.
  - Sai một ký tự chữ ký, sai tiền tố `v2`, thiếu hoặc thừa phần, chữ ký base64url có độ dài khác: đều trả `null`, không throw.
  - Quá 365 ngày, iat ở tương lai quá 5 phút, đổi secret: đều trả `null`.
  - `cookieOptions()` có `path: '/'`, `sameSite: 'lax'`, `maxAge` tính bằng ms.
- `checkPassword` với mật khẩu khác độ dài thì trả `false`, không throw.
- `LoginRateLimiter` với `now` truyền vào: 5 lần sai thì `retryAfter > 0`; sau 15 phút thì cửa sổ trượt đi; `reset()`.
- `parseAuthEnv`: mật khẩu dưới 10 ký tự, secret dưới 32 ký tự, giá trị `change-me…`, `COOKIE_SECURE` sai: đều throw.

**e2e với Postgres thật:**
- **Hạ tầng:**
  - Tách config `jest.e2e.config.js` và script `test:e2e`, chạy `--runInBand`. Test `/health` mock DB hiện có vẫn để chạy cùng nhóm unit.
  - `setupFiles` gán `DATABASE_URL = TEST_DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` trước khi import AppModule. `loadEnvFile` không ghi đè biến đã có, tôi đã kiểm tra.
  - **Từ chối chạy** nếu tên DB không kết thúc bằng `_test`, trừ khi `CI=true`, để không truncate DB dev. Local tạo DB `notebook_test` trong cùng container.
  - Dùng `AppModule` thật nên `migrationsRun` tự chạy. `beforeEach`: `TRUNCATE "NoteTag","Note","Tag"` và `limiter.reset()`.
  - CI: thêm `TEST_DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` vào `env` và bước `pnpm --filter api test:e2e`.
- **Ca test:**
  - Không có cookie thì 401; `/health` vẫn 200.
  - Login sai 5 lần đều 401, lần 6 là 429 có `Retry-After`; mật khẩu đúng trong lúc bị khóa vẫn 429.
  - Login đúng: chuỗi `Set-Cookie` có `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=31536000`; `supertest.agent` dùng cookie đó gọi được `/notes`.
  - POST: lần đầu 201, cùng `id` lần hai là 200, không tạo note trùng, payload khác không ghi đè; status mặc định INBOX; `["Docker", "docker "]` lưu thành một tag.
  - PATCH: version tăng 1; version cũ trả 409, `current` có tags và parse được bằng `versionConflictErrorSchema`.
  - **Hai PATCH cùng version chạy song song (`Promise.all`): đúng một 200 và một 409.**
  - PATCH note đã xóa: `404 NOTE_IN_TRASH`.
  - DELETE: danh sách mặc định không còn note, `trashed=true` thì có; restore; `permanent` trên note chưa xóa trả 409.
  - `GET /tags`: không đếm note đã xóa. Đổi tên trùng thì 409, `merge` thì gộp. Xóa tag thì NoteTag bị xóa theo.
  - `:id` không phải uuid trả 400, không phải 500. Body quá 1 MB trả 413. `q=x` trả 501.
  - Parse mọi response bằng schema của shared.

**Web:** GĐ1 chưa cần test UI. Có thể thêm unit nhỏ cho `localDate` (đặt `TZ=Asia/Ho_Chi_Minh` lúc 06:00).

---

## 8. Rủi ro và điểm dễ sai (từ nặng tới nhẹ)

1. **Cookie thiếu `Path=/`.** Path mặc định thành `/api/auth`, đăng nhập "được" nhưng mọi request sau đều 401.
2. **Matcher của `proxy.ts` không loại `/api`.** Request đăng nhập bị redirect về `/login`, không đăng nhập được.
3. **Giới hạn JSON 100 kB mặc định.** Note dài (dán log, code) bị 413 mà không rõ lý do.
4. **Ghi đè mất dữ liệu:** PATCH bằng `save()`, quên `AND "deletedAt" IS NULL`, hoặc lỡ dùng `@VersionColumn`.
5. **Cookie `Secure` trên http.** Safari với localhost, hoặc điện thoại qua IP LAN: login trả 200 nhưng cookie bị bỏ, redirect vòng lặp. Đặt `COOKIE_SECURE=false` khi dev.
6. **Kiểm env auth trong `data-source.ts`.** CLI migration trong CI và trong container sẽ hỏng; chỉ kiểm trong `AuthModule`.
7. **Ngày UTC trên client** (`toISOString().slice(0, 10)`): note viết trước 7h sáng rơi sang hôm trước.
8. **Migration sinh thừa** (drop/add `search`, đụng `typeorm_metadata`). Đọc kỹ trước khi commit; build shared trước khi generate.
9. **CDN cache response API.** Bắt buộc `Cache-Control: no-store`.
10. **Khóa đăng nhập toàn cục cũng là kênh DoS.** Ai đó gõ sai 5 lần là bạn không đăng nhập được thiết bị mới trong 15 phút; thiết bị đã có cookie không bị ảnh hưởng. Spec đã chấp nhận; restart API thì counter về 0.
11. **Không mặc định lọc `status`.** Lọc ACTIVE thì note INBOX mới tạo biến mất ở GĐ1.
12. **Nhầm type input/output của zod.** Web gửi request dùng `z.input<>`; `z.infer` là output, đã có default.
13. **`:id` không có `ParseUUIDPipe`:** Postgres báo `22P02` thành 500 (filter là lưới an toàn).
14. **`timingSafeEqual` với buffer khác độ dài sẽ throw, thành 500.** Kiểm độ dài trước.
15. **`crypto.randomUUID` không có ngoài secure context.** Cần fallback.
16. **Thêm `rehype-raw` vào preview** là mở đường XSS từ nội dung note.
17. **Tên tag cũ trong form chưa lưu.** Đổi tên tag xong mà editor còn giữ tên cũ, lưu note sẽ tạo lại tag cũ. Nhẹ; invalidate notes sau khi rename.
18. **Pin hoặc đổi tag cũng tăng `version`.** Editor đang mở ở tab khác sẽ gặp 409. Đúng ngữ nghĩa, chỉ cần dialog nói rõ.
19. **`res.cookie` nhận `maxAge` bằng ms.** Nhầm sang giây thì cookie chỉ sống khoảng 8,7 giờ.

**Thay đổi cấu hình kèm theo:**
- `docker-compose.yml` và hai `.env.example`: thêm `COOKIE_SECURE`.
- CI: thêm biến cho e2e và bước `test:e2e`.
- **Thêm dependency của web:** `@uiw/react-codemirror`, `@codemirror/lang-markdown`, `@codemirror/language-data`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `@tailwindcss/typography`; shadcn `dialog`, `sonner`, `input`, `badge`.
- API không cần thêm dependency nào.

**File liên quan:**
- `/home/anhn/my-project/notebook/PROJECT.md`
- `/home/anhn/my-project/notebook/apps/api/src/main.ts`
- `/home/anhn/my-project/notebook/apps/api/src/app.module.ts`
- `/home/anhn/my-project/notebook/apps/api/src/database/data-source.ts`
- `/home/anhn/my-project/notebook/apps/api/src/modules/notes/note.entity.ts`
- `/home/anhn/my-project/notebook/apps/api/src/modules/tags/tag.entity.ts`
- `/home/anhn/my-project/notebook/apps/api/src/modules/health/health.controller.ts`
- `/home/anhn/my-project/notebook/apps/api/jest.config.js`
- `/home/anhn/my-project/notebook/packages/shared/src/note.ts`
- `/home/anhn/my-project/notebook/packages/shared/src/tag.ts`
- `/home/anhn/my-project/notebook/apps/web/next.config.ts`
- `/home/anhn/my-project/notebook/apps/web/lib/api.ts`
- `/home/anhn/my-project/notebook/docker-compose.yml`
- `/home/anhn/my-project/notebook/.github/workflows/ci.yml`
