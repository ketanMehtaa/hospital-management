import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type MedicineRecord = Awaited<ReturnType<typeof prisma.medicine.findMany>>[number];

const toNumberInput = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toMedicinePayload = (medicine: MedicineRecord) => ({
  ...medicine,
  buyingPrice: medicine.buyingPrice === null ? null : Number(medicine.buyingPrice),
  sellingPrice: Number(medicine.sellingPrice),
  stock: Number(medicine.stock),
  minStock: Number(medicine.minStock),
});

export async function GET() {
  const medicines = await prisma.medicine.findMany({
    where: { deletedAt: null },
    orderBy: [{ stock: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json(medicines.map(toMedicinePayload));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { barcode, name, category, unit, buyingPrice, sellingPrice, stock, minStock, expiryDate, batchNumber } =
    body as {
      barcode?: string;
      name?: string;
      category?: string;
      unit?: string;
      buyingPrice?: number | string;
      sellingPrice?: number | string;
      stock?: number | string;
      minStock?: number | string;
      expiryDate?: string;
      batchNumber?: string;
    };

  const normalizedName = name?.trim();
  const parsedBuyingPrice = toNumberInput(buyingPrice);
  const parsedSellingPrice = toNumberInput(sellingPrice);
  const parsedStock = toNumberInput(stock);
  const parsedMinStock = toNumberInput(minStock);

  if (!normalizedName || parsedSellingPrice === undefined || parsedSellingPrice < 0) {
    return NextResponse.json({ error: 'Name and valid selling price are required.' }, { status: 400 });
  }

  if (parsedBuyingPrice !== undefined && parsedBuyingPrice < 0) {
    return NextResponse.json({ error: 'Buying price cannot be negative.' }, { status: 400 });
  }

  if (parsedStock !== undefined && parsedStock < 0) {
    return NextResponse.json({ error: 'Stock cannot be negative.' }, { status: 400 });
  }

  if (parsedMinStock !== undefined && parsedMinStock < 0) {
    return NextResponse.json({ error: 'Minimum stock cannot be negative.' }, { status: 400 });
  }

  const medicine = await prisma.medicine.create({
    data: {
      barcode: barcode?.trim() || undefined,
      name: normalizedName,
      category:
        (category as
          | 'Antibiotic'
          | 'Antihistamine'
          | 'Decongestant'
          | 'Steroid'
          | 'Analgesic'
          | 'Antifungal'
          | 'EarDrop'
          | 'NasalSpray'
          | 'ThroatSpray'
          | 'Other') || 'Other',
      unit: (unit as 'Strip' | 'Bottle' | 'Tube' | 'Vial' | 'Sachet' | 'Tablet' | 'Capsule') || 'Strip',
      buyingPrice: parsedBuyingPrice ?? 0,
      sellingPrice: parsedSellingPrice,
      stock: parsedStock ?? 0,
      minStock: parsedMinStock ?? 10,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      batchNumber: batchNumber?.trim() || undefined,
    },
  });

  return NextResponse.json(toMedicinePayload(medicine), { status: 201 });
}
