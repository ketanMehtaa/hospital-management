/**
 * prisma/seed.ts
 * Seeds the database with realistic test data:
 *   - 60 medicines across all categories
 *   - 1 000 patients with Indian names
 *   - ~1 000 bills (1-2 per patient) spread over the last 90 days
 *
 * Run: pnpm db:seed
 */

import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set in .env');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// ─── Utility ─────────────────────────────────────────────────────────────────

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: readonly T[]): T => arr[rand(0, arr.length - 1)];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const randomDate = (maxDaysAgo = 90) => daysAgo(rand(0, maxDaysAgo));

/** 10-digit phone that is guaranteed unique via a counter suffix */
const makePhone = (i: number) => `9${String(i).padStart(9, '0')}`;

// ─── Static data ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav', 'Aditya', 'Akash', 'Amit', 'Ananya', 'Anita', 'Anjali', 'Arjun',
  'Aryan', 'Deepak', 'Deepika', 'Divya', 'Gaurav', 'Geeta', 'Harish', 'Heena',
  'Ishaan', 'Jaya', 'Karan', 'Kavita', 'Kishore', 'Komal', 'Kunal', 'Lakshmi',
  'Manish', 'Manisha', 'Meera', 'Mohit', 'Monika', 'Mukesh', 'Nandini', 'Neha',
  'Nikhil', 'Nisha', 'Payal', 'Pooja', 'Pradeep', 'Priya', 'Rahul', 'Rajesh',
  'Ramesh', 'Rashmi', 'Ravi', 'Rekha', 'Rohit', 'Sachin', 'Sanjay', 'Sangeeta',
  'Seema', 'Shashi', 'Shreya', 'Shweta', 'Siddharth', 'Simran', 'Sneha', 'Soni',
  'Suresh', 'Swati', 'Tanvi', 'Usha', 'Varun', 'Vijay', 'Vikram', 'Vikas',
  'Vineeta', 'Vishal', 'Yasmin', 'Yash',
];

const LAST_NAMES = [
  'Agarwal', 'Bhatt', 'Chauhan', 'Chowdhury', 'Das', 'Desai', 'Deshpande',
  'Gandhi', 'Ghosh', 'Gupta', 'Jain', 'Joshi', 'Kapoor', 'Khan', 'Kumar',
  'Malhotra', 'Mehta', 'Mishra', 'Nair', 'Pandey', 'Patel', 'Patil', 'Pillai',
  'Rao', 'Reddy', 'Saxena', 'Shah', 'Sharma', 'Shukla', 'Singh', 'Srivastava',
  'Tiwari', 'Trivedi', 'Varma', 'Yadav',
];

const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad',
  'Kolkata', 'Jaipur', 'Lucknow', 'Bhopal', 'Indore', 'Nagpur', 'Surat', 'Vadodara',
];

const DIAGNOSES = [
  'Acute sinusitis', 'Allergic rhinitis', 'Bronchitis', 'Chronic tonsillitis',
  'Common cold', 'Deviated nasal septum', 'Ear infection (otitis media)',
  'Epistaxis', 'Foreign body - ear', 'Gastroesophageal reflux disease',
  'Hearing loss - sensorineural', 'Laryngitis', 'Meniere\'s disease',
  'Nasal polyps', 'Otosclerosis', 'Pharyngitis', 'Sleep apnea',
  'Tinnitus', 'Tympanic membrane perforation', 'Vertigo',
];

const GENDERS = ['Male', 'Female', 'Other'] as const;

// ─── Medicine catalogue ───────────────────────────────────────────────────────

type MedSeed = {
  name: string;
  category: string;
  unit: string;
  buying: number;
  selling: number;
  stockA: number;   // Batch A qty (older, expires sooner)
  stockB: number;   // Batch B qty (newer, longer shelf life)
  minStock: number;
};

