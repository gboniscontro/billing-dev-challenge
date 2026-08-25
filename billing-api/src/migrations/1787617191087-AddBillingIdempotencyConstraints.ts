import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBillingIdempotencyConstraints1787617191087 implements MigrationInterface {
    name = 'AddBillingIdempotencyConstraints1787617191087'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_fb37360703f36b78c90a8ba671a"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "UQ_bf8e0f9dd4558ef209ec111782d" UNIQUE ("invoiceNumber")`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "UQ_fb37360703f36b78c90a8ba671a" UNIQUE ("pendingId")`);
        await queryRunner.query(`ALTER TABLE "billing_pendings" DROP CONSTRAINT "FK_52aac71142edc8a7c3418925202"`);
        await queryRunner.query(`ALTER TABLE "billing_pendings" ADD CONSTRAINT "UQ_52aac71142edc8a7c3418925202" UNIQUE ("serviceId")`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_fb37360703f36b78c90a8ba671a" FOREIGN KEY ("pendingId") REFERENCES "billing_pendings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "billing_pendings" ADD CONSTRAINT "FK_52aac71142edc8a7c3418925202" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "billing_pendings" DROP CONSTRAINT "FK_52aac71142edc8a7c3418925202"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_fb37360703f36b78c90a8ba671a"`);
        await queryRunner.query(`ALTER TABLE "billing_pendings" DROP CONSTRAINT "UQ_52aac71142edc8a7c3418925202"`);
        await queryRunner.query(`ALTER TABLE "billing_pendings" ADD CONSTRAINT "FK_52aac71142edc8a7c3418925202" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "UQ_fb37360703f36b78c90a8ba671a"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "UQ_bf8e0f9dd4558ef209ec111782d"`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_fb37360703f36b78c90a8ba671a" FOREIGN KEY ("pendingId") REFERENCES "billing_pendings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
