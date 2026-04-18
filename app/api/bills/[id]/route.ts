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

const includeItems = {
  items: {
    include: {
      medicine: { select: { id: true, name: true } },
    },
  },
} as const;

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/bills/[id]'>) {
  const { id } = await ctx.params;

  try {
    const bill = await prisma.bill.findFirst({
      where: { id, deletedAt: null },
      include: includeItems,
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    }

    return NextResponse.json(bill);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch bill.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/bills/[id]'>) {
  const { id } = await ctx.params;

  try {
    const existing = await prisma.bill.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    }

    const body = await request.json();
    const {
      patientId,
      patientName,
      phone,
      billAt,
      discount,
      paidCash,
      paidOnline,
      items,
    } = body as {
      patientId?: string;
      patientName: string;
      phone?: string;
      billAt: string;
      discount: number;
      paidCash: number;
      paidOnline: number;
      items: Array<{
        category: string;
        description: string;
        quantity: number;
        unitPrice: number;
        medicineId?: string;
      }>;
    };

    if (!patientName?.trim()) {
      return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required.' }, { status: 400 });
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalAmount = Math.max(0, subtotal - (discount ?? 0));

    // Delete old items and recreate — simpler than diffing and patching
    await prisma.billItem.deleteMany({ where: { billId: id } });

    const updated = await prisma.bill.update({
      where: { id },
      data: {
        patientId: patientId ?? null,
        patientName: patientName.trim(),
        phone: phone ?? null,
        billAt: new Date(billAt),
        discount: discount ?? 0,
        totalAmount,
        paidCash: paidCash ?? 0,
        paidOnline: paidOnline ?? 0,
        items: {
          create: items.map((item) => ({
            category: item.category as Parameters<typeof prisma.billItem.create>[0]['data']['category'],
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            medicineId: item.medicineId ?? null,
          })),
        },
      },
      include: includeItems,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update bill.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