const MEDICINES: MedSeed[] = [
  // Antibiotic
  { name: 'Amoxicillin 500mg',         category: 'Antibiotic',     unit: 'Strip',   buying: 40,  selling: 60,  stockA: 80,  stockB: 120, minStock: 20 },
  { name: 'Azithromycin 250mg',         category: 'Antibiotic',     unit: 'Strip',   buying: 55,  selling: 80,  stockA: 60,  stockB: 90,  minStock: 20 },
  { name: 'Augmentin 625mg',            category: 'Antibiotic',     unit: 'Strip',   buying: 90,  selling: 130, stockA: 50,  stockB: 70,  minStock: 15 },
  { name: 'Ciprofloxacin 500mg',        category: 'Antibiotic',     unit: 'Strip',   buying: 30,  selling: 50,  stockA: 70,  stockB: 110, minStock: 20 },
  { name: 'Doxycycline 100mg',          category: 'Antibiotic',     unit: 'Capsule', buying: 20,  selling: 35,  stockA: 80,  stockB: 120, minStock: 20 },
  { name: 'Metronidazole 400mg',        category: 'Antibiotic',     unit: 'Strip',   buying: 15,  selling: 25,  stockA: 100, stockB: 150, minStock: 25 },
  // Antihistamine
  { name: 'Cetirizine 10mg',            category: 'Antihistamine',  unit: 'Strip',   buying: 10,  selling: 18,  stockA: 200, stockB: 300, minStock: 50 },
  { name: 'Fexofenadine 120mg',         category: 'Antihistamine',  unit: 'Strip',   buying: 25,  selling: 40,  stockA: 120, stockB: 180, minStock: 30 },
  { name: 'Loratadine 10mg',            category: 'Antihistamine',  unit: 'Strip',   buying: 12,  selling: 20,  stockA: 160, stockB: 240, minStock: 40 },
  { name: 'Montelukast 10mg',           category: 'Antihistamine',  unit: 'Strip',   buying: 35,  selling: 55,  stockA: 100, stockB: 150, minStock: 25 },
  // Decongestant
  { name: 'Pseudoephedrine 60mg',       category: 'Decongestant',   unit: 'Strip',   buying: 18,  selling: 30,  stockA: 120, stockB: 180, minStock: 30 },
  { name: 'Xylometazoline Drops',       category: 'Decongestant',   unit: 'Bottle',  buying: 35,  selling: 55,  stockA: 80,  stockB: 120, minStock: 20 },
  { name: 'Oxymetazoline Nasal',        category: 'Decongestant',   unit: 'Bottle',  buying: 40,  selling: 65,  stockA: 72,  stockB: 108, minStock: 20 },
  // Steroid
  { name: 'Betamethasone 0.5mg',        category: 'Steroid',        unit: 'Strip',   buying: 20,  selling: 35,  stockA: 140, stockB: 210, minStock: 35 },
  { name: 'Dexamethasone 4mg',          category: 'Steroid',        unit: 'Strip',   buying: 25,  selling: 45,  stockA: 120, stockB: 180, minStock: 30 },
  { name: 'Prednisolone 5mg',           category: 'Steroid',        unit: 'Strip',   buying: 15,  selling: 28,  stockA: 160, stockB: 240, minStock: 40 },
  { name: 'Fluticasone Nasal Spray',    category: 'Steroid',        unit: 'Bottle',  buying: 120, selling: 180, stockA: 60,  stockB: 90,  minStock: 15 },
  // Analgesic
  { name: 'Paracetamol 500mg',          category: 'Analgesic',      unit: 'Strip',   buying: 8,   selling: 15,  stockA: 320, stockB: 480, minStock: 80 },
  { name: 'Ibuprofen 400mg',            category: 'Analgesic',      unit: 'Strip',   buying: 10,  selling: 18,  stockA: 240, stockB: 360, minStock: 60 },
  { name: 'Diclofenac 50mg',            category: 'Analgesic',      unit: 'Strip',   buying: 12,  selling: 22,  stockA: 200, stockB: 300, minStock: 50 },
  { name: 'Tramadol 50mg',              category: 'Analgesic',      unit: 'Capsule', buying: 18,  selling: 30,  stockA: 80,  stockB: 120, minStock: 20 },
  // Antifungal
  { name: 'Fluconazole 150mg',          category: 'Antifungal',     unit: 'Capsule', buying: 30,  selling: 50,  stockA: 80,  stockB: 120, minStock: 20 },
  { name: 'Clotrimazole Cream',         category: 'Antifungal',     unit: 'Tube',    buying: 25,  selling: 40,  stockA: 60,  stockB: 90,  minStock: 15 },
  { name: 'Ketoconazole Shampoo',       category: 'Antifungal',     unit: 'Bottle',  buying: 80,  selling: 120, stockA: 40,  stockB: 60,  minStock: 10 },
  // Ear drops
  { name: 'Ciprofloxacin Ear Drops',    category: 'EarDrop',        unit: 'Bottle',  buying: 45,  selling: 70,  stockA: 80,  stockB: 120, minStock: 20 },
  { name: 'Clotrimazole Ear Drops',     category: 'EarDrop',        unit: 'Bottle',  buying: 40,  selling: 65,  stockA: 72,  stockB: 108, minStock: 18 },
  { name: 'Waxsol Ear Drops',           category: 'EarDrop',        unit: 'Bottle',  buying: 55,  selling: 85,  stockA: 48,  stockB: 72,  minStock: 12 },
  { name: 'Soliwax Ear Drops',          category: 'EarDrop',        unit: 'Bottle',  buying: 48,  selling: 75,  stockA: 52,  stockB: 78,  minStock: 13 },
  // Nasal spray
  { name: 'Mometasone Nasal Spray',     category: 'NasalSpray',     unit: 'Bottle',  buying: 130, selling: 190, stockA: 40,  stockB: 60,  minStock: 10 },
  { name: 'Budesonide Nasal Spray',     category: 'NasalSpray',     unit: 'Bottle',  buying: 110, selling: 165, stockA: 48,  stockB: 72,  minStock: 12 },
  { name: 'Azelastine Nasal Spray',     category: 'NasalSpray',     unit: 'Bottle',  buying: 140, selling: 210, stockA: 36,  stockB: 54,  minStock: 10 },
  { name: 'Saline Nasal Spray',         category: 'NasalSpray',     unit: 'Bottle',  buying: 30,  selling: 50,  stockA: 120, stockB: 180, minStock: 30 },
  // Throat spray
  { name: 'Chlorhexidine Throat Spray', category: 'ThroatSpray',    unit: 'Bottle',  buying: 50,  selling: 80,  stockA: 48,  stockB: 72,  minStock: 12 },
  { name: 'Benzocaine Throat Spray',    category: 'ThroatSpray',    unit: 'Bottle',  buying: 60,  selling: 95,  stockA: 40,  stockB: 60,  minStock: 10 },
  // Other
  { name: 'Vitamin C 500mg',            category: 'Other',          unit: 'Strip',   buying: 15,  selling: 25,  stockA: 200, stockB: 300, minStock: 50 },
  { name: 'Zinc Supplement',            category: 'Other',          unit: 'Strip',   buying: 18,  selling: 30,  stockA: 160, stockB: 240, minStock: 40 },
  { name: 'ORS Sachet',                 category: 'Other',          unit: 'Sachet',  buying: 5,   selling: 10,  stockA: 240, stockB: 360, minStock: 60 },
  { name: 'Antacid Tablet',             category: 'Other',          unit: 'Strip',   buying: 10,  selling: 18,  stockA: 200, stockB: 300, minStock: 50 },
  { name: 'Probiotic Capsule',          category: 'Other',          unit: 'Capsule', buying: 40,  selling: 65,  stockA: 80,  stockB: 120, minStock: 20 },
];

