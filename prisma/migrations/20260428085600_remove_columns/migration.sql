-- Move existing visit data from patients to visits before dropping columns
INSERT INTO "visits" ("id", "patient_id", "visit_at", "diagnosis", "type", "created_at", "updated_at")
SELECT 
  gen_random_uuid(), 
  "id", 
  "visitAt", 
  "diagnosis", 
  'Consultation', 
  "created_at", 
  "updated_at"
FROM "patients"
WHERE "visitAt" IS NOT NULL;

-- Drop obsolete columns
ALTER TABLE "patients"
RENAME COLUMN "diagnosis" TO "diagnosis_deprecated",
RENAME COLUMN "visitAt" TO "visitAt_deprecated";
-- ALTER TABLE "patients" DROP COLUMN "diagnosis", DROP COLUMN "visitAt";
