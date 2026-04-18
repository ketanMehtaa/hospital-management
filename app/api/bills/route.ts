import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be defined in the environment.");

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitStr = searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  try {
    const bills = await prisma.bill.findMany({
      where: { deletedAt: null },
      take: limit && !isNaN(limit) ? limit : undefined,
      include: {
        items: {
          include: {
            medicine: { select: { id: true, name: true } },
            batch: { select: { id: true, batchNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(bills);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch bills.";
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

    // Bill number: UUID, collision-free regardless of soft-deletes (Bug #1 fix)
    const billNumber = crypto.randomUUID();

    // Totals
    const subtotal    = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const totalAmount = Math.max(0, subtotal - discount);

    // Payment validation
    const paidSum = (paidCash ?? 0) + (paidOnline ?? 0);
    if (Math.abs(paidSum - totalAmount) > 0.01) {
      return NextResponse.json(
        { error: `Payment mismatch: Cash + Online (Rs. ${paidSum.toFixed(2)}) must equal the bill total (Rs. ${totalAmount.toFixed(2)}).` },
        { status: 400 },
      );
    }

    // FEFO batch resolution - aggregated per medicineId, single batch per group.
    // Bug #5 fix: aggregate all items for the same medicine before any stock check
    // so independent reads of the same DB snapshot cannot each "see" full stock.
    // Bug #4 fix: require one batch to cover the full combined qty so
    // BillItem.batchId is always the SOLE batch deducted from, making returns accurate.
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

    type DeductionOp = { batchId: string; reduceBy: number };
    const deductions: DeductionOp[] = [];
    const itemBatchIds: (string | null)[] = items.map(() => null);

    for (const [medId, { indices, totalQty }] of medicineNeeds.entries()) {
      const batches = await prisma.medicineBatch.findMany({
        where: {
          medicineId: medId,
          quantity:   { gt: 0 },
          OR: [
            { expiryDate: null },
            { expiryDate: { gte: new Date() } },
          ],
        },
        orderBy: [
          { expiryDate: "asc" },
          { createdAt:  "asc" },
        ],
      });

      if (batches.length === 0) {
        const med = await prisma.medicine.findUnique({ where: { id: medId }, select: { name: true } });
        return NextResponse.json(
          { error: `No stock available for ${med?.name ?? medId}. Please restock first.` },
          { status: 409 },
        );
      }

      const primaryBatch = batches.find(b => Number(b.quantity) >= totalQty);
      if (!primaryBatch) {
        const totalAvailable = batches.reduce((s, b) => s + Number(b.quantity), 0);
        const med = await prisma.medicine.findUnique({ where: { id: medId }, select: { name: true } });
        if (totalAvailable < totalQty) {
          return NextResponse.json(
            { error: `Insufficient stock for ${med?.name ?? medId}. Requested: ${totalQty}, available: ${totalAvailable}. Please restock.` },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            error: `No single batch has ${totalQty} unit(s) of ${med?.name ?? medId}. ` +
              `The earliest-expiring batch (${batches[0].batchNumber ?? "no batch #"}) has ${Number(batches[0].quantity)} unit(s). ` +
              `Please reduce the quantity, split into separate line-items, or restock a batch.`,
          },
          { status: 409 },
        );
      }

      for (const idx of indices) {
        itemBatchIds[idx] = primaryBatch.id;
      }
      deductions.push({ batchId: primaryBatch.id, reduceBy: totalQty });
    }

    // Atomic: deduct batches + create bill
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
    const message = error instanceof Error ? error.message : "Could not create bill.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
