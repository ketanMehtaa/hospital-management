import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be defined in the environment.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const includeItems = {
  items: {
    include: {
      medicine: { select: { id: true, name: true } },
      batch:    { select: { id: true, batchNumber: true } },
    },
  },
} as const;

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/bills/[id]'>) {
  const { id } = await ctx.params;
  try {
    const bill = await prisma.bill.findFirst({ where: { id, deletedAt: null }, include: includeItems });
    if (!bill) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    return NextResponse.json(bill);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/bills/[id]'>) {
  const { id } = await ctx.params;

  try {
    // ── Fetch existing bill with medicine items so we can return stock ─────────
    const existing = await prisma.bill.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          where: { category: 'Medicine' },
          select: { medicineId: true, batchId: true, quantity: true },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });

    const body = await request.json();
    const { patientId, patientName, phone, billAt, discount, paidCash, paidOnline, items } =
      body as {
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

    if (!patientName?.trim()) return NextResponse.json({ error: 'Patient name is required.' }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: 'No items provided.' }, { status: 400 });

    const subtotal    = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalAmount = Math.max(0, subtotal - (discount ?? 0));

    // ── Payment validation ─────────────────────────────────────────────────────
    const paidSum = (paidCash ?? 0) + (paidOnline ?? 0);
    if (Math.abs(paidSum - totalAmount) > 0.01) {
      return NextResponse.json(
        { error: `Payment mismatch: Cash + Online (Rs. ${paidSum.toFixed(2)}) must equal total (Rs. ${totalAmount.toFixed(2)}).` },
        { status: 400 },
      );
    }

    // ── Step 1: Return stock from OLD medicine items back to their batches ─────
    // Return to the exact batches they were taken from (batchId recorded on item)
    const returnOps: ReturnType<typeof prisma.medicineBatch.update>[] = [];
    for (const oldItem of existing.items) {
      if (!oldItem.batchId) continue;
      returnOps.push(
        prisma.medicineBatch.update({
          where: { id: oldItem.batchId },
          data:  { quantity: { increment: Number(oldItem.quantity) } },
        }),
      );
    }

    // ── Step 2: FEFO deduction for NEW medicine items ──────────────────────────
    type DeductOp = ReturnType<typeof prisma.medicineBatch.update>;
    const deductOps: DeductOp[] = [];
    const itemBatchIds: (string | null)[] = items.map(() => null);

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.category !== 'Medicine' || !item.medicineId) continue;

      // Execute returns first inside a mini-transaction so we see restored stock
      // We resolve batches AFTER returns are applied (we do it all in $transaction)
      // Instead: load batches from DB first, add back old quantities in-memory
      const batches = await prisma.medicineBatch.findMany({
        where: {
          medicineId: item.medicineId,
          quantity:   { gt: 0 },
          OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      });

      // Add back quantities from old items that share the same batchId
      const adjustedBatches = batches.map((b) => {
        const returned = existing.items
          .filter((oi) => oi.batchId === b.id)
          .reduce((s, oi) => s + Number(oi.quantity), 0);
        return { id: b.id, quantity: Number(b.quantity) + returned };
      });

      // Also include batches that were fully depleted (quantity = 0) but will be restored
      const depletedBatchIds = existing.items
        .filter((oi) => oi.medicineId === item.medicineId && oi.batchId)
        .map((oi) => oi.batchId!)
        .filter((bid) => !adjustedBatches.find((b) => b.id === bid));

      if (depletedBatchIds.length > 0) {
        const depletedBatches = await prisma.medicineBatch.findMany({
          where: { id: { in: depletedBatchIds } },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        });
        for (const db of depletedBatches) {
          const returned = existing.items
            .filter((oi) => oi.batchId === db.id)
            .reduce((s, oi) => s + Number(oi.quantity), 0);
          if (returned > 0) adjustedBatches.push({ id: db.id, quantity: returned });
        }
        adjustedBatches.sort((a, b) => a.id.localeCompare(b.id)); // stable sort
      }

      let remaining = item.quantity;
      if (adjustedBatches.length === 0 && remaining > 0) {
        const med = await prisma.medicine.findUnique({ where: { id: item.medicineId }, select: { name: true } });
        return NextResponse.json({ error: `No stock for ${med?.name ?? item.description}.` }, { status: 409 });
      }

      itemBatchIds[idx] = adjustedBatches[0]?.id ?? null;

      for (const batch of adjustedBatches) {
        if (remaining <= 0) break;
        const use = Math.min(remaining, batch.quantity);
        deductOps.push(
          prisma.medicineBatch.update({
            where: { id: batch.id },
            data:  { quantity: { decrement: use } },
          }),
        );
        remaining -= use;
      }

      if (remaining > 0) {
        const med = await prisma.medicine.findUnique({ where: { id: item.medicineId }, select: { name: true } });
        return NextResponse.json(
          { error: `Insufficient stock for ${med?.name ?? item.description}.` },
          { status: 409 },
        );
      }
    }

    // ── Step 3: Atomic transaction ─────────────────────────────────────────────
    const [updated] = await prisma.$transaction([
      prisma.bill.update({
        where: { id },
        data: {
          patientId:   patientId ?? null,
          patientName: patientName.trim(),
          phone:        phone ?? null,
          billAt:       new Date(billAt),
          discount:     discount ?? 0,
          totalAmount,
          paidCash:     paidCash  ?? 0,
          paidOnline:   paidOnline ?? 0,
          items: {
            deleteMany: {},   // wipe old items
            create: items.map((item, idx) => ({
              category:    item.category as any,
              description: item.description,
              quantity:    item.quantity,
              unitPrice:   item.unitPrice,
              amount:      item.quantity * item.unitPrice,
              medicineId:  item.medicineId ?? null,
              batchId:     itemBatchIds[idx],
            })),
          },
        },
        include: includeItems,
      }),
      ...returnOps,
      ...deductOps,
    ]);

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update bill.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
