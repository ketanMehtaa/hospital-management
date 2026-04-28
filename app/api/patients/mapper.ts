import { Patient, Visit } from '@/app/generated/prisma/client';

export type PatientWithVisits = Patient & { visits: Visit[] };

export function mapPatientPayload(patient: PatientWithVisits) {
  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    address: patient.address,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    visitAt: patient.visits[0]?.visitAt ?? patient.createdAt,
    diagnosis: patient.visits[0]?.diagnosis ?? null,
    visitType: patient.visits[0]?.type ?? 'Consultation',
  };
}
