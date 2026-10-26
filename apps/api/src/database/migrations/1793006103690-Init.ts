import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1793006103690 implements MigrationInterface {
    name = 'Init1793006103690'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- THÊM TAY: phải có trước CREATE TABLE "Note" (cột generated "search" gọi f_unaccent) ---
        // unaccent() không IMMUTABLE nên không dùng thẳng trong generated column; bọc lại thành hàm IMMUTABLE.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public`);
        await queryRunner.query(`CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT public.unaccent('public.unaccent', $1) $$`);
        // --- Hết phần thêm tay. Phần dưới do migration:generate sinh ra, giữ nguyên. ---
        // (TypeORM 1.x tự sinh GIN index "Note_search_idx" từ @Index({ type: 'gin' }).)
        await queryRunner.query(`CREATE TABLE "Tag" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(64) NOT NULL, CONSTRAINT "UQ_ced96b925beb1cc0c09c1b7d5c4" UNIQUE ("name"), CONSTRAINT "PK_00bd1ec314f664289873394731a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["notebook","public","Note","GENERATED_COLUMN","search","setweight(to_tsvector('simple', f_unaccent(coalesce(\"title\", ''))), 'A') || setweight(to_tsvector('simple', f_unaccent(coalesce(\"content\", ''))), 'B')"]);
        await queryRunner.query(`CREATE TABLE "Note" ("id" uuid NOT NULL, "title" text NOT NULL DEFAULT '', "content" text NOT NULL DEFAULT '', "type" character varying(16) NOT NULL DEFAULT 'LEARNING', "status" character varying(16) NOT NULL DEFAULT 'ACTIVE', "entryDate" date NOT NULL, "pinned" boolean NOT NULL DEFAULT false, "version" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "search" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', f_unaccent(coalesce("title", ''))), 'A') || setweight(to_tsvector('simple', f_unaccent(coalesce("content", ''))), 'B')) STORED NOT NULL, CONSTRAINT "CHK_db8c4081f41a921c29dd84e60c" CHECK ("status" IN ('INBOX', 'ACTIVE', 'ARCHIVED')), CONSTRAINT "CHK_c4681a2d21a5462abf915a24cd" CHECK ("type" IN ('LEARNING', 'PERSONAL')), CONSTRAINT "PK_a677a8365a6131301c9c01254e9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "Note_search_idx" ON "Note" USING gin ("search") `);
        await queryRunner.query(`CREATE INDEX "Note_status_idx" ON "Note"  ("status") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE INDEX "Note_entryDate_idx" ON "Note"  ("entryDate") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`CREATE TABLE "NoteTag" ("noteId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_84b3f0fbecb7e780245eb823e83" PRIMARY KEY ("noteId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_677f075e80b1f5b996ece94469" ON "NoteTag"  ("noteId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ebdc1215897db2dfe1f8419c2" ON "NoteTag"  ("tagId") `);
        await queryRunner.query(`ALTER TABLE "NoteTag" ADD CONSTRAINT "FK_677f075e80b1f5b996ece944695" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "NoteTag" ADD CONSTRAINT "FK_4ebdc1215897db2dfe1f8419c2c" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "NoteTag" DROP CONSTRAINT "FK_4ebdc1215897db2dfe1f8419c2c"`);
        await queryRunner.query(`ALTER TABLE "NoteTag" DROP CONSTRAINT "FK_677f075e80b1f5b996ece944695"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ebdc1215897db2dfe1f8419c2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_677f075e80b1f5b996ece94469"`);
        await queryRunner.query(`DROP TABLE "NoteTag"`);
        await queryRunner.query(`DROP INDEX "public"."Note_entryDate_idx"`);
        await queryRunner.query(`DROP INDEX "public"."Note_status_idx"`);
        await queryRunner.query(`DROP INDEX "public"."Note_search_idx"`);
        await queryRunner.query(`DROP TABLE "Note"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","search","notebook","public","Note"]);
        await queryRunner.query(`DROP TABLE "Tag"`);
        // --- THÊM TAY: gỡ hàm và extension sau khi bảng "Note" đã bị drop ---
        await queryRunner.query(`DROP FUNCTION IF EXISTS public.f_unaccent(text)`);
        await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
    }

}
