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
    const { patientId, patientName, phone, billAt, discount, items } = body as {
      patientId?: string;
      patientName: string;
      phone?: string;
      billAt: string;
      discount: number;
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

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        patientId,
        patientName,
        phone,
        billAt: new Date(billAt),
        discount,
        totalAmount,
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
            medicine: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create bill.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}