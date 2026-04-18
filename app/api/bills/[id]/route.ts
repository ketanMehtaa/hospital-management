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

    // Atomic transaction for returning stock AND deducting new stock
    const updated = await prisma.$transaction(async (tx) => {
      // Step 1: Return stock from OLD medicine items to their recorded batches.
      for (const oldItem of existing.items) {
        if (!oldItem.batchId) continue;
        await tx.medicineBatch.update({
          where: { id: oldItem.batchId },
          data: { quantity: { increment: Number(oldItem.quantity) } },
        });
      }

      // Step 2: FEFO deduction for NEW medicine items — split across batches
      const finalItems = [];
      const medIds = Array.from(new Set(items.map((i) => i.medicineId).filter(Boolean))) as string[];

      const allBatches = await tx.medicineBatch.findMany({
        where: {
          medicineId: { in: medIds },
          quantity: { gt: 0 },
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      });

      const inventory = new Map<string, typeof allBatches>();
      for (const b of allBatches) {
        if (!inventory.has(b.medicineId)) inventory.set(b.medicineId, []);
        inventory.get(b.medicineId)!.push(b);
      }

      const deductOps = new Map<string, number>();

      for (const item of items) {
        if (item.category !== "Medicine" || !item.medicineId) {
          finalItems.push({
            category: item.category as any,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            medicineId: item.medicineId ?? null,
          });
          continue;
        }

        let remaining = item.quantity;
        let expiredAvailable = 0;
        const batches = inventory.get(item.medicineId) ?? [];
        const now = new Date();

        for (const b of batches) {
          if (remaining <= 0) break;
          const deductedSoFar = deductOps.get(b.id) ?? 0;
          const available = Number(b.quantity) - deductedSoFar;
          
          if (available <= 0) continue;

          if (b.expiryDate && new Date(b.expiryDate) < now) {
            expiredAvailable += available;
            continue;
          }

          const take = Math.min(remaining, available);
          deductOps.set(b.id, deductedSoFar + take);

          finalItems.push({
            category: item.category as any,
            description: item.description,
            quantity: take,
            unitPrice: item.unitPrice,
            amount: take * item.unitPrice,
            medicineId: item.medicineId,
            batchId: b.id,
          });

          remaining -= take;
        }

        if (remaining > 0) {
          const mName = item.description || item.medicineId;
          if (expiredAvailable > 0 && expiredAvailable >= remaining) {
            throw new Error(`Cannot add ${mName}. The remaining active stock is insufficient because ${expiredAvailable} unit(s) are expired.`);
          }
          throw new Error(`Insufficient stock for ${mName}. Short by ${remaining} unit(s)${expiredAvailable > 0 ? ` (and ${expiredAvailable} unit(s) are expired)` : ''}.`);
        }
      }

      for (const [batchId, deductQty] of deductOps.entries()) {
        await tx.medicineBatch.update({
          where: { id: batchId },
          data: { quantity: { decrement: deductQty } },
        });
      }

      // Step 3: Update bill and rewrite items
      return await tx.bill.update({
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
            deleteMany: {},
            create: finalItems,
          },
        },
        include: includeItems,
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update bill.";
    const status = message.includes("Insufficient stock") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}