import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be defined in the environment.');

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
  batchId: string | null;
  medicine?: { id: string; name: string } | null;
};

export async function GET() {
  try {
    const bills = await prisma.bill.findMany({
      where: { deletedAt: null },
      include: {
        items: {
          include: {
            medicine: { select: { id: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
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

    // ── Bill number ───────────────────────────────────────────────────────────
    const billCount = await prisma.bill.count();
    const billNumber = `BILL-${String(billCount + 1).padStart(4, '0')}`;

    // ── Totals ────────────────────────────────────────────────────────────────
    const subtotal    = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const totalAmount = Math.max(0, subtotal - discount);

    // ── Payment validation ────────────────────────────────────────────────────
    const paidSum = (paidCash ?? 0) + (paidOnline ?? 0);
    if (Math.abs(paidSum - totalAmount) > 0.01) {
      return NextResponse.json(
        { error: `Payment mismatch: Cash + Online (Rs. ${paidSum.toFixed(2)}) must equal the bill total (Rs. ${totalAmount.toFixed(2)}).` },
        { status: 400 },
      );
    }

    // ── FEFO batch resolution ─────────────────────────────────────────────────
    // Build a map: medicineId → total qty requested (same medicine may appear multiple times)
    const medicineItems = items.filter((i) => i.category === 'Medicine' && i.medicineId);

    // For each medicine item we need to pick batches in FEFO order.
    // We build a flat deduction plan: { batchId, reduceBy }[]
    // and also resolve which batchId to record on the BillItem.

    type DeductionOp = { batchId: string; reduceBy: number };
    const deductions: DeductionOp[] = [];

    // medicineItemBatchId[i] = batchId chosen for items[i] (single-batch FEFO pick for UI)
    const itemBatchIds: (string | null)[] = items.map(() => null);

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.category !== 'Medicine' || !item.medicineId) continue;

      let remaining = item.quantity;

      // Fetch non-expired, in-stock batches ordered by expiryDate ASC (FEFO)
      const batches = await prisma.medicineBatch.findMany({
        where: {
          medicineId: item.medicineId,
          quantity:   { gt: 0 },
          OR: [
            { expiryDate: null },
            { expiryDate: { gte: new Date() } },
          ],
        },
        orderBy: [
          { expiryDate: 'asc' },
          { createdAt:  'asc' },
        ],
      });

      if (batches.length === 0) {
        const med = await prisma.medicine.findUnique({ where: { id: item.medicineId }, select: { name: true } });
        return NextResponse.json(
          { error: `No stock available for ${med?.name ?? item.description}. Please restock first.` },
          { status: 409 },
        );
      }

      // Record the first-used batch as the item's batchId (for audit)
      itemBatchIds[idx] = batches[0].id;

      for (const batch of batches) {
        if (remaining <= 0) break;
        const use = Math.min(remaining, Number(batch.quantity));
        deductions.push({ batchId: batch.id, reduceBy: use });
        remaining -= use;
      }

      if (remaining > 0) {
        const med = await prisma.medicine.findUnique({ where: { id: item.medicineId }, select: { name: true } });
        return NextResponse.json(
          { error: `Insufficient stock for ${med?.name ?? item.description}. Requested: ${item.quantity}, available: ${item.quantity - remaining}.` },
          { status: 409 },
        );
      }
    }

    // ── Atomic: deduct batches + create bill ──────────────────────────────────
    const batchDecrements = deductions.map((op) =>
      prisma.medicineBatch.update({
        where: { id: op.batchId },
        data:  { quantity: { decrement: op.reduceBy } },
      }),
    );

    const [bill] = await prisma.$transaction([
      prisma.bill.create({
        data: {
          billNumber,
          patientId,
          patientName,
          phone,
          billAt:      new Date(billAt),
          discount,
          totalAmount,
          paidCash:    paidCash   ?? 0,
          paidOnline:  paidOnline ?? 0,
          items: {
            create: items.map((item, idx) => ({
              category:    item.category as any,
              description: item.description,
              quantity:    item.quantity,
              unitPrice:   item.unitPrice,
              amount:      item.quantity * item.unitPrice,
              medicineId:  item.medicineId,
              batchId:     itemBatchIds[idx],
            })),
          },
        },
        include: {
          items: {
            include: {
              medicine: { select: { id: true, name: true } },
              batch:    { select: { id: true, batchNumber: true } },
            },
          },
        },
      }),
      ...batchDecrements,
    ]);

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create bill.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}