import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be defined in the environment.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

type MedRow = Awaited<ReturnType<typeof prisma.medicine.findMany>>[number] & {
  batches: { quantity: unknown }[];
};

const toPayload = (m: MedRow) => ({
  id:           m.id,
  barcode:      m.barcode,
  name:         m.name,
  category:     m.category,
  unit:         m.unit,
  buyingPrice:  m.buyingPrice  === null ? null : Number(m.buyingPrice),
  sellingPrice: Number(m.sellingPrice),
  minStock:     Number(m.minStock),
  totalStock:   m.batches.reduce((s, b) => s + Number(b.quantity), 0),
  batches:      (m as any).batches.map((b: any) => ({
    id:            b.id,
    batchNumber:   b.batchNumber,
    expiryDate:    b.expiryDate,
    quantity:      Number(b.quantity),
    purchasePrice: b.purchasePrice === null ? null : Number(b.purchasePrice),
    createdAt:     b.createdAt,
  })),
  createdAt:    m.createdAt,
  deletedAt:    m.deletedAt,
});

// ─── GET — list all medicines with aggregated stock ───────────────────────────

export async function GET() {
  const medicines = await prisma.medicine.findMany({
    where: { deletedAt: null },
    include: {
      batches: {
        orderBy: { expiryDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Sort by totalStock ascending (low stock first) after aggregation
  const payloads = medicines.map(toPayload);
  payloads.sort((a, b) => a.totalStock - b.totalStock);

  return NextResponse.json(payloads);
}

// ─── POST — create a new medicine (does NOT take stock; use restock to add batches) ──

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const { barcode, name, category, unit, buyingPrice, sellingPrice, minStock } = body;

  const normName = typeof name === 'string' ? name.trim() : '';
  const parsedSelling = toNum(sellingPrice);

  if (!normName || parsedSelling === undefined || parsedSelling < 0) {
    return NextResponse.json(
      { error: 'Name and valid selling price are required.' },
      { status: 400 },
    );
  }

  const parsedBuying  = toNum(buyingPrice);
  const parsedMinStock = toNum(minStock);

  const medicine = await prisma.medicine.create({
    data: {
      barcode:      typeof barcode === 'string' ? barcode.trim() || undefined : undefined,
      name:         normName,
      category:     (category as any) || 'Other',
      unit:         (unit as any) || 'Strip',
      buyingPrice:  parsedBuying,
      sellingPrice: parsedSelling,
      minStock:     parsedMinStock ?? 10,
    },
    include: { batches: true },
  });

  return NextResponse.json(toPayload(medicine as any), { status: 201 });
}
