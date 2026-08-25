import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1787616473478 implements MigrationInterface {
    name = 'InitialSchema1787616473478'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."billing_batches_status_enum" AS ENUM('PROCESSED', 'ERROR')`);
        await queryRunner.query(`CREATE TYPE "public"."billing_batches_syncstatus_enum" AS ENUM('PENDING', 'SYNCED', 'ERROR')`);
        await queryRunner.query(`CREATE TABLE "billing_batches" ("id" SERIAL NOT NULL, "issueDate" date NOT NULL, "receiptBook" character varying NOT NULL, "status" "public"."billing_batches_status_enum" NOT NULL DEFAULT 'PROCESSED', "syncStatus" "public"."billing_batches_syncstatus_enum" NOT NULL DEFAULT 'PENDING', "syncedAt" TIMESTAMP, "errorMessage" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3976c88aa200cd1afa40ca927fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "invoices" ("id" SERIAL NOT NULL, "invoiceNumber" character varying NOT NULL, "cae" character varying NOT NULL, "issueDate" date NOT NULL, "amount" numeric(10,2) NOT NULL, "batchId" integer NOT NULL, "pendingId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."billing_pendings_status_enum" AS ENUM('PENDING', 'INVOICED')`);
        await queryRunner.query(`CREATE TABLE "billing_pendings" ("id" SERIAL NOT NULL, "serviceId" integer NOT NULL, "status" "public"."billing_pendings_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5323bcee4ed75b4be100256d6cc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."services_status_enum" AS ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "services" ("id" SERIAL NOT NULL, "serviceDate" date NOT NULL, "customerId" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."services_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "billing_sequences" ("receiptBook" character varying NOT NULL, "lastValue" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_92f20cf09ad6b3307be6c5dfaa0" PRIMARY KEY ("receiptBook"))`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_bdef5dd10ff4d7d11b31008e141" FOREIGN KEY ("batchId") REFERENCES "billing_batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_fb37360703f36b78c90a8ba671a" FOREIGN KEY ("pendingId") REFERENCES "billing_pendings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "billing_pendings" ADD CONSTRAINT "FK_52aac71142edc8a7c3418925202" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "billing_pendings" DROP CONSTRAINT "FK_52aac71142edc8a7c3418925202"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_fb37360703f36b78c90a8ba671a"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_bdef5dd10ff4d7d11b31008e141"`);
        await queryRunner.query(`DROP TABLE "billing_sequences"`);
        await queryRunner.query(`DROP TABLE "services"`);
        await queryRunner.query(`DROP TYPE "public"."services_status_enum"`);
        await queryRunner.query(`DROP TABLE "billing_pendings"`);
        await queryRunner.query(`DROP TYPE "public"."billing_pendings_status_enum"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TABLE "billing_batches"`);
        await queryRunner.query(`DROP TYPE "public"."billing_batches_syncstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."billing_batches_status_enum"`);
    }

}
