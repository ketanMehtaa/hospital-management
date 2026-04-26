import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be defined.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // ── Date range ─────────────────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const fromStr = searchParams.get('from') ?? todayStr;
  const toStr = searchParams.get('to') ?? todayStr;

  const from = new Date(`${fromStr}T00:00:00+05:30`);
  const to = new Date(`${toStr}T23:59:59.999+05:30`);

  // ── Fetch bills in range ───────────────────────────────────────────────────
  const bills = await prisma.bill.findMany({
    where: {
      deletedAt: null,
      billAt: { gte: from, lte: to },
    },
    include: {
      items: {
        select: {
          category: true,
          description: true,
          quantity: true,
          amount: true,
          medicineId: true,
          medicine: { select: { name: true } },
        },
      },
    },
    orderBy: { billAt: 'asc' },
  });

  // ── Aggregate totals ───────────────────────────────────────────────────────
  let totalRevenue = 0;
  let totalCash = 0;
  let totalOnline = 0;
  let totalDiscount = 0;

  // category → revenue
  const categoryRevenue: Record<string, number> = {};
  // medicine name → { qty, revenue }
  const medicineMap: Record<string, { qty: number; revenue: number }> = {};
  // date string (YYYY-MM-DD) → { revenue, cash, online }
  const dailyMap: Record<string, { revenue: number; cash: number; online: number; bills: number }> =
    {};

  for (const bill of bills) {
    const revenue = Number(bill.totalAmount);
    const cash = Number(bill.paidCash);
    const online = Number(bill.paidOnline);
    const discount = Number(bill.discount);

    totalRevenue += revenue;
    totalCash += cash;
    totalOnline += online;
    totalDiscount += discount;

    // Daily buckets
    const dateKey = new Date(bill.billAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, cash: 0, online: 0, bills: 0 };
    dailyMap[dateKey].revenue += revenue;
    dailyMap[dateKey].cash += cash;
    dailyMap[dateKey].online += online;
    dailyMap[dateKey].bills += 1;

    // Category breakdown
    for (const item of bill.items) {
      const cat = item.category as string;
      categoryRevenue[cat] = (categoryRevenue[cat] ?? 0) + Number(item.amount);

      if (item.medicineId && item.medicine) {
        const name = item.medicine.name;
        if (!medicineMap[name]) medicineMap[name] = { qty: 0, revenue: 0 };
        medicineMap[name].qty += Number(item.quantity);
        medicineMap[name].revenue += Number(item.amount);
      }
    }
  }

  // ── Patients registered in range ───────────────────────────────────────────
  const patientCount = await prisma.patient.count({
    where: { deletedAt: null },
  });

  // ── Top medicines ──────────────────────────────────────────────────────────
  const topMedicines = Object.entries(medicineMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([name, data]) => ({ name, ...data }));

  // ── Daily series (fill gaps) ───────────────────────────────────────────────
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  // ── Category series ────────────────────────────────────────────────────────
  const categories = Object.entries(categoryRevenue)
    .sort((a, b) => b[1] - a[1])
    .map(([category, revenue]) => ({ category, revenue }));

  return NextResponse.json({
    from: fromStr,
    to: toStr,
    totalRevenue,
    totalCash,
    totalOnline,
    totalDiscount,
    billCount: bills.length,
    patientCount,
    categories,
    topMedicines,
    daily,
  });
}
