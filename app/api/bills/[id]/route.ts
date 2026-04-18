import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be defined in the environment.");

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

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/bills/[id]">) {
  const { id } = await ctx.params;
  try {
    const bill = await prisma.bill.findFirst({ where: { id, deletedAt: null }, include: includeItems });
    if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    return NextResponse.json(bill);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/bills/[id]">) {
  const { id } = await ctx.params;

  try {
    const existing = await prisma.bill.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          where: { category: "Medicine" },
          select: { medicineId: true, batchId: true, quantity: true },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

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

    if (!patientName?.trim()) return NextResponse.json({ error: "Patient name is required." }, { status: 400 });
    if (!items || items.length === 0) return NextResponse.json({ error: "No items provided." }, { status: 400 });

    const subtotal    = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalAmount = Math.max(0, subtotal - (discount ?? 0));

    const paidSum = (paidCash ?? 0) + (paidOnline ?? 0);
    if (Math.abs(paidSum - totalAmount) > 0.01) {
      return NextResponse.json(
        { error: `Payment mismatch: Cash + Online (Rs. ${paidSum.toFixed(2)}) must equal total (Rs. ${totalAmount.toFixed(2)}).` },
        { status: 400 },
      );
    }

    // Step 1: Return stock from OLD medicine items to their recorded batches.
    // Single-batch-per-item constraint ensures batchId is the only batch deducted from.
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

    // Step 2: FEFO deduction for NEW medicine items — aggregated per medicineId.
    // Bug #5: one stock check per medicine prevents oversell from same snapshot.
    // Bug #3: carry expiryDate+createdAt and sort correctly (FEFO, nulls last).
    // Bug #4: single batch per group so batchId == the only deducted batch.
    type DeductOp = ReturnType<typeof prisma.medicineBatch.update>;
    const deductOps: DeductOp[] = [];
    const itemBatchIds: (string | null)[] = items.map(() => null);

    type MedicineNeed = { indices: number[]; totalQty: number };
    const medicineNeeds = new Map<string, MedicineNeed>();
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.category !== "Medicine" || !item.medicineId) continue;
      const need = medicineNeeds.get(item.medicineId) ?? { indices: [], totalQty: 0 };
      need.indices.push(idx);
      need.totalQty += item.quantity;
      medicineNeeds.set(item.medicineId, need);
    }

    for (const [medId, { indices, totalQty }] of medicineNeeds.entries()) {
      const batches = await prisma.medicineBatch.findMany({
        where: {
          medicineId: medId,
          quantity:   { gt: 0 },
          OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      });

      type AdjustedBatch = { id: string; quantity: number; expiryDate: Date | null; createdAt: Date };
      const adjustedBatches: AdjustedBatch[] = batches.map((b) => ({
        id:         b.id,
        quantity:   Number(b.quantity) + existing.items
          .filter((oi) => oi.batchId === b.id)
          .reduce((s, oi) => s + Number(oi.quantity), 0),
        expiryDate: b.expiryDate,
        createdAt:  b.createdAt,
      }));

      const depletedBatchIds = existing.items
        .filter((oi) => oi.medicineId === medId && oi.batchId)
        .map((oi) => oi.batchId!)
        .filter((bid) => !adjustedBatches.find((b) => b.id === bid));

      if (depletedBatchIds.length > 0) {
        const depletedRows = await prisma.medicineBatch.findMany({
          where: { id: { in: depletedBatchIds } },
        });
        for (const db of depletedRows) {
          const returned = existing.items
            .filter((oi) => oi.batchId === db.id)
            .reduce((s, oi) => s + Number(oi.quantity), 0);
          if (returned > 0) {
            adjustedBatches.push({ id: db.id, quantity: returned, expiryDate: db.expiryDate, createdAt: db.createdAt });
          }
        }
      }

      // Bug #3 fix: sort by expiryDate ASC (nulls last) then createdAt ASC.
      adjustedBatches.sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return a.createdAt.getTime() - b.createdAt.getTime();
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return (
          a.expiryDate.getTime() - b.expiryDate.getTime() ||
          a.createdAt.getTime()  - b.createdAt.getTime()
        );
      });

      if (adjustedBatches.length === 0) {
        const med = await prisma.medicine.findUnique({ where: { id: medId }, select: { name: true } });
        return NextResponse.json({ error: `No stock for ${med?.name ?? medId}.` }, { status: 409 });
      }

      // Bug #4 fix: require a single batch to cover the combined qty.
      const primaryBatch = adjustedBatches.find(b => b.quantity >= totalQty);
      if (!primaryBatch) {
        const totalAvailable = adjustedBatches.reduce((s, b) => s + b.quantity, 0);
        const med = await prisma.medicine.findUnique({ where: { id: medId }, select: { name: true } });
        if (totalAvailable < totalQty) {
          return NextResponse.json(
            { error: `Insufficient stock for ${med?.name ?? medId}. Needed: ${totalQty}, available: ${totalAvailable}.` },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            error: `No single batch covers ${totalQty} unit(s) of ${med?.name ?? medId}. ` +
              `Please split the item into smaller quantities or restock a batch.`,
          },
          { status: 409 },
        );
      }

      for (const idx of indices) {
        itemBatchIds[idx] = primaryBatch.id;
      }
      deductOps.push(
        prisma.medicineBatch.update({
          where: { id: primaryBatch.id },
          data:  { quantity: { decrement: totalQty } },
        }),
      );
    }

    // Step 3: Atomic transaction
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
            deleteMany: {},
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
    const message = error instanceof Error ? error.message : "Could not update bill.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}