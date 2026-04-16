import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

export async function GET() {
  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(patients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, age, gender, phone, address, diagnosis, notes, visitDate, visitTime, patientType } = body as {
    name?: string;
    age?: number;
    gender?: string;
    phone?: string;
    address?: string;
    diagnosis?: string;
    notes?: string;
    visitDate?: string;
    visitTime?: string;
    patientType?: string;
  };

  if (!name || !visitDate) {
    return NextResponse.json({ error: 'Name and visit date are required.' }, { status: 400 });
  }

  const parsedDate = new Date(visitDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Visit date must be a valid date.' }, { status: 400 });
  }

  const patient = await prisma.patient.create({
    data: {
      name,
      age: age ?? undefined,
      gender: gender as 'Male' | 'Female' | 'Other' | undefined,
      phone: phone?.trim() || undefined,
      address: address?.trim() || undefined,
      diagnosis: diagnosis?.trim() || undefined,
      notes: notes?.trim() || undefined,
      visitDate: parsedDate,
      visitTime: visitTime?.trim() || undefined,
      patientType: (patientType as 'fresh' | 'followup') ?? 'fresh',
    },
  });

  return NextResponse.json(patient, { status: 201 });
}
