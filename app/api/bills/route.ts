import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, type BillCategory } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type BillItemPayload = {
  medicineId?: number;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

export async function GET() {
  const bills = await prisma.bill.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return NextResponse.json(bills);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    patientId?: number;
    patientName?: string;
    phone?: string;
    billDate?: string;
    billTime?: string;
    discount?: number;
    items?: BillItemPayload[];
  };

  const { patientId, patientName, phone, billDate, billTime, discount = 0, items } = body;

  if (!patientName?.trim()) {
    return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 });
  }

  if (!billDate) {
    return NextResponse.json({ error: 'Bill date is required.' }, { status: 400 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'At least one billing item is required.' }, { status: 400 });
  }

  const parsedDate = new Date(billDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Bill date must be valid.' }, { status: 400 });
  }

  const lineItems = items.map((item) => ({
    medicineId: item.medicineId ?? undefined,
    category: item.category,
    description: item.description.trim(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount,
  }));

  for (const item of lineItems) {
    if (item.quantity <= 0) {
      return NextResponse.json({ error: 'Each billing item must have a quantity greater than zero.' }, { status: 400 });
    }
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0) - discount;
  if (totalAmount < 0) {
    return NextResponse.json({ error: 'Discount cannot exceed the bill total.' }, { status: 400 });
  }

  const medicineTotals = new Map<number, number>();
  for (const item of lineItems) {
    if (!item.medicineId) continue;
    medicineTotals.set(item.medicineId, (medicineTotals.get(item.medicineId) ?? 0) + item.quantity);
  }

  const medicineIds = Array.from(medicineTotals.keys());
  const medicines = medicineIds.length
    ? await prisma.medicine.findMany({ where: { id: { in: medicineIds } } })
    : [];

  for (const [medicineId, requiredQty] of medicineTotals.entries()) {
    const medicine = medicines.find((m) => m.id === medicineId);
    if (!medicine) {
      return NextResponse.json({ error: `Medicine with id ${medicineId} was not found.` }, { status: 400 });
    }
    if (medicine.stock < requiredQty) {
      return NextResponse.json(
        { error: `Not enough stock for ${medicine.name}. Available ${medicine.stock}, requested ${requiredQty}.` },
        { status: 400 }
      );
    }
  }

  const bill = await prisma.$transaction(async (tx) => {
    const createdBill = await tx.bill.create({
      data: {
        billNumber: `BILL-${Date.now()}`,
        patientId: patientId ?? undefined,
        patientName: patientName.trim(),
        phone: phone?.trim() || undefined,
        billDate: parsedDate,
        billTime: billTime?.trim() || undefined,
        discount,
        totalAmount,
        items: {
          create: lineItems.map((item) => ({
            medicineId: item.medicineId ?? undefined,
            category: item.category as BillCategory,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),
        },
      },
      include: { items: true },
    });

    await Promise.all(
      medicineIds.map((medicineId) =>
        tx.medicine.update({
          where: { id: medicineId },
          data: { stock: { decrement: medicineTotals.get(medicineId) ?? 0 } },
        })
      )
    );

    return createdBill;
  });

  return NextResponse.json(bill, { status: 201 });
}
