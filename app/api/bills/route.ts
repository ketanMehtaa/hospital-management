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

    const bill = await prisma.$transaction(async (tx) => {
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

      return await tx.bill.create({
        data: {
          billNumber,
          patientId: patientId ?? null,
          patientName,
          phone: phone ?? null,
          billAt: new Date(billAt),
          discount,
          totalAmount,
          paidCash: paidCash ?? 0,
          paidOnline: paidOnline ?? 0,
          items: { create: finalItems },
        },
        include: {
          items: {
            include: {
              medicine: { select: { id: true, name: true } },
              batch: { select: { id: true, batchNumber: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create bill.";
    // Map custom insufficient stock errors to 409
    const status = message.includes("Insufficient stock") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
