# Thiết kế Giai đoạn 2 ("Dùng hằng ngày")

Phạm vi (PROJECT.md mục 12): tìm kiếm, trang Hôm nay và lịch, inbox / quick capture + outbox, chế độ đọc, thùng rác + cron dọn. Xong khi: dùng thay được cách ghi chú hiện tại.

Vẫn là monolith NestJS cho một người dùng. Không thêm service, không thêm bảng. Toàn bộ GĐ2 chỉ có **một migration** (đổi biểu thức cột `search` + thêm một text search configuration), **một endpoint mới** (`GET /days`) và **không thêm dependency nào** (cả API lẫn web).

Đã đối chiếu với mã và dữ liệu thật:
- **PostgreSQL 17.11** (container dev, chạy trên DB `notebook_test` trong transaction rồi `ROLLBACK`, không để lại gì):
  - `to_tsvector('simple', f_unaccent('Đường dẫn docker-compose.yml node.js useQuery snake_case_name @nestjs/typeorm https://foo.com/bar'))` cho ra `'duong' 'dan' 'docker-compose.yml' 'node.js' 'usequery' 'snake' 'case' 'name' 'nestjs/typeorm' 'foo.com' 'foo.com/bar' '/bar'`. Tức là file, host, đường dẫn và camelCase **không bị tách**: gõ "typeorm", "compose", "query" sẽ không ra (xem 2.1).
  - Biểu thức `regexp_replace(f_unaccent(x), '([[:lower:]])([[:upper:]])|[^[:alnum:]]+', '\1 \2', 'g')` tách đúng thành `docker compose yml use Query i Phone nestjs typeorm node js snake case`. `regexp_replace` 4 tham số là `IMMUTABLE`, dùng được trong cột generated. DB có `datctype = en_US.utf8`.
  - Text search configuration riêng `public.vn_unaccent` (copy `simple`, map `word`… qua dictionary `public.unaccent` rồi `simple`) cho ra **cùng lexeme** với `to_tsvector('simple', f_unaccent(…))`.
  - `ts_headline('public.vn_unaccent', 'Hôm nay sửa lỗi Docker volume trên đường về nhà…', to_tsquery('simple', f_unaccent($$'duong':* & 'dock':*$$)))` trả `<<Docker>> volume trên <<đường>> về`: **khớp prefix và giữ nguyên chữ có dấu** của bản gốc. Với config `simple` thì không highlight được chữ có dấu.
  - Marker `StartSel=, StopSel=` dùng được: `Một hai ba bốn «Đức» năm`. `MaxFragments=2, FragmentDelimiter=" … "` ra hai đoạn quanh hai chỗ khớp, cách nhau bằng ` … `. Không khớp gì thì trả về `MinWords` chữ đầu ("Chỉ có tiêu đề"). Tham số options truyền bằng `$n` và `CROSS JOIN to_tsquery(…) AS q` đều chạy.
  - `to_tsquery('simple', $$'-':*$$)` cho tsquery rỗng (kèm NOTICE), `@@` với nó luôn `false`.
  - `pg_get_functiondef(f_unaccent)`: thân hàm ghi đủ schema (`public.unaccent('public.unaccent', $1)`), nên `pg_restore` (chạy với `search_path` rỗng) vẫn tính lại được cột generated.
- **TypeORM 1.1.2:**
  - `PostgresQueryRunner.changeColumn`: khi `asExpression` đổi và cột là `STORED` thì **drop rồi add** cột (dòng 852–864).
  - `MigrationGenerateCommand.escapeTemplateLiteral` có escape `\`, nên `\1 \2` trong biểu thức sinh ra file migration đúng.
  - `SelectQueryBuilder.createOrderByExpression`: `orderBy('rank')` khớp alias của một `addSelect(…, 'rank')` thì in ra `"rank"`; chuỗi khác thì in nguyên văn.
  - `PostgresDriver.escapeQueryWithParameters`: tham số `:tsq` dùng nhiều lần trong một câu thì dùng chung một `$n`.
- **@nestjs/schedule** (tải tarball về scratchpad, chỉ đọc file):
  - 12.0.2 (mới nhất) có `"type": "module"`, tức chỉ có ESM; peer `@nestjs/core ^11 || ^12`.
  - 6.1.3 là CommonJS, peer Nest 10/11, có `waitForCompletion` và `CronExpression.EVERY_HOUR = "0 0-23/1 * * *"`.
  - Cả hai đều phụ thuộc `cron@4.4.0`. Lý do mục 6 không dùng thư viện này nằm ở 6.1.
- **Code hiện có:** `notes.service.ts` (list/create/update), `note-form.tsx` (lưu note mới: `base = response`, form giữ nguyên draft), `local-draft.ts`, `use-note-actions.ts`, `nav.ts`, `mobile-tab-bar.tsx`, `app-sidebar.tsx`, `notes-view.tsx`, `trash-view.tsx`, `markdown-preview.tsx`, `apiFetch`.
- **Next 16.4.3, zod 4.6.7, nestjs-zod 5.5:** chỉ dùng những API đã kiểm ở GĐ1 và đang chạy trong code: `useSearchParams` trong `<Suspense>`, `useParams`, `history.replaceState`, `GuardedLink`/`useGuardedRouter`, `z.iso.date()`, `z.stringbool()`, `createZodDto` với schema có `.refine`.

---

## 0. Tóm tắt quyết định

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Tìm kiếm | Full-text Postgres, mỗi từ thành prefix `từ:*` nối `&`. Bỏ dấu bằng `f_unaccent` ở **cả hai phía**. Thêm vector phụ (trọng số D) tách theo dấu câu và camelCase để gõ "typeorm", "compose", "query" vẫn ra. **Không dùng pg_trgm.** Highlight bằng `ts_headline` với config `vn_unaccent` (giữ chữ có dấu). Kết quả nằm ngay trong `GET /notes?q=` |
| 2 | UI tìm kiếm | Ô tìm ở đầu trang Ghi chú (`/notes?q=`), dùng được cả trên mobile. Desktop có thêm bảng lệnh `Ctrl/Cmd+K` (tìm note + lệnh). Không có trang `/search` riêng |
| 3 | Hôm nay | Nhóm theo `entryDate` (ngày địa phương do client gửi), xếp theo `createdAt`. "Hôm nay" chỉ tính ở client sau khi hydrate. Route `/today?date=`. Lịch dùng `GET /days?from=&to=`. Mobile: dải tuần + sheet lịch tháng; desktop `lg`: lịch tháng ở cột phải |
| 4 | Quick capture | Sheet một ô nhập: Enter lưu (trừ lúc đang gõ IME), `#tag` tự thành tag, dòng đầu thành tiêu đề. Mở bằng nút giữa tab bar, nút ⚡ cạnh "Note mới", phím `C`, hoặc từ `Ctrl+K` |
| 5 | Outbox | Tự viết khoảng 60 dòng bọc IndexedDB, **không thêm `idb`/`idb-keyval`**. Mọi note mới (capture và editor) đi qua outbox. Record theo `id` của note, có `rev`. Thử lại khi mở app, khi có sự kiện `online`, khi tab hiện lại và theo backoff 5 s → 5 phút. Tách lỗi tạm thời / vĩnh viễn / hết phiên. Hai tab cùng gửi vẫn an toàn nhờ POST idempotent |
| 6 | Chế độ đọc | `/notes/[id]/read`, cột 68ch, `prose-lg`. Mục lục lấy từ heading đã render (id do một plugin rehype khoảng 30 dòng gán). Thời gian đọc tính 230 chữ/phút |
| 7 | Thùng rác | `TrashPurgeService` dùng `setTimeout` lặp mỗi giờ (chạy lần đầu 60 s sau khi khởi động). `DELETE … WHERE "deletedAt" < now − 30 ngày`, idempotent, chỉ log khi có xóa. **Không dùng `@nestjs/schedule`** (cần bạn xác nhận). UI hiện "Còn N ngày" |
| 8 | ARCHIVED (đề xuất) | Ẩn khỏi danh sách Ghi chú mặc định (có dòng "Đã ẩn N note lưu trữ · Xem"). Vẫn hiện trong tìm kiếm, trang Hôm nay và lịch. API thêm `excludeArchived`, mặc định `false` để không đổi hành vi cũ |

---

## 1. Kiểm tra migration `Init` (cột `search`)

**Đúng:**
- `CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public`: `unaccent` là extension "trusted" từ PG 13, nên user sở hữu DB tạo được mà không cần superuser.
- `f_unaccent` là `IMMUTABLE PARALLEL SAFE`, thân hàm ghi đủ schema. Sau `pg_restore` cột generated vẫn tính lại được, và đây cũng là điều kiện để bước "thử khôi phục mỗi tháng" ở mục 10.6 chạy được.
- Dùng config `'simple'`, không stemming tiếng Anh. `setweight` A cho title, B cho content. `coalesce` làm cột không bao giờ NULL, nên `STORED NOT NULL` là đúng.
- GIN `Note_search_idx` không có điều kiện `deletedAt IS NULL`. Vậy là đúng, vì tìm trong thùng rác (`trashed=true&q=`) cũng cần index.
- Dòng `typeorm_metadata` giữ nguyên. `migration:check` đọc `asExpression` từ bảng này (dòng 2363 của `PostgresQueryRunner`).

**Thiếu (GĐ2 sửa):**
1. **Phía query chưa bỏ dấu.** PROJECT.md mục 7 viết `.where("note.search @@ to_tsquery('simple', :q)")`. Gõ "đường" sẽ thành lexeme `đường`, không khớp `duong` trong cột. Phải là `to_tsquery('simple', f_unaccent(:tsq))`.
2. **Token dính dấu câu không tách:** `docker-compose.yml`, `@nestjs/typeorm`, `node.js`, URL, và camelCase (`useQuery`). Prefix chỉ khớp phần đầu, nên "compose", "typeorm", "query" đều không ra. Với kho note học lập trình, đây là ca tìm rất hay gặp. Sửa ở 2.2.
3. **Không highlight được chữ có dấu** khi chỉ có config `simple`. Sửa bằng config `vn_unaccent` ở 2.2.

---

## 2. Tìm kiếm

### 2.1 Cách dựng query

```ts
// packages/shared/src/search.ts (mới)
export const SEARCH_TERMS_MAX = 8;
export const SEARCH_TERM_MAX_LENGTH = 64;
export const SEARCH_LIMIT_DEFAULT = 20;      // web gửi khi có q (ts_headline tốn hơn excerpt)
export const HIGHLIGHT_START = '';     // ký tự Private Use: không phải HTML, không bao giờ render thô
export const HIGHLIGHT_END = '';

/** Tách chuỗi tìm thành các từ. Chỉ giữ chữ (kể cả dấu tổ hợp) và số; mọi ký tự khác là dấu cách. */
export function searchTerms(q: string): string[] {
  const words = q.normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  return [...new Set(words)]
    .slice(0, SEARCH_TERMS_MAX)
    .map((w) => Array.from(w).slice(0, SEARCH_TERM_MAX_LENGTH).join(''));
}

/** "'dock':* & 'vol':*". An toàn vì mỗi từ chỉ có chữ/số, không có ' \ : & | ! ( ) * <. */
export const prefixTsquery = (terms: readonly string[]): string =>
  terms.map((t) => `'${t}':*`).join(' & ');

/** Tách chuỗi có marker thành các đoạn. Chịu được marker lẻ (bị stripMarkdown cắt mất một nửa). */
export function splitHighlight(s: string): { text: string; hit: boolean }[];
```

