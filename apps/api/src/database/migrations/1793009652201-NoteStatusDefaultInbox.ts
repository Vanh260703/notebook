import { MigrationInterface, QueryRunner } from "typeorm";

export class NoteStatusDefaultInbox1793009652201 implements MigrationInterface {
    name = 'NoteStatusDefaultInbox1793009652201'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Note" ALTER COLUMN "status" SET DEFAULT 'INBOX'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Note" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'`);
    }

}
