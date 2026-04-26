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

const toPayload = (m: any) => ({
  id: m.id,
  barcode: m.barcode,
  name: m.name,
  category: m.category,
  unit: m.unit,
  buyingPrice: m.buyingPrice === null ? null : Number(m.buyingPrice),
  sellingPrice: Number(m.sellingPrice),
  minStock: Number(m.minStock),
  totalStock: (m.batches ?? []).reduce((s: number, b: any) => s + Number(b.quantity), 0),
  batches: (m.batches ?? []).map((b: any) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    expiryDate: b.expiryDate,
    quantity: Number(b.quantity),
    purchasePrice: b.purchasePrice === null ? null : Number(b.purchasePrice),
    createdAt: b.createdAt,
  })),
  createdAt: m.createdAt,
});

/** PATCH /api/medicines/[id]
 *  op = "restock" → create a new MedicineBatch (FEFO-aware)
 *  op = "edit"    → update medicine fields
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existing = await prisma.medicine.findUnique({
    where: { id, deletedAt: null },
    include: { batches: { orderBy: { expiryDate: 'asc' } } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Medicine not found.' }, { status: 404 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const op = body['op'] as string | undefined;

  // ── RESTOCK: create new batch ──────────────────────────────────────────────
  if (op === 'restock') {
    const quantity = toNum(body['quantity']);
    if (quantity === undefined || quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be a positive number.' }, { status: 400 });
    }

    const batchNumber =
      typeof body['batchNumber'] === 'string' ? body['batchNumber'].trim() || undefined : undefined;
    const purchasePrice = toNum(body['purchasePrice']);
    const expiryDateStr = typeof body['expiryDate'] === 'string' ? body['expiryDate'] : undefined;

    await prisma.medicineBatch.create({
      data: {
        medicineId: id,
        quantity,
        batchNumber,
        purchasePrice,
        expiryDate: expiryDateStr ? new Date(expiryDateStr) : undefined,
      },
    });

    // Return updated medicine with fresh batches
    const updated = await prisma.medicine.findUnique({
      where: { id },
      include: { batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } },
    });
    return NextResponse.json(toPayload(updated));
  }

  // ── EDIT: update medicine master fields ───────────────────────────────────
  const { barcode, name, category, unit, buyingPrice, sellingPrice, minStock } = body;

  const parsedSelling = toNum(sellingPrice);
  const parsedBuying = toNum(buyingPrice);
  const parsedMinStock = toNum(minStock);

  if (parsedSelling !== undefined && parsedSelling < 0) {
    return NextResponse.json({ error: 'Selling price cannot be negative.' }, { status: 400 });
  }

  const updated = await prisma.medicine.update({
    where: { id },
    data: {
      ...(typeof name === 'string' && name.trim() ? { name: name.trim() } : {}),
      ...(typeof barcode === 'string' ? { barcode: barcode.trim() || null } : {}),
      ...(category ? { category: category as any } : {}),
      ...(unit ? { unit: unit as any } : {}),
      ...(parsedSelling !== undefined ? { sellingPrice: parsedSelling } : {}),
      ...(parsedBuying !== undefined ? { buyingPrice: parsedBuying } : {}),
      ...(parsedMinStock !== undefined ? { minStock: parsedMinStock } : {}),
    },
    include: {
      batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
    },
  });

  return NextResponse.json(toPayload(updated));
}
