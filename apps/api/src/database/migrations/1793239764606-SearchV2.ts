import { MigrationInterface, QueryRunner } from "typeorm";

export class SearchV21793239764606 implements MigrationInterface {
    name = 'SearchV21793239764606'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- THÊM TAY: text search configuration chỉ dùng cho ts_headline (highlight kết quả tìm). ---
        // Bỏ dấu từng token rồi so với query (đã f_unaccent), nhưng trả về chữ gốc có dấu.
        // Lexeme ra giống hệt to_tsvector('simple', f_unaccent(...)) của cột "search".
        // Token ASCII (asciiword, ...) không cần qua unaccent. TypeORM không theo dõi config này.
        await queryRunner.query(`CREATE TEXT SEARCH CONFIGURATION public.vn_unaccent (COPY = pg_catalog.simple)`);
        await queryRunner.query(`ALTER TEXT SEARCH CONFIGURATION public.vn_unaccent
            ALTER MAPPING FOR word, hword, hword_part, numword, numhword, hword_numpart
            WITH public.unaccent, pg_catalog.simple`);
        // --- Hết phần thêm tay. Phần dưới do migration:generate sinh ra (drop rồi add cột "search",
        // tính lại vector cho mọi dòng; drop cột kéo theo GIN index nên phải CREATE INDEX lại). ---
        await queryRunner.query(`DROP INDEX "public"."Note_search_idx"`);
        await queryRunner.query(`ALTER TABLE "Note" DROP COLUMN "search"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","search","notebook","public","Note"]);
        await queryRunner.query(`ALTER TABLE "Note" ADD "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') || setweight(to_tsvector('simple', f_unaccent(coalesce("content", ''))), 'B') || setweight(to_tsvector('simple', regexp_replace(f_unaccent(coalesce("title", '') || ' ' || coalesce("content", '')), '([[:lower:]])([[:upper:]])|[^[:alnum:]]+', '\\1 \\2', 'g')), 'D')) STORED NOT NULL`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["notebook","public","Note","GENERATED_COLUMN","search","setweight(to_tsvector('simple', f_unaccent(coalesce(\"title\", ''))), 'A') || setweight(to_tsvector('simple', f_unaccent(coalesce(\"content\", ''))), 'B') || setweight(to_tsvector('simple', regexp_replace(f_unaccent(coalesce(\"title\", '') || ' ' || coalesce(\"content\", '')), '([[:lower:]])([[:upper:]])|[^[:alnum:]]+', '\\1 \\2', 'g')), 'D')"]);
        await queryRunner.query(`CREATE INDEX "Note_search_idx" ON "Note" USING gin ("search") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."Note_search_idx"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","search","notebook","public","Note"]);
        await queryRunner.query(`ALTER TABLE "Note" DROP COLUMN "search"`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["notebook","public","Note","GENERATED_COLUMN","search","setweight(to_tsvector('simple', f_unaccent(coalesce(\"title\", ''))), 'A') || setweight(to_tsvector('simple', f_unaccent(coalesce(\"content\", ''))), 'B')"]);
        await queryRunner.query(`ALTER TABLE "Note" ADD "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') || setweight(to_tsvector('simple', f_unaccent(coalesce("content", ''))), 'B')) STORED NOT NULL`);
        await queryRunner.query(`CREATE INDEX "Note_search_idx" ON "Note" USING gin ("search") `);
        // --- THÊM TAY ---
        await queryRunner.query(`DROP TEXT SEARCH CONFIGURATION IF EXISTS public.vn_unaccent`);
    }

}