- **Vì sao tách ở JS mà không để parser của Postgres tách:** chuỗi người dùng gõ có thể chứa ký tự đặc biệt của tsquery (`'`, `\`, `:`, `&`, `(`). Lọc còn chữ/số thì chuỗi tsquery dựng ra luôn hợp lệ: không bao giờ 500, không có đường injection vào cú pháp tsquery. Giá trị vẫn đi bằng tham số `$n`.
- **Bỏ dấu ở DB** (`f_unaccent(:tsq)`), không làm ở JS. Bảng `unaccent.rules` của Postgres là nguồn duy nhất, nên hai phía chắc chắn khớp nhau (`đ` → `d` và các ký tự khác).
- **Gõ "dock vol":** `'dock':* & 'vol':*` khớp note có cả "docker" lẫn "volume". Đúng ví dụ ở PROJECT.md mục 3.
- **Không có từ nào hợp lệ** (`"!!!"`, chỉ có emoji): API trả `200` danh sách rỗng, `total: 0`. Web không gửi request mà hiện "Gõ chữ hoặc số để tìm".
- **Xếp hạng:** `ts_rank("note"."search", tsq) DESC, "updatedAt" DESC, id DESC`. Trọng số mặc định A=1.0, B=0.4, D=0.1, nên khớp tiêu đề đứng trước khớp nội dung, và khớp nguyên từ đứng trước khớp phần tách. Không làm normalization theo độ dài, để bài dài không bị dìm.
- **Không dùng pg_trgm.** Prefix cộng vector phụ (2.2) đã đủ cho yêu cầu "gõ một phần của từ cũng ra" (phần đầu của từ, hoặc một mảnh của token code). pg_trgm sẽ thêm index thứ hai rất lớn (trigram trên content tới 200k ký tự), thêm nhánh `OR`, và không có rank hay highlight tử tế. Nếu sau này thật sự cần tìm giữa từ (gõ "ocker" ra "docker") thì thêm migration riêng: `CREATE EXTENSION pg_trgm` + `CREATE INDEX … USING gin (f_unaccent(lower(title || ' ' || content)) gin_trgm_ops)`, query `OR … ILIKE '%' || f_unaccent(:term) || '%'` chỉ với từ từ 3 ký tự trở lên. GĐ2 không làm.

### 2.2 Migration `SearchV2`

**Entity** (`note.entity.ts`), thêm vector D:

```ts
// KHÔNG sửa chuỗi này nếu không định sinh migration mới.
export const NOTE_SEARCH_EXPRESSION =
  `setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') || ` +
  `setweight(to_tsvector('simple', f_unaccent(coalesce("content", ''))), 'B') || ` +
  // Tách thêm theo dấu câu và camelCase: docker-compose.yml → docker compose yml, useQuery → use query.
  `setweight(to_tsvector('simple', regexp_replace(f_unaccent(coalesce("title", '') || ' ' || coalesce("content", '')), ` +
  `'([[:lower:]])([[:upper:]])|[^[:alnum:]]+', '\\1 \\2', 'g')), 'D')`;
```

- Vector A/B vẫn giữ token nguyên (`usequery`, `node.js`, `iphone`), nên gõ liền "usequery" hay "iphone" vẫn ra. Vector D chỉ **thêm** các mảnh. Nếu tách camelCase ngay trong A/B thì gõ "iphone" sẽ không còn khớp `i` + `phone`.
- Regex chạy **sau** `f_unaccent` nên làm việc trên chữ gần như toàn ASCII: `[[:alnum:]]` không phụ thuộc cách locale phân loại "ư", "ơ".
- Chuỗi TS `'\\1 \\2'` thành SQL `'\1 \2'` (`standard_conforming_strings` mặc định bật). Nhánh `[^[:alnum:]]+` không bắt nhóm nào nên `\1 \2` thành một dấu cách.
- Vector lớn khoảng gấp đôi. Content tối đa 200k ký tự, vẫn xa giới hạn 1 MB của tsvector.

**Các bước** (giống quy trình GĐ1):
1. Sửa entity. `pnpm --filter @notebook/shared build`, rồi `pnpm --filter api migration:generate src/database/migrations/SearchV2`.
2. **Đọc file sinh ra.** TypeORM drop rồi add cột, nên file phải có đủ: `DELETE FROM "typeorm_metadata" …`, `ALTER TABLE "Note" DROP COLUMN "search"`, `INSERT INTO "typeorm_metadata" …` (biểu thức mới), `ALTER TABLE "Note" ADD "search" tsvector GENERATED ALWAYS AS (…) STORED NOT NULL` và **`CREATE INDEX "Note_search_idx" ON "Note" USING gin ("search")`**. Thiếu CREATE INDEX thì dừng lại: drop cột sẽ kéo index đi theo. Ngoài cột `search` mà còn đụng chỗ khác thì cũng dừng.
3. **Thêm tay ở đầu `up()`** (không phụ thuộc thứ tự với cột, nhưng để đầu cho dễ đọc):
   ```ts
   // Config chỉ dùng cho ts_headline: bỏ dấu ở từng token rồi so với query, nhưng trả về chữ gốc có dấu.
   // Lexeme ra giống hệt to_tsvector('simple', f_unaccent(...)) của cột search.
   await queryRunner.query(`CREATE TEXT SEARCH CONFIGURATION public.vn_unaccent (COPY = pg_catalog.simple)`);
   await queryRunner.query(`ALTER TEXT SEARCH CONFIGURATION public.vn_unaccent
     ALTER MAPPING FOR word, hword, hword_part, numword, numhword, hword_numpart
     WITH public.unaccent, pg_catalog.simple`);
   ```
   Thêm vào cuối `down()`: `DROP TEXT SEARCH CONFIGURATION IF EXISTS public.vn_unaccent`. Các token ASCII (`asciiword`…) không cần map qua `unaccent`.
4. `migration:run`, `migration:check` ("No changes"), `revert`, `run` lại. TypeORM không theo dõi text search configuration, nên config không tạo diff. `pg_dump` vẫn dump nó ra.
5. Drop/add cột sẽ tính lại vector cho mọi dòng và khóa bảng trong lúc đó. Với vài nghìn note thì chỉ mất vài giây, và chạy lúc API khởi động (`migrationsRun`). Không cần cách khác.

### 2.3 Service (`notes.service.ts`)

```ts
const TSQ = `to_tsquery('simple', f_unaccent(:tsq))`;

async list(query: ListNotesQueryDto): Promise<NoteListResponse> {
  const { q, type, status, tag, date, trashed, excludeArchived, page, limit } = query;
  const terms = q === undefined ? null : searchTerms(q);
  if (terms && !terms.length) return { items: [], page, limit, total: 0, hasMore: false };
  const tsq = terms ? prefixTsquery(terms) : null;

  const qb = this.dataSource.getRepository(Note).createQueryBuilder('note');
  // … các filter hiện có (trashed, type, status, date, tag) giữ nguyên …
  if (excludeArchived) qb.andWhere('note.status <> :archived', { archived: 'ARCHIVED' });
  if (tsq) qb.andWhere(`"note"."search" @@ ${TSQ}`, { tsq });

  const total = await qb.getCount();            // đếm TRƯỚC khi thêm select/order theo "rank"

  if (tsq) qb.orderBy('rank', 'DESC').addOrderBy('note.updatedAt', 'DESC');
  else if (trashed) qb.orderBy('note.deletedAt', 'DESC');
  else if (date) qb.orderBy('note.createdAt', 'ASC');
  else qb.orderBy('note.pinned', 'DESC').addOrderBy('note.updatedAt', 'DESC');
  qb.addOrderBy('note.id', 'DESC');

  qb.select(/* các cột như cũ */).addSelect(`left("note"."content", ${NOTE_EXCERPT_LENGTH})`, 'excerpt');
  if (tsq) qb.addSelect(`ts_rank("note"."search", ${TSQ})`, 'rank');
  const rows = await qb.offset((page - 1) * limit).limit(limit).getRawMany<NoteListRow>();

  const ids = rows.map((r) => r.id);
  const [tagsByNote, hl] = await Promise.all([
    this.tagsForNotes(ids),
    tsq ? this.highlights(ids, tsq) : Promise.resolve(null),
  ]);
  return { items: rows.map((r) => toListItem(r, tagsByNote.get(r.id) ?? [], hl?.get(r.id))), page, limit, total, hasMore: page * limit < total };
}
```

- Ghi `"note"."search"` đã quote sẵn, không viết `note.search`, để không phụ thuộc cách TypeORM thay property path cho cột `select: false`.
- **Đặt `orderBy('rank')` sau `getCount()`.** Order hiện có đang được set trước `getCount()`. Với alias `rank`, chỉ đặt sau `getCount()` mới chắc chắn câu đếm không bao giờ có `ORDER BY "rank"` khi `rank` chưa được select.
- `trashed` vẫn kết hợp với `q`, nên tìm được trong thùng rác. Mặc định không có note đã xóa.
- **Thứ tự ưu tiên khi có `q`:** rank thắng `date`. `pinned` không được ưu tiên.

**Highlight** chạy query riêng, chỉ cho các id của trang hiện tại. Không để Postgres tự quyết lúc nào tính biểu thức trong select list: nó có thể chạy `ts_headline` cho mọi dòng khớp trước khi `LIMIT`.

```ts
private async highlights(ids: string[], tsq: string): Promise<Map<string, SearchHighlight>> {
  if (!ids.length) return new Map();
  const sel = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}`;
  const rows = await this.dataSource.query<{ id: string; title: string; snippet: string }[]>(
    `SELECT n."id",
            ts_headline('public.vn_unaccent', n."title", q, $3) AS "title",
            ts_headline('public.vn_unaccent', n."content", q, $4) AS "snippet"
     FROM "Note" n CROSS JOIN to_tsquery('simple', f_unaccent($2)) AS q
     WHERE n."id" = ANY($1::uuid[])`,
    [ids, tsq, `${sel}, HighlightAll=true`,
     `${sel}, MaxWords=30, MinWords=12, MaxFragments=2, FragmentDelimiter=" … "`],
  );
  return new Map(rows.map((r) => [r.id, { title: r.title, snippet: r.snippet }]));
}
```

- Nội dung không khớp (chỉ tiêu đề khớp): `ts_headline` chỉ trả `MinWords` chữ đầu (đã thử). **Web xử lý:** `snippet` không có marker nào thì hiện `excerpt` (300 ký tự) như danh sách thường.
- Mảnh chỉ khớp ở vector D (ví dụ "compose" trong `docker-compose.yml`) **không được highlight**: `ts_headline` phân tích bản gốc, ở đó `docker-compose.yml` là một token. Note vẫn ra, đoạn trích vẫn có. Chấp nhận.
- `ts_headline` đọc toàn bộ content. Trang tìm kiếm có `limit=20`, bảng lệnh có `limit=8`, nên trường hợp xấu nhất là 20 note 200k ký tự, cỡ vài trăm ms. Nếu đo thấy chậm thì đổi thành `left(n."content", 50000)`.

### 2.4 Contract

`GET /notes?q=…` (các tham số cũ giữ nguyên):
- **Bỏ `501`.** `q` chỉ có dấu câu thì `200` với `items: []`, `total: 0`.
- `q` dài quá 200 ký tự thì `400 VALIDATION_FAILED` (đã có từ GĐ1).
- Mỗi item có thêm `highlight?: { title: string; snippet: string }` **chỉ khi có `q`**. Marker là `` … ``. **Client không bao giờ render chuỗi này như HTML**: tách bằng `splitHighlight` rồi bọc `<mark>` bằng React.
- `excerpt` vẫn có, như cũ.
- Tham số mới `excludeArchived=true|false` (mặc định `false`, xem mục 7).

### 2.5 UI

**Trang Ghi chú (`/notes?q=`), dùng cho cả desktop lẫn mobile:**

```
Ghi chú  12
[🔍 Tìm trong note…                      ✕]   ← type="search", enterKeyHint="search", h-10, full width
[Tất cả | Inbox | Đang dùng | Lưu trữ] [Tất cả | Học tập | Cá nhân] [Mọi tag ▾]
12 kết quả cho “dock vol” · gồm cả note lưu trữ        ← chỉ khi có q
┌▌ Lỗi «Docker» «volume» khi restart                    ┐
│▌ … mount «volume» bị trống sau khi …                   │
│▌ 🎓 Học tập (Đang dùng) #docker · 2 tháng trước        │
```

- Ô tìm nằm trên thanh lọc. State cục bộ, **debounce 250 ms** rồi `router.replace('?q=…', { scroll: false })` (giống quy tắc "đổi bộ lọc dùng replace"). Không ghi URL trong lúc đang gõ IME (`compositionstart`/`compositionend`). Esc hoặc nút ✕ thì xóa `q`. Trên mobile, Enter thì `blur()` để hạ bàn phím.
- Có `q`: query thêm `limit: SEARCH_LIMIT_DEFAULT`, bỏ nhóm "Đã ghim", card dùng `highlight.title` và `stripMarkdown(highlight.snippet)` (snippet không có marker thì dùng `excerpt`) (marker là ký tự PUA nên các regex của `stripMarkdown` không đụng tới), `PageHeader` hiện số kết quả. Bộ lọc vẫn áp dụng. `keepPreviousData` giữ kết quả cũ trong lúc gõ tiếp.
- Rỗng: `EmptyState` icon `SearchX`, "Không tìm thấy note nào", "Thử từ ngắn hơn hoặc bỏ bớt bộ lọc." kèm nút "Bỏ lọc" nếu đang lọc.
- `<mark>`: token mới `--mark` (light `oklch(0.92 0.1 95)`, dark `oklch(0.45 0.09 85)`), chữ `text-foreground`, `rounded-[3px] px-0.5`. Ước tính contrast khoảng 14:1 (light) và 6:1 (dark). Kiểm lại bằng axe.
- `listNotes(q, signal)` nhận thêm `AbortSignal` (TanStack Query truyền sẵn), để request cũ bị hủy khi gõ tiếp.

**Bảng lệnh `Ctrl/Cmd+K` (desktop, và mobile có bàn phím ngoài):**
- `components/command/command-palette.tsx`: `Dialog` đặt ở `top-[12dvh]`, `max-w-xl`, dùng pattern ARIA combobox: `input role="combobox" aria-expanded aria-controls aria-activedescendant` + `ul role="listbox"`, nhóm có `role="group" aria-labelledby`. Không dùng `cmdk`.
- Chưa gõ gì: nhóm **Lệnh** (Ghi nhanh `C`, Note mới, Hôm nay, Inbox, Ghi chú, Tag, Thùng rác, Đổi giao diện) và nhóm **Gần đây** (`GET /notes?limit=5`, dùng chung cache).
- Đang gõ:
  - Lệnh khớp (lọc ở client, so sánh sau khi bỏ dấu).
  - **Note** (`GET /notes?q=&limit=8`, debounce 150 ms), tiêu đề có highlight, dòng phụ là `snippet` một dòng.
  - Dòng cuối: "Xem tất cả kết quả cho “…”" → `/notes?q=…`.
- ↑/↓ chọn, Enter mở, Esc đóng. Rê chuột thì đổi mục đang chọn. Điều hướng qua `useGuardedRouter().push`, nên vẫn hỏi khi editor còn thay đổi chưa lưu.
- Sidebar (`md+`): ngay dưới nút Note mới là một nút trông như ô nhập: `🔍 Tìm kiếm… ⌘K` (h-8, `bg-field`), bấm thì mở bảng lệnh.
- Phím tắt toàn cục (`components/app-shell/global-shortcuts.tsx`, gắn trong `(app)/layout`):
  - `Ctrl/Cmd+K`: bật/tắt bảng lệnh (`preventDefault`, chạy cả khi đang trong CodeMirror).
  - `C` (không phím bổ trợ): mở quick capture.
  - Bỏ qua khi `e.isComposing`, khi focus đang ở `input`/`textarea`/`select`/`[contenteditable]`, hoặc khi đang có dialog mở.

**Không làm:** trang `/search` riêng, lưu lịch sử tìm, cú pháp nâng cao (`"cụm từ"`, `-loại trừ`, `tag:`), tìm giữa từ.

---

## 3. Trang Hôm nay và lịch

### 3.1 Ngày của note

- **Nhóm theo `entryDate`** (đã chốt ở PROJECT.md mục 7). Không dùng `createdAt`: đó là UTC, note viết lúc 6h sáng giờ Việt Nam sẽ bị tính sang hôm trước.
- **"Hôm nay" chỉ tính ở client, sau khi hydrate:** trang `/today` prerender tĩnh nên không được tính ngày lúc build (đúng bài học của trang Note mới ở GĐ1).
  ```ts
  // lib/use-today.ts
  const subscribe = (cb: () => void) => {
    const t = setInterval(cb, 60_000);                       // qua nửa đêm thì tự đổi ngày
    document.addEventListener('visibilitychange', cb);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', cb); };
  };
  export const useToday = (): string | null => useSyncExternalStore(subscribe, () => localDate(), () => null);
  ```
  Snapshot là chuỗi nên React so sánh bằng `===`, không render thừa. `null` (lúc SSR) thì hiện skeleton.
- Server không biết múi giờ của client và không cần biết: `entryDate` là cột `date`, `pg` trả về chuỗi `'YYYY-MM-DD'` (parser đặt trong `data-source.ts`), API chạy `TZ=UTC` không ảnh hưởng.
- **Thứ tự trong ngày:** `createdAt ASC` (đã có khi lọc `date`). Note ghi lùi ngày có `createdAt` muộn hơn nên nằm cuối, kèm dòng "viết lúc 07:30, 28/10".
- **Tên thứ** tự viết, không dùng `Intl`, để test ổn định: `['Chủ Nhật', 'Thứ Hai', …]`, tính từ `Date.UTC(y, m-1, d)` + `getUTCDay()`, không qua giờ địa phương.

### 3.2 Endpoint

- **Danh sách của một ngày:** dùng lại `GET /notes?date=YYYY-MM-DD&limit=100`. Ngày nào hơn 100 note thì có `hasMore` và nút "Xem thêm" (`page` tăng). Gồm cả note ARCHIVED.
- **Mới: `GET /days?from=YYYY-MM-DD&to=YYYY-MM-DD`** trả `200 { items: { date, count }[] }`:
  - Chỉ có những ngày có ít nhất 1 note, sắp theo `date`. Hai đầu `from` và `to` đều tính.
  - Không đếm note đã xóa, có đếm ARCHIVED.
  - Lỗi `400 VALIDATION_FAILED` khi: ngày sai, `from > to`, hoặc khoảng dài hơn 400 ngày (đủ cho heatmap 53 tuần ở GĐ4).
  ```sql
  SELECT "entryDate" AS "date", count(*)::int AS "count"
  FROM "Note"
  WHERE "deletedAt" IS NULL AND "entryDate" BETWEEN $1 AND $2
  GROUP BY "entryDate" ORDER BY "entryDate"
  ```
  Index một phần `Note_entryDate_idx … WHERE "deletedAt" IS NULL` có sẵn và khớp đúng điều kiện này.
  - Code: `DaysController` (`@Controller('days')`) đặt trong `NotesModule`, gọi `NotesService.countByDay()`. Không cần module riêng.
- **Cache phía web:** `qk.days(from, to) = ['days', from, to]`. `afterNoteSaved` invalidate thêm `['days']`, vì tạo, xóa, khôi phục hay đổi `entryDate` đều làm số đếm đổi.

### 3.3 UI

Route `/today` (hôm nay) và `/today?date=2026-10-25` (ngày khác). Đổi ngày dùng `router.push`, để Back quay về ngày trước đó. Bấm về hôm nay thì bỏ tham số. `?date=` sai thì coi như hôm nay.

```
Mobile (< lg)                                   Desktop (≥ lg)
┌──────────────────────────────────┐            ┌────────────────────────────────────────┬──────────────┐
│ Hôm nay                  [📅 Lịch]│            │ Hôm nay   [‹] [Hôm nay] [›]  [+ Note mới cho ngày này] │
│ Thứ Ba, 27 tháng 10 · 3 note      │            │ Thứ Ba, 27 tháng 10, 2026 · 3 note     │ Tháng 10, 2026│
│ ‹  T2  T3  T4  T5  T6  T7  CN  ›  │            │ [Ghi nhanh vào hôm nay…           ↵]  │ T2 T3 … CN   │
│    26  27● 28  29  30  31  1      │            │ 08:12 ● Kế hoạch hôm nay               │  … lưới 6×7 │
│ [Ghi nhanh vào hôm nay…        ]  │            │ │      trích đoạn…   [Đọc] [Sửa]       │  chấm = có note│
│ 08:12 ● Kế hoạch hôm nay          │            │ 13:40 ● Lỗi docker volume              │              │
│ │      trích đoạn…                │            │ ┆ 21:05 ☁ Chờ gửi · Ý tưởng app…       │ (sticky top-6)│
│ 13:40 ● Lỗi docker volume         │            └────────────────────────────────────────┴──────────────┘
└──────────────────────────────────┘
```

- **Tiêu đề:** "Hôm nay" / "Hôm qua" / "Thứ Hai" (tên thứ khi trong 7 ngày gần đây) / "26/10/2025". Dòng phụ là ngày đầy đủ kèm số note. Nếu đang xem ngày khác hôm nay thì có nút "Về hôm nay".
- **Dòng thời gian** (`components/today/timeline.tsx`): mỗi note một dòng.
  - Cột trái `w-12`: giờ `formatTime(createdAt)`, `tabular-nums`. Chấm màu theo loại, nối với dòng sau bằng một đường dọc `border-l`.
  - Card gọn: tiêu đề (link sang editor), excerpt 3 dòng, chip trạng thái và tag.
  - Nút "Đọc" (sang `/notes/<id>/read`) và "Sửa".
  - Note còn trong outbox mà có `entryDate` đúng ngày này thì xen vào đúng vị trí theo giờ ghi: viền `border-dashed`, chip `CloudOff` "Chờ gửi", không có link.
- **Ô "Ghi nhanh vào hôm nay…":**
  - Desktop: composer quick capture đặt ngay trong trang (mục 4.1), `entryDate` là ngày đang xem.
  - Mobile: một nút trông như ô nhập, bấm thì mở sheet quick capture với ngày đó (tránh bàn phím bật lên ngay khi mở trang).
- **Ngày trống:** `EmptyState` icon `CalendarDays`, "Chưa có note nào ngày này", nút "Viết note cho ngày này" sang `/notes/new?date=…`. `NewNoteForm` đọc `?date=` (validate bằng `entryDateSchema`, sai thì dùng hôm nay) làm `initialEntryDate`.
- **Lịch tháng** (`components/calendar/month-calendar.tsx`) và logic thuần trong `lib/calendar.ts` (có test):
  - Lưới 6×7, tuần bắt đầu từ **Thứ Hai**, tiêu đề cột "T2 … CN".
  - Gọi `GET /days?from=<ô đầu>&to=<ô cuối>` (42 ngày), `staleTime 60 s`.
  - Dùng `<table>` + `<th scope="col">`. Mỗi ô là `<button>` với `aria-label="Thứ Ba, 27 tháng 10, 3 note"`, ngày đang xem có `aria-pressed`, hôm nay có `aria-current="date"`.
  - Ngày có note: chấm `size-1.5 bg-primary-ink` dưới số. Từ `lg` thì `title` hiện số note.
  - Ngày ngoài tháng: `text-muted-foreground/60`.
  - Nút "Tháng trước" / "Tháng sau". Tên tháng nằm trong `aria-live="polite"`.
  - Phím mũi tên trong lưới (roving tabindex): ưu tiên thấp, làm sau nếu còn thời gian.
- **Dải tuần (mobile):** 7 nút (thứ viết tắt + số ngày + chấm), ‹ › đổi tuần, dùng cùng query `days` của tuần đó. Nút "📅 Lịch" mở `MonthCalendar` trong `Dialog`, trên mobile tự thành bottom sheet. Chọn ngày thì sheet đóng.
- Desktop `lg`: lưới 2 cột `[minmax(0,1fr)_18rem]`, lịch ở cột phải `sticky top-6` trong card. `md` (768–1023) dùng bố cục mobile, vì sidebar đã chiếm 240px.

---

## 4. Inbox, quick capture và outbox

### 4.1 Quick capture

**Mở bằng:**

| Ở đâu | Cách |
|---|---|
| Mobile | Nút giữa tab bar (thay cho link `/notes/new`). Note mới đầy đủ vẫn có trong sheet "Thêm", ở đầu trang Ghi chú và qua "Mở rộng" |
| Desktop | Nút ⚡ (icon `Zap`, `aria-label="Ghi nhanh"`, tooltip "Ghi nhanh (C)") nằm cùng hàng, bên phải nút "Note mới" ở sidebar. Phím `C`. Lệnh "Ghi nhanh" trong `Ctrl+K` |
| Trang Hôm nay | Composer đặt trong trang (desktop) hoặc ô giả mở sheet (mobile), với ngày đang xem |

**Composer** (`components/capture/capture-composer.tsx`). Dùng chung trong `Dialog` (`capture-dialog.tsx`) và trong trang Hôm nay:

```
┌ Ghi nhanh ──────────────────────────────────────────┐
│ [Lỗi volume trống sau khi restart #docker         ] │  textarea tự giãn 1→8 dòng, text-base md:text-sm
│ Enter để lưu · Shift+Enter xuống dòng · #tag         │  text-xs muted (ẩn trên pointer-coarse)
│ [🎓 Học tập | 🪶 Cá nhân]   📅 Hôm nay   [Mở rộng] [Lưu]│
└─────────────────────────────────────────────────────┘
```

- **Enter thì lưu**, Shift+Enter xuống dòng. **Bỏ qua khi `e.nativeEvent.isComposing` hoặc `keyCode === 229`.** Bàn phím tiếng Việt (macOS, Gboard) dùng IME composition, thiếu kiểm tra này thì Enter để chốt chữ sẽ lưu luôn nửa câu.
- Mobile có `enterKeyHint="send"`: Enter cũng là lưu. Muốn viết nhiều dòng thì dán vào hoặc bấm "Mở rộng".
- Tách nội dung (`lib/capture.ts`, có test):
  ```ts
  export function parseCapture(text: string): { title: string; content: string; tags: string[] } {
    const t = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
    const [first = '', ...rest] = t.split('\n');
    const title = first.trim().length <= NOTE_TITLE_MAX ? first.trim() : '';
    const content = title ? rest.join('\n').trim() : t;
    // #tag phải bắt đầu bằng chữ: "#1" (số issue) và "# Heading" không thành tag. Giữ nguyên chữ trong note.
    const tags = [...t.matchAll(/(?:^|\s)#(\p{L}[\p{L}\p{N}_-]*)/gu)]
      .map((m) => tagNameSchema.safeParse(m[1]).data).filter(Boolean);
    return { title, content, tags: [...new Set(tags)].slice(0, NOTE_TAGS_MAX) };
  }
  ```
- `type`: segmented, nhớ lựa chọn gần nhất ở `localStorage['nb:capture-type']`, mặc định `LEARNING`. `status` luôn là `INBOX`. `entryDate` là `localDate()` lúc bấm lưu, hoặc ngày đang xem ở trang Hôm nay.
- Muốn chọn ngày khác thì dùng "Mở rộng". Sheet không có ô chọn ngày, để giữ một dòng.
- **Lưu:** `outbox.enqueue(...)`, đóng sheet, toast "Đã lưu vào Inbox" (nếu chưa gửi được ngay thì "Đã lưu trên máy, sẽ tự gửi khi có mạng"). Ô trống thì nút Lưu bị khóa.
- **"Mở rộng":** ghi `{ id, draft }` vào `sessionStorage['nb:capture-handoff']`, rồi điều hướng tới `/notes/new?from=capture`. `NewNoteForm` đọc một lần, dùng làm draft ban đầu với **cùng id**, rồi xóa key đó.

### 4.2 Outbox

**Không thêm dependency.** Chỉ cần 5 thao tác (`getAll`, `put`, `delete`, `deleteIfRev`, `update`). Bọc IndexedDB bằng callback mất khoảng 60 dòng (`lib/outbox/idb-store.ts`). `idb-keyval` không có `deleteIfRev` nguyên tử, nên vẫn phải tự viết transaction. Logic hàng đợi tách khỏi storage qua interface `OutboxStore`, nhờ vậy test bằng bản nhớ trong RAM, không cần thêm `fake-indexeddb`.

```ts
// lib/outbox/types.ts
export interface OutboxRecord {
  id: string;                    // = id của note (UUID tạo ở client), keyPath
  input: CreateNoteInput;        // payload POST, đã qua createNoteSchema.parse trước khi vào hàng
  queuedAt: string;              // ISO, lúc ghi
  rev: number;                   // +1 mỗi lần editor lưu lại khi note chưa lên server
  attempts: number;
  nextAttemptAt: number;         // epoch ms, 0 = gửi ngay
  state: 'pending' | 'failed';   // failed: lỗi vĩnh viễn, cần bạn xử lý
  lastError: { status: number; code: string; message: string } | null;
  created?: { version: number }; // POST đã thành công nhưng rev đổi trong lúc gửi → còn một PATCH
  source: 'capture' | 'editor';
}
export interface OutboxStore {
  getAll(): Promise<OutboxRecord[]>;
  put(r: OutboxRecord): Promise<void>;
  delete(id: string): Promise<void>;
  deleteIfRev(id: string, rev: number): Promise<boolean>;   // một transaction readwrite: get → so rev → delete
  update(id: string, fn: (r: OutboxRecord) => OutboxRecord): Promise<void>;
  clear(): Promise<void>;
}
```

- DB `notebook`, version 1, store `outbox` (`keyPath: 'id'`). Đóng DB khi có `onversionchange`.
- **Trong transaction không được `await` promise khác.** Safari tự commit transaction khi có microtask chen giữa. Mọi bước trong `deleteIfRev`/`update` viết bằng callback `onsuccess`.
- Không mở được IndexedDB (trình duyệt chặn): `getOutboxStore()` trả `null`. Khi đó capture và editor POST thẳng như GĐ1, lỗi thì giữ chữ trong ô nhập, kèm cảnh báo một lần "Trình duyệt không cho lưu tạm: cần có mạng để lưu".

**Luồng** (`lib/outbox/outbox.ts`, `createOutbox({ store, api, now, notify })`, thuần, có test):

```
enqueue(input, source):
  createNoteSchema.parse(input)         // lỗi dữ liệu thì báo ngay, không để vào hàng
  put({ id, input, rev: 1, attempts: 0, nextAttemptAt: 0, state: 'pending', … })
  notify(); void flush()

replace(id, input):                     // editor lưu lại khi note còn trong hàng
  update(id, r => ({ ...r, input, rev: r.rev + 1, state: 'pending', nextAttemptAt: 0 }))

flush({ force }):                       // single-flight trong một tab
  nếu navigator.onLine === false thì bỏ qua (đợi sự kiện online)
  với từng record pending (theo queuedAt, cũ trước), nextAttemptAt <= now hoặc force:
    sentRev = r.rev
    note = r.created ? PATCH /notes/:id { version: r.created.version, ...toPatch(r.input) }
                     : POST /notes r.input                     // idempotent theo id
    thành công:
      afterNoteSaved(qc, note); await invalidate lists        // danh sách server có note trước khi bỏ khỏi hàng
      if (!(await deleteIfRev(r.id, sentRev)))                // rev đổi trong lúc gửi
        update(r.id, x => ({ ...x, created: { version: note.version }, nextAttemptAt: 0 })) và lặp lại record này
      emit('sent', note)                                       // editor đang mở note đó chuyển sang chế độ sửa
    lỗi → classify(e):
      'transient': attempts+1, nextAttemptAt = now + backoff(attempts), lastError; DỪNG vòng (server đang tắt)
      'auth':      giữ pending, đặt cờ authRequired; DỪNG vòng
      'permanent': state 'failed', lastError; sang record kế tiếp
  hẹn giờ một setTimeout tới nextAttemptAt sớm nhất (nếu còn record pending)
```

- **Backoff:** `min(5 phút, 5 s × 2^(attempts−1))`, tức 5, 10, 20, 40, 80, 160, 300 giây.
- **Các lúc flush với `force`:** khi provider mount (mở app), sự kiện `online`, `visibilitychange` sang hiện, ngay sau `enqueue`/`replace`, và khi bấm "Gửi lại".
- **`classify`:**
  - `status 0` (NETWORK), `408`, `429`, `409 CONFLICT` (race unique khi tạo tag), `≥ 500` là **tạm thời**. Khi server ở nhà tắt, rewrite của Vercel trả 5xx.
  - `401` là **hết phiên**.
  - `400`, `413` và 4xx khác là **vĩnh viễn**. Hiếm, vì client đã validate bằng cùng schema. Chủ yếu xảy ra khi server mới hơn client.
  - PATCH bị `409 VERSION_CONFLICT` (chỉ có ở nhánh `created`): vĩnh viễn, kèm nút "Mở note".
- **`apiFetch` thêm option `redirectOn401` (mặc định `true`).** Outbox truyền `false`: nếu không thì một lần flush chạy nền có thể chuyển trang sang `/login` ngay giữa lúc bạn đang gõ capture tiếp theo. Có cờ `authRequired` thì danh sách chờ gửi hiện "Phiên đăng nhập đã hết hạn. [Đăng nhập lại] để gửi N note".
- **Hai tab cùng flush một record:** cùng `id` thì lần đầu 201, lần sau 200, cả hai cùng xóa. **Không cần Web Locks** (vốn không có trên `http://192.168.x.x`). `BroadcastChannel('nb-outbox')` chỉ báo các tab khác đọc lại snapshot. Không có BroadcastChannel thì đọc lại khi `visibilitychange`.
- **"Xung đột" của outbox:** POST có `id` đã tồn tại thì trả bản trong DB, không ghi đè (GĐ1). Với capture, chuyện này chỉ xảy ra khi gửi lặp nên luôn đúng. Với editor, đã có cơ chế `rev` + `created` ở trên. Thêm một chốt an toàn có sẵn trong `note-form.tsx`: sau POST, `base = response` còn form vẫn giữ draft, nên nếu server trả bản cũ hơn thì form vẫn ở trạng thái "Chưa lưu", không mất im lặng.
- **Provider** (`components/outbox/outbox-provider.tsx`, gắn trong `(app)/layout`, không gắn ở trang login): mỗi tab tạo một instance và gắn các trigger. `useOutbox()` (dùng `useSyncExternalStore`) trả về `{ records, pendingCount, authRequired, enqueue, replace, retry, remove, onSent }`.

**Hiển thị trạng thái chờ gửi:**

| Chỗ | Hiển thị |
|---|---|
| Inbox, đầu trang | Section "Chờ gửi lên server (N)", mỗi dòng: icon `CloudOff` (pending) hoặc `CircleAlert` (failed), tiêu đề hoặc dòng đầu, "Ghi lúc 08:12 · thử lại sau 40 giây" hoặc "Lỗi: …". Nút **Gửi lại**, **Sao chép**, **Xóa** (dialog: "Note này chưa có trên server. Xóa là mất hẳn."). Ẩn record có `id` đã nằm trong danh sách server đang hiện, để không lặp trong lúc chờ refetch |
| Trang Hôm nay | Xen vào dòng thời gian (3.3) |
| Badge Inbox (tab bar, sidebar) | `inboxTotal + pendingCount` |
| Cuối sidebar, sheet "Thêm" | Dòng `CloudOff` "N note chờ gửi" (link `/inbox`), chỉ hiện khi N > 0 |
| Editor (note mới) | Trạng thái lưu "Chờ gửi" (`CloudOff`, `text-warning`), `title` là "Đã lưu trên máy này, sẽ tự gửi khi kết nối lại" |

### 4.3 Editor tạo note đi qua outbox

PROJECT.md mục 5 yêu cầu cả "Note mới" cũng đi qua outbox. Thay đổi trong `note-form.tsx`, chỉ ở chế độ `create` khi chưa có `base`:

1. Ctrl+S / Lưu: `enqueue(payload)` (lần sau là `replace`), rồi `await outbox.sendNow(id, { timeoutMs: 8000 })`.
2. **Thành công:** `onSaved(note)` như hiện tại (`replaceState`, `base = note`, xóa nháp).
3. **Lỗi tạm thời hoặc timeout:**
   - Form vào trạng thái `queued` với `queuedDraft = d`, nên `dirty = !equal(queuedDraft, draft)`. Guard và `beforeunload` không chặn nữa, vì dữ liệu đã nằm trong IndexedDB.
   - Xóa `nb:draft:new`, vì outbox giờ là nơi giữ dữ liệu. Để lại thì sẽ có hai banner cho cùng một note.
4. Khi outbox phát `sent` cho đúng `id` này (dù form vẫn đang mở): gọi `onSaved(note)`, các lần lưu sau là PATCH.
5. **Lỗi vĩnh viễn:** dòng lỗi "Lưu lỗi …" như GĐ1, xóa record khỏi hàng.

Sửa note đã có khi offline: **vẫn không hỗ trợ** (đã chốt ở PROJECT.md). Lỗi mạng hiện dòng lỗi + Thử lại, có nháp localStorage như GĐ1.

**Đăng xuất:** nếu `pendingCount > 0` thì `LogoutButton` mở dialog "Còn N note chưa gửi lên server. Đăng xuất sẽ xóa chúng khỏi máy này." với hai nút [Ở lại] (focus mặc định) và [Xóa và đăng xuất]. Đăng xuất xong thì `outbox.clear()` và xóa các key `nb:draft:*`, vì đây có thể là máy công ty.

### 4.4 Xử lý Inbox

Card ở `/inbox` có biến thể `variant="inbox"` (thay nút Ghim):

```
┌▌ Lỗi volume trống sau khi restart             [✓ Đang dùng] [⚙ Sắp xếp] [🗑] ┐
│▌ trích đoạn…                                                              │
│▌ 🎓 Học tập  #docker  · 2 giờ trước                                       │
```

- **"✓ Đang dùng":** `PATCH { version, status: 'ACTIVE' }`.
  - Optimistic: chỉ bỏ note khỏi các danh sách có key `status === 'INBOX'` (`setQueriesData` với `predicate`). Các danh sách khác tự refetch nhờ `afterNoteSaved`.
  - Toast "Đã chuyển sang Đang dùng · Hoàn tác". Hoàn tác là PATCH `status: 'INBOX'` với `version` lấy từ response.
  - Focus chuyển sang card kế tiếp (`pickFocusAfterRemoval`).
  - Mobile chỉ hiện icon, có `aria-label="Chuyển “…” sang Đang dùng"`.
- **"Sắp xếp"** mở `Dialog` (bottom sheet trên mobile):
  - Ba trường: Loại (segmented), Trạng thái (segmented, **chọn sẵn Đang dùng**), Tag (`TagInput` + `commitTagText` có sẵn).
  - Footer [Hủy] [Lưu]. Chỉ PATCH các trường đã đổi, `tags` thay toàn bộ như GĐ1.
  - Trạng thái khác INBOX thì gỡ khỏi Inbox giống nút trên.
- **409:** rollback, toast "Note đã được sửa ở nơi khác, đã tải lại", refetch.
- Hook mới `useUpdateNoteFields()` trong `use-note-actions.ts`, dùng chung cho cả hai nút.
- **Không làm:** chọn nhiều note để xử lý một lần, vuốt, phím tắt j/k/e. Thứ tự Inbox giữ như cũ (mới trước).

---

## 5. Chế độ đọc

- **Route** `app/(app)/notes/[id]/read/page.tsx` (client view `reading-view.tsx`, `useParams`). Dữ liệu là `GET /notes/:id`, dùng chung cache `qk.note(id)` với editor.
- **Lối vào:** nút "Đọc" (`BookOpen`) trên thanh công cụ editor (qua guard nếu chưa lưu), nút "Đọc" trên dòng thời gian Hôm nay, `Shift+Enter` trên một note trong bảng lệnh.
- **Shell:** `nav.ts` đổi `isEditorRoute` thành `isFocusRoute`, khớp cả `/notes/<id>/read`, nên tab bar ẩn và `main` có `pb-4`. Mục nav "Ghi chú" vẫn sáng.
- Note trong thùng rác vẫn đọc được, kèm banner giống `TrashedNoteView`. Không có `/notes/new/read`.

**Bố cục** (đây là chỗ duy nhất căn giữa, vì đọc văn bản dài cần cột hẹp):

```
[← Quay lại]                                  [Mục lục ▾] [✎ Sửa]   ← thanh dính top-0, mỏng
            Tiêu đề note (text-3xl md:text-4xl, 700, leading-tight)
            🎓 Học tập · 27/10/2026 · ≈ 6 phút đọc · 1.350 chữ · #docker #nest
            ─────────────────────────────────────────────
            prose md:prose-lg, max-w-[68ch], mx-auto              │ MỤC LỤC (xl+, sticky)
            heading có scroll-mt-20                               │ • Bối cảnh
                                                                  │   • Lỗi gặp
```

- Article: `mx-auto w-full max-w-[68ch]`. Chữ 17px trên mobile (`prose`), 18px từ md (`prose-lg`, line-height 1.78). Font Be Vietnam Pro 400. Code block dùng JetBrains Mono, cuộn ngang. Bảng nằm trong khung `overflow-x-auto`.
- **Heading lùi một bậc:** `#` trong note thành `<h2>` (trang chỉ có một `h1` là tiêu đề note), `######` vẫn là `h6`.
- **Id cho heading:** plugin `lib/rehype-heading-ids.ts`, khoảng 30 dòng, không dependency. Plugin đi qua cây hast, đổi `tagName` để lùi bậc, rồi gán `id = slugify(text)`:
  - `slugify`: NFD, bỏ `\p{M}`, `đ` → `d`, chữ thường, ký tự không phải chữ/số thành `-`, cắt ở 64 ký tự, rỗng thì là `muc`.
  - Trùng id thì thêm hậu tố `-2`, `-3`.
  - Tự lấy text từ các node con, không cần `hast-util-to-string`.
- **Mục lục** lấy từ DOM sau khi render, **không phân tích lại Markdown**, để mục lục và nội dung không bao giờ lệch nhau: `useEffect` đọc `article :is(h2,h3,h4)[id]` thành `{ id, text, level }[]`. Chỉ hiện khi có từ 2 heading. Link dùng `<a href="#id">` thường (giống skip link).
  - `xl+`: cột phải `w-56`, `sticky top-16`. Scrollspy bằng `IntersectionObserver` (`rootMargin: '0px 0px -70% 0px'`), mục đang đọc có `aria-current="location"` và `text-primary-ink`.
  - Dưới `xl`: `<details>` "Mục lục (N)" ngay dưới dòng meta.
  - Cuộn dùng `scroll-behavior: smooth`, rule reduced motion có sẵn tự tắt.
- **Thời gian đọc** (`lib/reading.ts`): `words = stripMarkdown(content).split(/\s+/).filter(Boolean).length`, `minutes = max(1, round(words / 230))`. Tiếng Việt đếm theo tiếng (âm tiết), 230 tiếng/phút là tốc độ đọc màn hình hợp lý. Số chữ format `vi-VN` ("1.350").
- **`markdown-preview.tsx`** thêm prop `variant: 'preview' | 'reading'`. `reading` dùng thêm `rehypeHeadingIds` và class `prose md:prose-lg`. Đồng thời sửa component `a`: `href` bắt đầu bằng `#` thì **không** đặt `target="_blank"` (hiện đang mở link nội bộ sang tab mới). Vẫn không dùng `rehype-raw`.
- **Không làm:** chỉnh cỡ chữ, thanh tiến độ đọc, chế độ in.

---

## 6. Thùng rác và dọn tự động

### 6.1 Job dọn

**Đề xuất: không dùng `@nestjs/schedule`.** Đây là chỗ lệch khỏi PROJECT.md mục 6, cần bạn xác nhận:
- Bản mới nhất (12.x, đi cùng Nest 12) **chỉ có ESM**. API đang build CommonJS, Jest chạy ts-jest CommonJS, e2e import `AppModule` sẽ gặp lỗi `import` trong ESM. Muốn dùng phải ghim nhánh 6.1.x (cũ, chỉ cho Nest ≤ 11), và sẽ kẹt khi lên Nest 12.
- Chỉ có một job. Với server ở nhà có lúc tắt, chạy theo chu kỳ kèm một lần sau khi khởi động hợp hơn chạy cron đúng 03:30 (máy có thể đang tắt lúc đó).

```ts
// modules/notes/trash-purge.service.ts
@Injectable()
export class TrashPurgeService implements OnApplicationBootstrap, OnApplicationShutdown {
  static readonly FIRST_RUN_DELAY_MS = 60_000;     // sau migration, sau khi API đã nhận request
  static readonly INTERVAL_MS = 60 * 60_000;       // mỗi giờ
  private readonly log = new Logger('TrashPurge');
  private timer?: NodeJS.Timeout;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;   // Jest tự đặt NODE_ENV=test: e2e không có timer chạy ngầm
    this.schedule(TrashPurgeService.FIRST_RUN_DELAY_MS);
  }
  onApplicationShutdown() { clearTimeout(this.timer); }

  /** setTimeout nối tiếp (không setInterval): lần sau chỉ được hẹn khi lần trước đã xong, không bao giờ chạy chồng. */
  schedule(ms: number) {
    this.timer = setTimeout(async () => {
      await this.runOnce();
      this.schedule(TrashPurgeService.INTERVAL_MS);
    }, ms);
    this.timer.unref();
  }

  async runOnce(): Promise<void> {
    try {
      const n = await this.purgeExpired();
      if (n > 0) this.log.log(`Đã xóa vĩnh viễn ${n} note quá ${TRASH_RETENTION_DAYS} ngày trong thùng rác`);
    } catch (e) {
      this.log.error('Dọn thùng rác thất bại, thử lại sau 1 giờ', e instanceof Error ? e.stack : String(e));
    }
  }

  /** Idempotent: chạy bao nhiêu lần cũng chỉ xóa note đã quá hạn. NoteTag tự xóa theo (CASCADE). */
  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * 86_400_000);
    const res = await this.dataSource.createQueryBuilder()
      .delete().from(Note)
      .where('"deletedAt" IS NOT NULL AND "deletedAt" < :cutoff', { cutoff })
      .execute();
    return res.affected ?? 0;
  }
}
```

- **Dùng QueryBuilder `.delete()`** (giống `removePermanently`) để lấy `affected`. Không dùng `dataSource.query('DELETE … RETURNING')`, vì kết quả trả về của raw query với lệnh DELETE theo từng driver không giống nhau.
- **Chính xác tới đâu:** note đủ điều kiện đúng lúc `deletedAt + 30 ngày` và bị xóa trong vòng tối đa 1 giờ sau đó. Không có index trên `deletedAt`, nhưng quét vài nghìn dòng mỗi giờ là không đáng kể.
- **Restore chạy song song với job:** `UPDATE` và `DELETE` khóa dòng nên chạy lần lượt. Nếu DELETE thắng thì restore nhận 404 và UI hiện "Không tìm thấy note". Chấp nhận.
- **DB không kết nối được lúc job chạy:** log `error`, giờ sau chạy lại. Không làm process sập.
- **Tag mồ côi không tự xóa** (đổi so với dự kiến ở `phase1-design.md`). Muốn xóa an toàn thì phải khóa chung với `replaceNoteTags`: nếu không, khi `DELETE FROM "Tag" WHERE NOT EXISTS (…)` chạy cùng lúc với một lần lưu note đang gắn đúng tag đó, CASCADE sẽ gỡ tag khỏi note đó mà không báo gì. Tag 0 note vẫn hiện ở trang Tag để bạn tự xóa, và không hiện ở sidebar (đã lọc từ trước).
- Đăng ký trong `NotesModule.providers`. Không cần env mới.

### 6.2 UI số ngày còn lại

- `TRASH_RETENTION_DAYS = 30` đặt trong `packages/shared/src/note.ts`. Web và API dùng chung hằng này. Không thêm field vào response: client tự tính từ `deletedAt`.
- `lib/date.ts` (có test):
  ```ts
  export const trashPurgeAt = (deletedAt: string) => new Date(Date.parse(deletedAt) + TRASH_RETENTION_DAYS * 86_400_000);
  /** "Còn 12 ngày" | "Còn 1 ngày" | "Còn dưới 1 ngày" | "Sắp bị xóa" (đã quá hạn, job chưa chạy). */
  export function formatTrashExpiry(deletedAt: string, now = new Date()): { text: string; urgent: boolean };
  // ms = purgeAt - now; ms <= 0 → "Sắp bị xóa"; < 1 ngày → "Còn dưới 1 ngày"; còn lại ceil(ms / 1 ngày); urgent khi ≤ 3 ngày
  ```
- Card trong `/trash`: dòng meta "Đã xóa 2 giờ trước · **Còn 30 ngày**". Thẻ `<time dateTime={purgeAt.toISOString()}>`, `title` là "Tự xóa vĩnh viễn lúc 14:05 26/11/2026". Khi `urgent` thì dùng `text-warning` kèm icon `Clock`, không chỉ đổi màu.
- Mô tả trang Thùng rác: "Note đã xóa được giữ 30 ngày rồi tự xóa vĩnh viễn. Mở để xem, khôi phục hoặc xóa ngay."
- Banner `TrashedNoteView`: thêm câu "Sẽ tự xóa vĩnh viễn sau N ngày (26/11)."
- Toast sau khi xóa: "Đã chuyển vào thùng rác (giữ 30 ngày) · Hoàn tác".
- **Vẫn không có "Dọn sạch thùng rác".**

---

## 7. Trạng thái ARCHIVED (đề xuất, **cần bạn xác nhận**)

PROJECT.md chưa có quy tắc. Đề xuất A (giống Gmail, Keep: lưu trữ là "cất đi, không mất"):

| Chỗ | ARCHIVED có hiện không | Cách làm |
|---|---|---|
| Ghi chú, không lọc trạng thái (kể cả `?tag=`, `?type=`) | **Không**. Dưới thanh lọc có dòng "Đã ẩn 7 note lưu trữ · Xem" (link `?status=ARCHIVED`) | Web gửi `excludeArchived=true`. Số "7" lấy từ cùng filter + `status=ARCHIVED&limit=1` |
| Ghi chú, chọn "Lưu trữ" | Có | `status=ARCHIVED` |
| Tìm kiếm (`q`, `Ctrl+K`) | **Có**, chip "Lưu trữ", card làm chìm như hiện tại | Có `q` thì web không gửi `excludeArchived` |
| Hôm nay, lịch, `/days` | **Có**: lưu trữ không xóa note khỏi lịch sử của ngày đó | Không lọc |
| Inbox | Không (chỉ INBOX) | Như cũ |
| Số "Ghi chú" ở sidebar | Không tính | `NAV_COUNT_QUERIES.notes = { excludeArchived: true, limit: 1 }` |
| Số note của tag (`GET /tags`) | **Có tính**, như hiện tại | Không đổi. Tag chỉ có note lưu trữ mà đếm 0 thì dễ bị xóa nhầm. Lệch số với `/notes?tag=` đã có dòng "Đã ẩn N note lưu trữ" giải thích |

- **API:** `excludeArchived` mặc định `false`, nên client cũ và test GĐ1 không đổi hành vi. Kết hợp `status=ARCHIVED&excludeArchived=true` thì ra rỗng, đúng logic AND.
- **Nhãn "Tất cả"** trên segmented trạng thái giữ nguyên. Dòng "Đã ẩn N note lưu trữ" là chỗ giải thích.
- **Phương án B** (không đổi gì): ARCHIVED hiện ở mọi nơi, chỉ được làm chìm như hiện tại. Rẻ hơn, nhưng "Lưu trữ" sẽ gần như không khác "Đang dùng". Nếu chọn B thì bỏ `excludeArchived` khỏi bước 3 của mục 12.

---

## 8. Zod schema mới và thay đổi trong `packages/shared`

```ts
// note.ts (sửa)
export const TRASH_RETENTION_DAYS = 30;

export const listNotesQuerySchema = z.object({
  q: /* như cũ: trim, NFC, max 200, '' → undefined */,
  // … type, status, tag, date, trashed như cũ …
  /** Bỏ note ARCHIVED (danh sách Ghi chú mặc định). Không gửi = như GĐ1. */
  excludeArchived: z.stringbool().default(false),
  page: …, limit: …,
});

export const searchHighlightSchema = z.object({ title: z.string(), snippet: z.string() });
export const noteListItemSchema = noteSchema
  .omit({ content: true })
  .extend({ excerpt: z.string(), highlight: searchHighlightSchema.optional() }); // chỉ có khi q

export type SearchHighlight = z.infer<typeof searchHighlightSchema>;
export type ListNotesQuery = Omit<z.input<typeof listNotesQuerySchema>, 'page' | 'limit' | 'trashed' | 'excludeArchived'>
  & { page?: number; limit?: number; trashed?: boolean; excludeArchived?: boolean };
```

```ts
// day.ts (mới)
export const DAYS_RANGE_MAX = 400;
const dayNumber = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y!, m! - 1, d!) / 86_400_000; };

export const dayCountsQuerySchema = z
  .object({ from: entryDateSchema, to: entryDateSchema })
  .refine((v) => v.from <= v.to, { message: 'from phải trước hoặc bằng to', path: ['to'] })
  .refine((v) => dayNumber(v.to) - dayNumber(v.from) < DAYS_RANGE_MAX, {
    message: `Khoảng tối đa ${DAYS_RANGE_MAX} ngày`, path: ['to'],
  });
export const dayCountSchema = z.object({ date: z.iso.date(), count: z.int().min(1) });
export const dayCountsResponseSchema = z.object({ items: z.array(dayCountSchema) });
export type DayCountsQuery = z.input<typeof dayCountsQuerySchema>;
export type DayCount = z.infer<typeof dayCountSchema>;
export type DayCountsResponse = z.infer<typeof dayCountsResponseSchema>;
```

- `search.ts` (mới) như ở 2.1: `searchTerms`, `prefixTsquery`, `splitHighlight`, các hằng `SEARCH_*`, `HIGHLIGHT_*`.
- `index.ts` export thêm `day`, `search`.
- `error.ts`: không có mã mới. `NOT_IMPLEMENTED` vẫn nằm trong danh sách nhưng không còn dùng.
- So sánh `from <= to` bằng chuỗi là đúng, vì `z.iso.date()` đã bảo đảm dạng `YYYY-MM-DD`.
- API: `DayCountsQueryDto extends createZodDto(dayCountsQuerySchema)`. `createZodDto` nhận schema có `.refine`, giống `updateNoteSchema`.

---

## 9. API contract (phần thay đổi)

Lỗi vẫn có dạng `ApiErrorBody`. Mọi route trong bảng đều cần cookie đăng nhập (`401 UNAUTHORIZED`).

| Endpoint | Request | Thành công | Lỗi |
|---|---|---|---|
| `GET /notes` | thêm `excludeArchived=true\|false`. `q` giờ đã hoạt động | `200 NoteListResponse`. Có `q` thì item có `highlight`, sắp theo rank | `400 VALIDATION_FAILED` (`q` quá 200 ký tự, tham số sai). **Không còn 501** |
| `GET /days` (mới) | `from`, `to` (`YYYY-MM-DD`, cả hai bắt buộc) | `200 { items: { date, count }[] }`, chỉ những ngày có note | `400 VALIDATION_FAILED` (ngày sai, `from > to`, quá 400 ngày) |
| `PATCH /notes/:id` | không đổi. Inbox dùng để đổi `status`/`type`/`tags` | như GĐ1 | như GĐ1 (`409 VERSION_CONFLICT` + `current`) |
| `POST /notes` | không đổi. Outbox dựa vào tính idempotent | `201` / `200` | như GĐ1 |

Ví dụ:

```http
GET /notes?q=dock%20vol&limit=20
200 {
  "items": [{
    "id": "…", "title": "Lỗi Docker volume", "excerpt": "Sau khi restart…", "type": "LEARNING",
    "status": "ACTIVE", "entryDate": "2026-08-14", "pinned": false, "version": 3,
    "createdAt": "…", "updatedAt": "…", "deletedAt": null, "tags": [{ "id": "…", "name": "docker" }],
    "highlight": { "title": "Lỗi Docker volume", "snippet": "… mount volume bị trống …" }
  }],
  "page": 1, "limit": 20, "total": 1, "hasMore": false
}

GET /days?from=2026-09-28&to=2026-11-08
200 { "items": [{ "date": "2026-10-26", "count": 2 }, { "date": "2026-10-27", "count": 3 }] }

GET /days?from=2026-11-01&to=2026-10-01
400 { "statusCode": 400, "code": "VALIDATION_FAILED", "message": "…", "issues": [{ "path": "to", "message": "from phải trước hoặc bằng to" }] }
```

---

## 10. Điều hướng và shell

- **`nav.ts`:**
  - `NavKey` thêm `'today'`. `NAV` = Hôm nay (`CalendarDays`), Inbox, Ghi chú, Tag, Thùng rác.
  - `isNavActive('today')` là `under('/today')`.
  - `isEditorRoute` đổi thành `isFocusRoute`, khớp `/notes/<id>` và `/notes/<id>/read`.
  - `NAV_COUNT_QUERIES.notes` thêm `excludeArchived: true`.
- **Tab bar** (đúng như dự tính ở `ui-redesign.md` 2.2): `[Hôm nay] [Ghi chú] [ ⚡/+ Ghi nhanh ] [Inbox•N] [Thêm]`.
  - Nút giữa là `button` `aria-label="Ghi nhanh"`, mở sheet capture. Icon `Plus` giữ nguyên để không đổi thói quen.
  - Tag chuyển vào sheet "Thêm", sheet có thêm "Note mới (trình soạn đầy đủ)" và dòng "N note chờ gửi".
- **Sidebar:**
  - Hàng trên cùng: `[+ Note mới][⚡]`, bên dưới là ô giả `🔍 Tìm kiếm… ⌘K`.
  - Nav có thêm "Hôm nay" ở đầu. Dòng chờ gửi nằm trên HealthStatus.
  - Trên Mac hiện `⌘K`, máy khác hiện `Ctrl K`, đọc `navigator.platform` **sau khi hydrate** (`useHydrated`) để không lệch HTML.
- **`app/page.tsx`:** `redirect('/today')`, đúng "Buổi sáng: mở app, vào trang Hôm nay" (cần bạn xác nhận). Logo ở sidebar vẫn trỏ `/notes`.
- **`(app)/layout.tsx`:** bọc thêm `OutboxProvider` và `CommandProvider` (state mở bảng lệnh và sheet capture), gắn `GlobalShortcuts`, `CommandPalette`, `CaptureDialog`.

---

## 11. File cần thêm và sửa

**`packages/shared/src`**
- Mới: `search.ts`, `search.test.ts`, `day.ts`, `day.test.ts`
- Sửa: `note.ts` (`excludeArchived`, `highlight`, `TRASH_RETENTION_DAYS`, type `ListNotesQuery`), `note.test.ts`, `index.ts`

**`apps/api/src`**
- Mới: `database/migrations/<ts>-SearchV2.ts` (generate + phần thêm tay ở 2.2), `modules/notes/days.controller.ts`, `modules/notes/trash-purge.service.ts` + `.spec.ts`
- Sửa:
  - `modules/notes/note.entity.ts` (`NOTE_SEARCH_EXPRESSION`)
  - `modules/notes/notes.service.ts` (search, `highlights`, `excludeArchived`, `countByDay`, bỏ 501)
  - `modules/notes/note.mapper.ts` (`toListItem` nhận thêm `highlight?`)
  - `modules/notes/notes.dto.ts` (`DayCountsQueryDto`)
  - `modules/notes/notes.module.ts` (controller, provider)
- `test/db/`: mới `search.e2e-spec.ts`, `days.e2e-spec.ts`, `trash-purge.e2e-spec.ts`. Sửa `notes.e2e-spec.ts`: ca `q=x` → 501 đổi thành ca tìm kiếm.

**`apps/web`**
- Mới:
  - `app/(app)/today/{page.tsx, today-view.tsx}`, `app/(app)/notes/[id]/read/{page.tsx, reading-view.tsx}`
  - `components/today/timeline.tsx`, `components/calendar/{month-calendar.tsx, week-strip.tsx}`
  - `components/command/{command-provider.tsx, command-palette.tsx}`, `components/app-shell/global-shortcuts.tsx`
  - `components/capture/{capture-composer.tsx, capture-dialog.tsx}`
  - `components/outbox/{outbox-provider.tsx, pending-list.tsx}`
  - `components/notes/{search-box.tsx, highlighted.tsx, triage-dialog.tsx}`, `components/reading/toc.tsx`
  - `lib/outbox/{types.ts, idb-store.ts, memory-store.ts, outbox.ts, classify.ts}`
  - `lib/{calendar.ts, capture.ts, reading.ts, rehype-heading-ids.ts, use-today.ts}`, `lib/api/days.ts`
  - Test: `lib/outbox/outbox.test.ts`, `lib/outbox/classify.test.ts`, `lib/{calendar,capture,reading,rehype-heading-ids}.test.ts`
- Sửa:
  - `app/page.tsx` (`/today`), `app/(app)/layout.tsx`, `app/globals.css` (`--mark`, `--color-mark`)
  - `app/(app)/notes/notes-view.tsx` (ô tìm, `q`, dòng "Đã ẩn N lưu trữ", `excludeArchived`), `app/(app)/trash/trash-view.tsx` (mô tả)
  - `app/(app)/notes/new/new-note-form.tsx` (`?date=`, handoff từ capture)
  - `components/notes/note-list.tsx` (highlight, biến thể `inbox`, số ngày còn lại ở biến thể `trash`)
  - `components/notes/note-form.tsx` (create qua outbox, trạng thái "Chờ gửi", nút Đọc), `components/notes/trashed-note-view.tsx`, `components/notes/use-note-actions.ts` (`afterNoteSaved` invalidate `['days']`, `useUpdateNoteFields`)
  - `components/editor/markdown-preview.tsx` (`variant`, link `#`)
  - `components/app-shell/{nav.ts, nav.test.ts, app-sidebar.tsx, mobile-tab-bar.tsx, more-sheet.tsx, app-main.tsx, use-nav-counts.ts}`
  - `components/logout-button.tsx` (cảnh báo outbox, dọn dữ liệu cục bộ)
  - `lib/api/{client.ts (redirectOn401), notes.ts (signal, excludeArchived)}`, `lib/query-keys.ts` (`days`), `lib/date.ts` (+ test: `formatTrashExpiry`, `formatLongDay`)

**Không đổi:** `package.json`/lockfile (không có dependency mới), `docker-compose.yml`, CI (e2e và `migration:check` đã có sẵn), auth.

---

## 12. Thứ tự triển khai (mỗi bước merge được, app luôn dùng được)

| # | Bước | Gồm | Xong khi |
|---|---|---|---|
| 1 | **Thùng rác tự dọn** | `TRASH_RETENTION_DAYS`, `TrashPurgeService` + spec + e2e, "Còn N ngày" ở `/trash` và banner | e2e purge qua; `/trash` hiện số ngày |
| 2 | **API tìm kiếm** | Migration `SearchV2`, `search.ts` của shared, `list` với `q`/`highlight`/`excludeArchived`, e2e. Web chưa đổi gì | `migration:check` sạch; e2e search qua; `q` không còn 501 |
| 3 | **Tìm kiếm trên web + ARCHIVED** | Ô tìm ở `/notes`, `<mark>`, quy tắc ARCHIVED (mục 7), số ở sidebar | Gõ "dock vol" ra note, có highlight trên cả desktop lẫn 390px |
| 4 | **Bảng lệnh `Ctrl+K`** | Palette, `GlobalShortcuts`, ô giả ở sidebar | Mở, tìm, Enter mở note qua guard; axe 0 vi phạm khi palette mở |
| 5 | **Hôm nay + lịch** | `GET /days` + e2e, `/today`, lịch tháng, dải tuần, nav "Hôm nay", tab bar mới, `/` → `/today`, `/notes/new?date=` | Đổi ngày, lịch có chấm đúng ngày, Back quay về ngày trước |
| 6 | **Outbox + quick capture** | `lib/outbox/*` + test, provider, sheet capture, nút giữa tab bar, phím `C`, section "Chờ gửi" ở Inbox và Hôm nay, `redirectOn401` | Offline (Playwright `setOffline`) ghi 3 note → hiện "Chờ gửi" → online → tự lên Inbox, không trùng |
| 7 | **Editor tạo note qua outbox + đăng xuất** | Mục 4.3, cảnh báo khi đăng xuất | Tắt API, lưu note mới → "Chờ gửi", sửa tiếp, Ctrl+S → bật API → server có bản mới nhất |
| 8 | **Xử lý Inbox** | Biến thể card `inbox`, `TriageDialog`, `useUpdateNoteFields` | Chuyển Đang dùng, Hoàn tác, gắn tag từ Inbox; 409 có rollback |
| 9 | **Chế độ đọc** | Route `read`, plugin heading, TOC, thời gian đọc, nút Đọc | Note dài có mục lục, bấm mục thì nhảy đúng chỗ, scrollspy đúng |

- Bước 1 và 2 độc lập nhau.
- Bước 6 cần bước 5 xong trước (tab bar, trang Hôm nay). Nếu muốn có outbox sớm hơn thì làm 6 trước 5 và tạm để nút giữa tab bar ở vị trí cũ.
- Sau bước 3, 5, 6, 9: nhờ `ui-ux-designer` review như quy trình ở CLAUDE.md.

---

## 13. Test

**`packages/shared` (vitest):**
- `searchTerms`:
  - Giữ chữ có dấu.
  - Tách `docker-compose.yml` thành `docker`, `compose`, `yml`.
  - Bỏ trùng, tối đa 8 từ, mỗi từ tối đa 64 code point.
  - `"!!!"` và emoji cho ra `[]`.
  - NFD đầu vào cho kết quả giống NFC.
- `prefixTsquery`: không bao giờ chứa `'` hay `\` trong phần từ.
- `splitHighlight`: marker đủ cặp, marker lẻ (start không có end, end đứng một mình), không có marker.
- `dayCountsQuerySchema`:
  - `from > to` lỗi.
  - Khoảng 400 ngày lỗi, 399 qua.
  - Ngày `2026-02-30` lỗi.
- `listNotesQuerySchema`: `excludeArchived=true` cho ra `true`, không gửi thì `false`.

**`apps/api` unit (jest):**
- `TrashPurgeService` với `jest.useFakeTimers()` và `purgeExpired` được mock:
  - Gọi `schedule()` thì chạy sau 60 s, rồi mỗi giờ.
  - `purgeExpired` throw thì log `error` và vẫn hẹn lần sau.
  - Có xóa thì log; không xóa gì thì không log.
  - Không có hai lần chạy chồng nhau.
  - `onApplicationShutdown` hủy timer.
  - Khi `NODE_ENV=test` thì `onApplicationBootstrap` không hẹn gì.

**e2e với Postgres thật:**
- **Tìm kiếm:**
  - "duong" ra note "Đường"; "đường" ra note "duong".
  - "dock vol" ra "Docker volume", không ra note chỉ có "Docker".
  - "typeorm" ra note có `@nestjs/typeorm`; "compose" ra `docker-compose.yml`; "query" và "usequery" đều ra `useQuery`; "node.js" ra `node.js`.
  - Khớp tiêu đề xếp trên khớp nội dung.
  - Kết hợp với `type`/`tag`/`status`/`date`. Mặc định không có note đã xóa, `trashed=true&q=` thì có. ARCHIVED có trong kết quả.
  - `highlight.title` có `Đường` (giữ dấu).
  - Note có nhiều trang: `total` đúng, `page=2` không lặp item.
  - `q="!!!"` trả `200` và `total 0`. `q=a' | b:*\(` trả `200`, không 500. `q` 201 ký tự trả `400`.
  - Parse response bằng `noteListResponseSchema`.
- **`excludeArchived=true`:** không có ARCHIVED, `total` khớp.
- **`/days`:**
  - Đếm đúng từng ngày, có ARCHIVED, không có note đã xóa. Hai đầu khoảng đều tính.
  - Khoảng không có note trả `items: []`.
  - `from > to`, quá 400 ngày, ngày sai đều `400`. Chưa đăng nhập thì `401`.
- **Purge:**
  - Tạo note, đặt `deletedAt` bằng SQL thành now−31 ngày, now−29 ngày, và null.
  - `purgeExpired(now)` trả `1`, chỉ note 31 ngày mất, `NoteTag` của nó mất theo, tag vẫn còn.
  - Gọi lại trả `0` (idempotent).
  - `GET /notes/:id` của note đã xóa trả 404.
- **Migration:** e2e tự chạy `SearchV2` trên DB test. Có ca kiểm tra `SELECT 1 FROM pg_ts_config WHERE cfgname = 'vn_unaccent'`. CI có sẵn `migration:check`.

**`apps/web` (vitest):**
- `outbox.test.ts` (memory store, `vi.useFakeTimers`, `api` giả):
  - enqueue → gửi → record bị xóa.
  - Lỗi mạng thì giữ lại, backoff 5/10/20 s, cắt ở 5 phút.
  - 400 thì `failed` và vẫn gửi record kế tiếp. 5xx thì dừng vòng.
  - 401 thì `authRequired`.
  - `replace` trong lúc POST đang bay → nhánh `created` → PATCH với `version` đúng.
  - Hai lần `flush` cùng lúc chỉ có một vòng chạy.
  - Gửi theo thứ tự `queuedAt`.
  - `retry` reset backoff. `remove` xóa.
- `classify.test.ts`.
- `capture.test.ts`: dòng đầu thành tiêu đề; dòng đầu dài hơn 300 ký tự; `#docker` thành tag; `#1` và `# Heading` không thành tag; tag không hợp lệ bị bỏ; tối đa 20.
- `calendar.test.ts`:
  - Lưới 42 ô bắt đầu Thứ Hai: tháng bắt đầu đúng Thứ Hai, tháng 2 năm nhuận, tháng 12 sang năm mới.
  - `addDays` qua cuối tháng/năm.
  - Tên thứ.
- `reading.test.ts`: số chữ, phút tối thiểu là 1. `slugify` bỏ dấu tiếng Việt, `đ` → `d`, ra rỗng thì `muc`.
- `rehype-heading-ids.test.ts`: cây hast nhỏ, `h1` → `h2`, `h6` giữ nguyên, id trùng thì có `-2`.
- `date.test.ts`: `formatTrashExpiry` (30 ngày, 1 ngày, dưới 1 ngày, quá hạn, `urgent`), `formatLongDay`.
- `nav.test.ts`: `/today` sáng mục Hôm nay; `/notes/x/read` là focus route và sáng mục Ghi chú.

**Trình duyệt** (Playwright, script để ngoài repo như GĐ1; API :3101 với DB `notebook_test`, web :3100):
- Capture khi offline (`context.setOffline(true)`) → bật lại → note lên Inbox. Tắt API giữa chừng.
- Hai tab cùng có outbox. Tải lại trang khi còn record trong hàng.
- Enter trong lúc đang IME composition (giả lập bằng `compositionstart`) không lưu.
- `Ctrl+K` khi editor còn thay đổi chưa lưu thì hiện guard.
- Lịch: đổi tháng, đổi ngày, Back.
- Đọc: TOC, link `#` cùng tab.
- `/trash` hiện "Còn N ngày".
- Desktop 1280 và mobile 390, hai theme. axe ở `/today`, `/notes?q=`, đọc, palette đang mở, sheet capture.

---

## 14. Rủi ro và điểm dễ sai (từ nặng tới nhẹ)

1. **Migration `SearchV2` thiếu `CREATE INDEX "Note_search_idx"`.** Drop cột kéo index đi theo. Tìm kiếm vẫn đúng nhưng thành quét tuần tự. Đọc file sinh ra trước khi commit (2.2 bước 2).
2. **Enter khi đang gõ IME tiếng Việt** lưu nửa câu. Bắt buộc kiểm tra `isComposing` / `keyCode 229` ở composer, ô tìm và bảng lệnh.
3. **Outbox mất dữ liệu khi gửi chạy đua với editor đang lưu.** Phải có `deleteIfRev` nguyên tử và nhánh `created` → PATCH. Không được xóa record theo `id` mà không so `rev`.
4. **`await` trong transaction IndexedDB.** Safari tự commit giữa chừng, `deleteIfRev` thành không nguyên tử. Chỉ dùng callback.
5. **`apiFetch` tự chuyển sang `/login` khi flush chạy nền gặp 401.** Mất chữ đang gõ trong sheet capture. Outbox phải dùng `redirectOn401: false`.
6. **"Hôm nay" tính lúc build hoặc lúc SSR**, thành ngày build. Chỉ tính qua `useToday()` (snapshot server là `null`). App mở qua nửa đêm thì tự đổi ngày nhờ interval 60 s và `visibilitychange`.
7. **Bỏ dấu một phía.** Query phải là `f_unaccent(:tsq)`. Snippet phải dùng `vn_unaccent`, không dùng `simple`.
8. **Dữ liệu IndexedDB bị trình duyệt xóa.** Safari xóa sau 7 ngày không mở với web chưa cài ra màn hình chính; Chế độ riêng tư cũng xóa. Record thường được gửi trong vài giây nên rủi ro thấp. GĐ3 (PWA) giảm thêm. Không gọi `navigator.storage.persist()`, vì Firefox sẽ hỏi quyền.
9. **`ts_headline` chậm với note rất dài.** Giới hạn `limit` khi tìm (20/8). Nếu đo thấy chậm thì cắt `left(content, 50000)`.
10. **`orderBy('rank')` đặt trước `getCount()`.** Câu đếm có thể dính `ORDER BY "rank"` khi `rank` chưa được select. Đặt sau `getCount()`.
11. **Timer purge chạy trong e2e.** Phải có chặn `NODE_ENV === 'test'`, timer `unref()` và bị hủy khi shutdown.
12. **Tab bar đổi: nút giữa thành capture.** Thói quen từ GĐ1 ("+" là Note mới) đổi. "Mở rộng" trong sheet giữ được nội dung và id, nên không mất gì.
13. **Số note của tag lệch với danh sách** khi ẩn ARCHIVED. Đã có dòng "Đã ẩn N note lưu trữ".
14. **Ký tự ``/`` có sẵn trong nội dung note** sẽ bị hiểu là marker. Gần như không xảy ra, và chỉ ảnh hưởng phần hiển thị.
15. **Locale của DB.** Nếu tạo lại DB với `ctype` khác, `[[:lower:]]`/`[[:alnum:]]` có thể phân loại khác, nhưng chỉ với ký tự ngoài ASCII còn lại sau `f_unaccent`. Ảnh hưởng nhỏ.
16. **`Ctrl+K` trên Firefox/Chrome** mặc định focus ô tìm của trình duyệt. `preventDefault` trong listener `keydown` là đủ (GitHub, Linear cũng làm vậy). Không dùng `Ctrl+Shift+N` hay `Ctrl+N` (trình duyệt giữ, không chặn được).
17. **Hành vi router của Next 16.4.3** (`replaceState` khi lưu note mới, ghi chú ở báo cáo GĐ1). Bước 7 có đụng tới `note-form.tsx`, nên chạy lại hai ca: bấm "Note mới" ngay sau khi lưu, và Back/Forward.

---

## 15. Cần người dùng xác nhận

1. **ARCHIVED** (mục 7): chọn đề xuất A (ẩn khỏi danh sách Ghi chú mặc định, vẫn có trong tìm kiếm và trang Hôm nay) hay B (hiện ở mọi nơi, chỉ làm chìm).
2. **Dọn thùng rác bằng `setTimeout` mỗi giờ, không dùng `@nestjs/schedule`.** Lệch khỏi bảng tech stack ở PROJECT.md mục 6 (lý do ở 6.1). Nếu bạn muốn giữ thư viện thì dùng `@nestjs/schedule@^6.1` (CommonJS) với `@Cron(CronExpression.EVERY_HOUR, { name: 'trash-purge', waitForCompletion: true })`, logic `purgeExpired` giữ nguyên.
3. **Nút giữa tab bar mobile thành Quick capture.** Note mới đầy đủ chuyển vào sheet "Thêm", đầu trang Ghi chú và nút "Mở rộng".
4. **Trang mở đầu `/` → `/today`** (hiện là `/notes`).
5. **Cron không tự xóa tag mồ côi** (khác dự kiến ở `phase1-design.md`, lý do ở 6.1).
6. **Đăng xuất xóa outbox và nháp localStorage trên máy đó** (có hỏi lại khi còn note chưa gửi).
7. Sau khi chốt, nên cập nhật PROJECT.md:
   - mục 6: dòng "Lịch chạy".
   - mục 7: query phải bọc `f_unaccent`, có thêm vector D, có config `vn_unaccent`.
   - mục 8: `GET /days` (đã có trong bảng), thêm `excludeArchived` và `highlight` cho `GET /notes`.
   - mục 13: quy tắc ARCHIVED.

**Dependency:** không thêm gì. Outbox tự bọc IndexedDB. Bảng lệnh, lịch và mục lục tự viết trên `Dialog` (base-ui), React và lucide sẵn có. Không cần `@nestjs/schedule`, `idb`, `cmdk`, `date-fns`, `rehype-slug`.
