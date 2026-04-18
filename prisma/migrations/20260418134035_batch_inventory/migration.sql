/*
  Warnings:

  - You are about to drop the column `batch_number` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `expiry_date` on the `medicines` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `medicines` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "medicines_expiry_date_idx";

-- AlterTable
ALTER TABLE "bill_items" ADD COLUMN     "batch_id" UUID;

-- AlterTable
ALTER TABLE "medicines" DROP COLUMN "batch_number",
DROP COLUMN "expiry_date",
DROP COLUMN "stock";

-- CreateTable
CREATE TABLE "medicine_batches" (
    "id" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batch_number" VARCHAR(100),
    "expiry_date" DATE,
    "quantity" DECIMAL(10,2) NOT NULL,
    "purchase_price" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medicine_batches_medicineId_idx" ON "medicine_batches"("medicineId");

-- CreateIndex
CREATE INDEX "medicine_batches_expiry_date_idx" ON "medicine_batches"("expiry_date");

-- CreateIndex
CREATE INDEX "bill_items_batch_id_idx" ON "bill_items"("batch_id");

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
