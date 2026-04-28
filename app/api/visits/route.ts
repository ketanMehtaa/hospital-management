import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be defined.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

export async function GET(request: NextRequest) {
  try {
    const visits = await prisma.visit.findMany({
      take: 20,
      orderBy: { visitAt: 'desc' },
      include: {
        patient: true,
      },
      where: {
        patient: { deletedAt: null },
      },
    });

    const mapped = visits.map((v) => ({
      id: v.patient.id, // Keep patient ID for the edit route
      visitId: v.id, // Unique ID for React keys and specific visit tracking
      name: v.patient.name,
      age: v.patient.age,
      gender: v.patient.gender,
      phone: v.patient.phone,
      address: v.patient.address,
      createdAt: v.patient.createdAt,
      updatedAt: v.patient.updatedAt,
      visitAt: v.visitAt,
      diagnosis: v.diagnosis ?? null,
      visitType: v.type,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch visits.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
