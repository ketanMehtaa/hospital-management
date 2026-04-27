-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('Photo', 'Video');

-- CreateTable
CREATE TABLE "patient_media" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "object_key" VARCHAR(500) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_media_patient_id_idx" ON "patient_media"("patient_id");

-- AddForeignKey
ALTER TABLE "patient_media" ADD CONSTRAINT "patient_media_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
