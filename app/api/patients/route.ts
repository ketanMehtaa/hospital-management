import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

export async function GET() {
  try {
    const patients = await prisma.patient.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(patients);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch patients.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, age, gender, phone, address, diagnosis, visitAt, visitDate, visitTime } =
      body as {
        name?: string;
        age?: number;
        gender?: string;
        phone?: string;
        address?: string;
        diagnosis?: string;
        visitAt?: string;
        visitDate?: string;
        visitTime?: string;
      };

    const normalizedName = name?.trim();
    const normalizedPhone = phone?.replace(/\D/g, '') ?? '';
    const fallbackVisitTime = visitTime?.trim() || new Date().toTimeString().slice(0, 5);

    if (!normalizedName || !normalizedPhone || age === undefined || age === null || !gender) {
      return NextResponse.json(
        { error: 'Name, age, gender, and phone number are required.' },
        { status: 400 },
      );
    }

    if (normalizedPhone.length !== 10) {
      return NextResponse.json(
        { error: 'Phone number must be exactly 10 digits.' },
        { status: 400 },
      );
    }

    if (typeof age !== 'number') {
      return NextResponse.json(
        { error: 'Age must be a number between 0 and 110.' },
        { status: 400 },
      );
    }

    const normalizedAge = Math.trunc(age);

    if (!Number.isInteger(age) || normalizedAge < 0 || normalizedAge > 110) {
      return NextResponse.json(
        { error: 'Age must be an integer between 0 and 110.' },
        { status: 400 },
      );
    }

    const visitDateTimeInput =
      visitAt?.trim() || (visitDate ? `${visitDate}T${fallbackVisitTime}:00` : '');
    const parsedVisitAt = new Date(visitDateTimeInput);
    if (Number.isNaN(parsedVisitAt.getTime())) {
      return NextResponse.json({ error: 'Visit date and time must be valid.' }, { status: 400 });
    }

    const existingPatient = await prisma.patient.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (existingPatient) {
      return NextResponse.json(
        { error: 'A patient with this phone number already exists.' },
        { status: 409 },
      );
    }

    const normalizedGender =
      gender === 'Male' || gender === 'Female' || gender === 'Other'
        ? (gender as 'Male' | 'Female' | 'Other')
        : undefined;

    if (!normalizedGender) {
      return NextResponse.json(
        { error: 'Gender must be Male, Female, or Other.' },
        { status: 400 },
      );
    }

    const patient = await prisma.patient.create({
      data: {
        name: normalizedName,
        age: normalizedAge,
        gender: normalizedGender,
        phone: normalizedPhone,
        address: address?.trim() || undefined,
        diagnosis: diagnosis?.trim() || undefined,
        visitAt: parsedVisitAt,
      },
    });

    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create patient.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
