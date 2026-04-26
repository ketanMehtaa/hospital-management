import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be defined.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/**
 * PATCH /api/medicines/batches/[batchId]
 * Allows editing any field of a single MedicineBatch:
 *   batchNumber, expiryDate, quantity, purchasePrice
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

  const batch = await prisma.medicineBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;

  const quantity = toNum(body['quantity']);
  const purchasePrice = toNum(body['purchasePrice']);
  const batchNumber =
    typeof body['batchNumber'] === 'string' ? body['batchNumber'].trim() || null : undefined;
  const expiryDate = typeof body['expiryDate'] === 'string' ? body['expiryDate'] : undefined;

  if (quantity !== undefined && quantity < 0) {
    return NextResponse.json({ error: 'Quantity cannot be negative.' }, { status: 400 });
  }

  const updated = await prisma.medicineBatch.update({
    where: { id: batchId },
    data: {
      ...(batchNumber !== undefined ? { batchNumber } : {}),
      ...(expiryDate !== undefined ? { expiryDate: expiryDate ? new Date(expiryDate) : null } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(purchasePrice !== undefined ? { purchasePrice } : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    batchNumber: updated.batchNumber,
    expiryDate: updated.expiryDate,
    quantity: Number(updated.quantity),
    purchasePrice: updated.purchasePrice === null ? null : Number(updated.purchasePrice),
    createdAt: updated.createdAt,
  });
}

/**
 * DELETE /api/medicines/batches/[batchId]
 * Removes a batch (only allowed if quantity is 0 — already fully sold out)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

  const batch = await prisma.medicineBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });

  if (Number(batch.quantity) > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete a batch with remaining stock (${Number(batch.quantity)} units). Zero out the quantity first.`,
      },
      { status: 409 },
    );
  }

  await prisma.medicineBatch.delete({ where: { id: batchId } });
  return NextResponse.json({ ok: true });
}
