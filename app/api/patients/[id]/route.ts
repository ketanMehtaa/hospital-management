import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';

import { mapPatientPayload } from '../mapper';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/patients/[id]'>) {
  const { id } = await ctx.params;

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, deletedAt: null },
      include: {
        visits: {
          orderBy: { visitAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    }

    return NextResponse.json(mapPatientPayload(patient));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch patient.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/patients/[id]'>) {
  const { id } = await ctx.params;

  try {
    const existing = await prisma.patient.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        phone: true,
        visits: { orderBy: { visitAt: 'desc' }, take: 1, select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      age,
      gender,
      phone,
      address,
      diagnosis,
      visitAt,
      visitDate,
      visitTime,
      visitType,
      action,
    } = body as {
      name?: string;
      age?: number;
      gender?: string;
      phone?: string;
      address?: string;
      diagnosis?: string;
      visitAt?: string;
      visitDate?: string;
      visitTime?: string;
      visitType?: string;
      action?: 'edit' | 'follow-up';
    };

    const normalizedName = name?.trim();
    if (!normalizedName) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    if (age === undefined || age === null || typeof age !== 'number') {
      return NextResponse.json(
        { error: 'Age must be a number between 0 and 110.' },
        { status: 400 },
      );
    }

    const normalizedAge = Math.trunc(age);
    if (normalizedAge < 0 || normalizedAge > 110) {
      return NextResponse.json(
        { error: 'Age must be an integer between 0 and 110.' },
        { status: 400 },
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

    const normalizedPhone = phone?.replace(/\D/g, '') ?? '';
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return NextResponse.json(
        { error: 'Phone number must be exactly 10 digits.' },
        { status: 400 },
      );
    }

    if (normalizedPhone !== existing.phone) {
      const conflict = await prisma.patient.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      });
      if (conflict) {
        return NextResponse.json(
          { error: 'A patient with this phone number already exists.' },
          { status: 409 },
        );
      }
    }

    const fallbackVisitTime = visitTime?.trim() || new Date().toTimeString().slice(0, 5);
    const visitDateTimeInput =
      visitAt?.trim() || (visitDate ? `${visitDate}T${fallbackVisitTime}:00` : '');
    const parsedVisitAt = new Date(visitDateTimeInput);
    if (!visitDateTimeInput || Number.isNaN(parsedVisitAt.getTime())) {
      return NextResponse.json({ error: 'Visit date and time must be valid.' }, { status: 400 });
    }

    const visitPayload: any =
      action === 'follow-up' || existing.visits.length === 0
        ? {
            create: {
              visitAt: parsedVisitAt,
              diagnosis: diagnosis?.trim() || undefined,
              type: visitType === 'Consultation' ? 'Consultation' : 'FollowUp',
            },
          }
        : {
            update: {
              where: { id: existing.visits[0].id },
              data: {
                visitAt: parsedVisitAt,
                diagnosis: diagnosis?.trim() || null,
                type: visitType === 'FollowUp' ? 'FollowUp' : 'Consultation',
              },
            },
          };

    const finalPatient = await prisma.patient.update({
      where: { id },
      data: {
        name: normalizedName,
        age: normalizedAge,
        gender: normalizedGender,
        phone: normalizedPhone,
        address: address?.trim() || null,
        visits: visitPayload,
      },
      include: {
        visits: {
          orderBy: { visitAt: 'desc' },
          take: 1,
        },
      },
    });

    return NextResponse.json(mapPatientPayload(finalPatient));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update patient.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
