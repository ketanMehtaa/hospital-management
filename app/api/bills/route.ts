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

type BillPayload = {
  id: string;
  billNumber: string;
  patientId: string | null;
  patientName: string;
  phone: string | null;
  billAt: string;
  discount: number;
  totalAmount: number;
  paidCash: number;
  paidOnline: number;
  createdAt: string;
  items: BillItemPayload[];
};

type BillItemPayload = {
  id: string;
  billId: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  medicineId: string | null;
  medicine?: {
    id: string;
    name: string;
  } | null;
};

export async function GET() {
  try {
    const bills = await prisma.bill.findMany({
      where: { deletedAt: null },
      include: {
        items: {
          include: {
            medicine: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(bills);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch bills.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, patientName, phone, billAt, discount, paidCash, paidOnline, items } = body as {
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

    // Generate bill number
    const billCount = await prisma.bill.count();
    const billNumber = `BILL-${String(billCount + 1).padStart(4, '0')}`;

    // Calculate total amount
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const totalAmount = Math.max(0, subtotal - discount);

    // ── Payment must equal total ─────────────────────────────────────────────
    const paidSum = (paidCash ?? 0) + (paidOnline ?? 0);
    if (Math.abs(paidSum - totalAmount) > 0.01) {
      return NextResponse.json(
        {
          error: `Payment mismatch: Cash + Online (Rs. ${paidSum.toFixed(2)}) must equal the bill total (Rs. ${totalAmount.toFixed(2)}).`,
        },
        { status: 400 },
      );
    }


    // ── Stock sufficiency check ─────────────────────────────────────────────
    // Aggregate requested quantities per medicine (same medicine may appear
    // multiple times on the same bill).
    const medicineItems = items.filter(
      (item) => item.category === 'Medicine' && item.medicineId,
    );

    if (medicineItems.length > 0) {
      // Aggregate: medicineId → totalRequested
      const requested = new Map<string, number>();
      for (const item of medicineItems) {
        requested.set(item.medicineId!, (requested.get(item.medicineId!) ?? 0) + item.quantity);
      }

      // Fetch current stock for every unique medicine in the bill
      const medicineRecords = await prisma.medicine.findMany({
        where: { id: { in: [...requested.keys()] }, deletedAt: null },
        select: { id: true, name: true, stock: true },
      });

      // Identify which medicines don't have enough stock
      const shortages: string[] = [];
      for (const med of medicineRecords) {
        const need = requested.get(med.id) ?? 0;
        const available = Number(med.stock);
        if (available < need) {
          shortages.push(
            `${med.name} (needed: ${need}, available: ${available})`,
          );
        }
      }

      if (shortages.length > 0) {
        return NextResponse.json(
          {
            error: `Insufficient stock for: ${shortages.join('; ')}. Please reduce quantities or restock before billing.`,
          },
          { status: 409 },
        );
      }
    }

    // ── Deduct medicine stock + create bill atomically ─────────────────────
    const stockDecrements = medicineItems.map((item) =>
      prisma.medicine.update({
        where: { id: item.medicineId! },
        data: { stock: { decrement: item.quantity } },
      }),
    );

    const [bill] = await prisma.$transaction([
      prisma.bill.create({
        data: {
          billNumber,
          patientId,
          patientName,
          phone,
          billAt: new Date(billAt),
          discount,
          totalAmount,
          paidCash: paidCash ?? 0,
          paidOnline: paidOnline ?? 0,
          items: {
            create: items.map((item) => ({
              category: item.category as any,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              medicineId: item.medicineId,
            })),
          },
        },
        include: {
          items: {
            include: {
              medicine: { select: { id: true, name: true } },
            },
          },
        },
      }),
      ...stockDecrements,
    ]);

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create bill.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}