// ─── Bill category service prices ─────────────────────────────────────────────

const SERVICE_ITEMS: { category: string; description: string; price: number }[] = [
  { category: 'OpdConsultation', description: 'OPD Consultation',              price: 500  },
  { category: 'OpdConsultation', description: 'Follow-up Consultation',        price: 300  },
  { category: 'Endoscopy',       description: 'Flexible Nasopharyngoscopy',    price: 1200 },
  { category: 'Endoscopy',       description: 'Rigid Laryngoscopy',            price: 1500 },
  { category: 'Procedure',       description: 'Ear Wax Removal',               price: 400  },
  { category: 'Procedure',       description: 'Nasal Cauterisation',           price: 800  },
  { category: 'Procedure',       description: 'Foreign Body Removal - Ear',    price: 600  },
  { category: 'Procedure',       description: 'Tympanometry',                  price: 700  },
  { category: 'HearingTest',     description: 'Pure Tone Audiometry',          price: 500  },
  { category: 'HearingTest',     description: 'BERA / ABR Test',               price: 2000 },
  { category: 'HearingTest',     description: 'OAE Screening',                 price: 800  },
  { category: 'Radiology',       description: 'X-ray PNS',                     price: 400  },
  { category: 'Radiology',       description: 'CT Scan Sinuses',               price: 3500 },
  { category: 'Radiology',       description: 'MRI Temporal Bone',             price: 5500 },
  { category: 'Pathology',       description: 'CBC (Complete Blood Count)',     price: 350  },
  { category: 'Pathology',       description: 'Culture & Sensitivity - Ear',   price: 600  },
  { category: 'Pathology',       description: 'Throat Swab Culture',           price: 500  },
];

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Starting seed...\n');

  // ── 1. Clear existing data ────────────────────────────────────────────────
  console.log('🗑   Clearing existing records...');
  await prisma.billItem.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.medicineBatch.deleteMany();
  await prisma.medicine.deleteMany();
  console.log('    Done.\n');

  // ── 2. Seed medicines + batches ───────────────────────────────────────────
  console.log('💊  Seeding medicines with batches...');
  const medicines = await Promise.all(
    MEDICINES.map(async (m) => {
      const med = await prisma.medicine.create({
        data: {
          name:         m.name,
          category:     m.category as any,
          unit:         m.unit as any,
          buyingPrice:  m.buying,
          sellingPrice: m.selling,
          minStock:     m.minStock,
        },
      });
      // Batch A: expires in 3-6 months (FEFO will pick this first)
      const expA = new Date(); expA.setMonth(expA.getMonth() + rand(3, 6));
      // Batch B: expires in 18-36 months
      const expB = new Date(); expB.setMonth(expB.getMonth() + rand(18, 36));
      await prisma.medicineBatch.createMany({
        data: [
          { medicineId: med.id, batchNumber: `BATCH-A-${rand(1000,9999)}`, expiryDate: expA, quantity: m.stockA, purchasePrice: m.buying },
          { medicineId: med.id, batchNumber: `BATCH-B-${rand(1000,9999)}`, expiryDate: expB, quantity: m.stockB, purchasePrice: m.buying * 1.05 },
        ],
      });
      // Return medicine with totalStock for tracking
      return { ...med, sellingPrice: m.selling, totalStock: m.stockA + m.stockB };
    }),
  );
  console.log(`    Seeded ${medicines.length} medicines (${medicines.length * 2} batches).\n`);


  // ── 3. Seed patients ──────────────────────────────────────────────────────
  console.log('🧑‍⚕️  Seeding 1 000 patients...');
  const TOTAL_PATIENTS = 1000;
  const patientData = Array.from({ length: TOTAL_PATIENTS }, (_, i) => {
    const gender = pick(GENDERS);
    return {
      name:      `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      age:       rand(5, 80),
      gender:    gender as any,
      phone:     makePhone(i + 1),
      address:   `${rand(1, 999)}, ${pick(CITIES)}`,
      diagnosis: pick(DIAGNOSES),
      visitAt:   randomDate(90),
    };
  });

  // Batch insert patients 100 at a time
  const patients = [];
  for (let i = 0; i < patientData.length; i += 100) {
    const batch = patientData.slice(i, i + 100);
    const created = await Promise.all(
      batch.map((p) => prisma.patient.create({ data: p })),
    );
    patients.push(...created);
    process.stdout.write(`\r    Progress: ${patients.length}/${TOTAL_PATIENTS}`);
  }
  console.log(`\n    Done.\n`);

  // ── 4. Seed bills ─────────────────────────────────────────────────────────
  console.log('🧾  Seeding bills (1-2 per patient)...');

  // Build batch stock tracker: batchId -> remaining quantity
  // Fetch all batches for all seeded medicines
  const allBatches = await prisma.medicineBatch.findMany({
    where: { medicineId: { in: medicines.map((m) => m.id) } },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
  });

  // Group by medicineId in FEFO order
  const batchesByMed = new Map<string, { id: string; quantity: number }[]>();
  for (const b of allBatches) {
    if (!batchesByMed.has(b.medicineId)) batchesByMed.set(b.medicineId, []);
    batchesByMed.get(b.medicineId)!.push({ id: b.id, quantity: Number(b.quantity) });
  }

  const batchUpdates = new Map<string, number>(); // batchId -> remaining after all bills
  for (const [, batches] of batchesByMed) {
    for (const b of batches) batchUpdates.set(b.id, b.quantity);
  }

  let billIndex = 0;
  let totalBills = 0;

  for (const patient of patients) {
    const numBills = rand(1, 2);

    for (let b = 0; b < numBills; b++) {
      billIndex++;
      const billAt = randomDate(90);
      const billNumber = `BILL-${String(billIndex).padStart(5, '0')}`;

      const items: {
        category: string;
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        medicineId?: string;
        batchId?: string;
      }[] = [];

      // Always include consultation
      const consultFee = rand(0, 1) === 0 ? 500 : 300;
      items.push({
        category: 'OpdConsultation',
        description: consultFee === 500 ? 'OPD Consultation' : 'Follow-up Consultation',
        quantity: 1, unitPrice: consultFee, amount: consultFee,
      });

      // 0-2 random services
      const numServices = rand(0, 2);
      for (let s = 0; s < numServices; s++) {
        const svc = pick(SERVICE_ITEMS.filter((x) => x.category !== 'OpdConsultation'));
        items.push({ category: svc.category, description: svc.description, quantity: 1, unitPrice: svc.price, amount: svc.price });
      }

      // 1-3 medicines (FEFO from in-memory tracker)
      const numMeds = rand(1, 3);
      const shuffledMeds = [...medicines].sort(() => Math.random() - 0.5);
      for (const med of shuffledMeds) {
        if (items.filter((i) => i.category === 'Medicine').length >= numMeds) break;
        const batches = batchesByMed.get(med.id) ?? [];
        // FEFO: pick first batch with remaining stock
        let remaining = rand(1, 3);
        let primaryBatchId: string | undefined;
        for (const bat of batches) {
          const avail = batchUpdates.get(bat.id) ?? 0;
          if (avail < 1) continue;
          const use = Math.min(remaining, avail);
          if (!primaryBatchId) primaryBatchId = bat.id;
          batchUpdates.set(bat.id, avail - use);
          remaining -= use;
          if (remaining <= 0) break;
        }
        if (primaryBatchId === undefined) continue; // no stock
        const qty = rand(1, 3) - remaining; // actual qty sold
        if (qty < 1) continue;
        const price = med.sellingPrice;
        items.push({
          category: 'Medicine', description: med.name,
          quantity: qty, unitPrice: price, amount: qty * price,
          medicineId: med.id, batchId: primaryBatchId,
        });
      }

      const subtotal  = items.reduce((s, i) => s + i.amount, 0);
      const discount  = rand(0, 1) === 0 ? 0 : rand(0, Math.floor(subtotal * 0.1));
      const total     = Math.max(0, subtotal - discount);
      const cashRatio = pick([0, 0.25, 0.5, 0.75, 1] as const);
      const paidCash  = Math.round(total * cashRatio * 100) / 100;
      const paidOnline = Math.round((total - paidCash) * 100) / 100;

      await prisma.bill.create({
        data: {
          billNumber,
          patientId:   patient.id,
          patientName: patient.name,
          phone:       patient.phone,
          billAt, discount, totalAmount: total, paidCash, paidOnline,
          items: {
            create: items.map((item) => ({
              category:    item.category as any,
              description: item.description,
              quantity:    item.quantity,
              unitPrice:   item.unitPrice,
              amount:      item.amount,
              medicineId:  item.medicineId,
              batchId:     item.batchId,
            })),
          },
        },
      });

      totalBills++;
    }
    if (patients.indexOf(patient) % 50 === 49) process.stdout.write(`\r    Bills created: ${totalBills}`);
  }

  // Flush batch quantity updates to DB
  console.log('\n    Flushing batch stock updates...');
  await Promise.all(
    [...batchUpdates.entries()].map(([id, qty]) =>
      prisma.medicineBatch.update({ where: { id }, data: { quantity: qty } }),
    ),
  );

  console.log(`\n    Done. Created ${totalBills} bills.\n`);
  console.log('✅  Seed complete!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
