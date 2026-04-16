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

export async function GET() {
  const medicines = await prisma.medicine.findMany({
    orderBy: [{ stock: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json(medicines);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { barcode, name, category, unit, buyingPrice, sellingPrice, stock, minStock, expiryDate, batchNumber } =
    body as {
      barcode?: string;
      name?: string;
      category?: string;
      unit?: string;
      buyingPrice?: number;
      sellingPrice?: number;
      stock?: number;
      minStock?: number;
      expiryDate?: string;
      batchNumber?: string;
    };

  if (!name || !sellingPrice || sellingPrice < 0) {
    return NextResponse.json({ error: 'Name and valid selling price are required.' }, { status: 400 });
  }

  const medicine = await prisma.medicine.create({
    data: {
      barcode: barcode?.trim() || undefined,
      name: name.trim(),
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
      buyingPrice: buyingPrice ?? 0,
      sellingPrice,
      stock: stock ?? 0,
      minStock: minStock ?? 10,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      batchNumber: batchNumber?.trim() || undefined,
    },
  });

  return NextResponse.json(medicine, { status: 201 });
}
