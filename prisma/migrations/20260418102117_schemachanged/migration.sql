/*
  Warnings:

  - The primary key for the `bill_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `quantity` on the `bill_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `unit_price` on the `bill_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `bill_items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The `medicine_id` column on the `bill_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `bills` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `bill_date` on the `bills` table. All the data in the column will be lost.
  - You are about to drop the column `bill_time` on the `bills` table. All the data in the column will be lost.
  - The `patient_id` column on the `bills` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `phone` on the `bills` table. The data in that column could be lost. The data in that column will be cast from `VarChar(20)` to `VarChar(15)`.
  - You are about to alter the column `discount` on the `bills` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `total_amount` on the `bills` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The primary key for the `medicines` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `buying_price` on the `medicines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `selling_price` on the `medicines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `stock` on the `medicines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `min_stock` on the `medicines` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - The primary key for the `patients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `notes` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `patient_type` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `visit_date` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `visit_time` on the `patients` table. All the data in the column will be lost.
  - You are about to alter the column `phone` on the `patients` table. The data in that column could be lost. The data in that column will be cast from `VarChar(20)` to `VarChar(15)`.
  - A unique constraint covering the columns `[phone]` on the table `patients` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id` on the `bill_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `bill_id` on the `bill_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `bill_at` to the `bills` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `bills` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `medicines` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `visitAt` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `patients` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `age` on table `patients` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gender` on table `patients` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "bill_items" DROP CONSTRAINT "bill_items_bill_id_fkey";

-- DropForeignKey
ALTER TABLE "bill_items" DROP CONSTRAINT "bill_items_medicine_id_fkey";

-- DropForeignKey
ALTER TABLE "bills" DROP CONSTRAINT "bills_patient_id_fkey";

-- DropIndex
DROP INDEX "bills_bill_date_idx";

-- AlterTable
ALTER TABLE "bill_items" DROP CONSTRAINT "bill_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "bill_id",
ADD COLUMN     "bill_id" UUID NOT NULL,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "medicine_id",
ADD COLUMN     "medicine_id" UUID,
ADD CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bills" DROP CONSTRAINT "bills_pkey",
DROP COLUMN "bill_date",
DROP COLUMN "bill_time",
ADD COLUMN     "bill_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "patient_id",
ADD COLUMN     "patient_id" UUID,
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(15),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total_amount" DROP DEFAULT,
ALTER COLUMN "total_amount" SET DATA TYPE DECIMAL(10,2),
ADD CONSTRAINT "bills_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "medicines" DROP CONSTRAINT "medicines_pkey",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "buying_price" DROP DEFAULT,
ALTER COLUMN "buying_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "selling_price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "stock" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "min_stock" SET DATA TYPE DECIMAL(10,2),
ADD CONSTRAINT "medicines_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "patients" DROP CONSTRAINT "patients_pkey",
DROP COLUMN "notes",
DROP COLUMN "patient_type",
DROP COLUMN "visit_date",
DROP COLUMN "visit_time",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "visitAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "age" SET NOT NULL,
ALTER COLUMN "gender" SET NOT NULL,
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(15),
ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");

-- DropEnum
DROP TYPE "PatientType";

-- CreateIndex
CREATE INDEX "bill_items_bill_id_idx" ON "bill_items"("bill_id");

-- CreateIndex
CREATE INDEX "bill_items_medicine_id_idx" ON "bill_items"("medicine_id");

-- CreateIndex
CREATE INDEX "bills_patient_id_idx" ON "bills"("patient_id");

-- CreateIndex
CREATE INDEX "bills_bill_at_idx" ON "bills"("bill_at");

-- CreateIndex
CREATE INDEX "medicines_expiry_date_idx" ON "medicines"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "patients_phone_key" ON "patients"("phone");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
