'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

type MedicinePayload = {
  id: number;
  barcode: string | null;
  name: string;
  category: string;
  unit: string;
  buyingPrice: number | null;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate: string | null;
  batchNumber: string | null;
  createdAt: string;
};

type FormState = {
  barcode: string;
  name: string;
  category: string;
  unit: string;
  buyingPrice: string;
  sellingPrice: string;
  stock: string;
  minStock: string;
  expiryDate: string;
  batchNumber: string;
};

const initialFormState: FormState = {
  barcode: '',
  name: '',
  category: 'Other',
  unit: 'Strip',
  buyingPrice: '',
  sellingPrice: '',
  stock: '0',
  minStock: '10',
  expiryDate: '',
  batchNumber: '',
};

const categories = [
  'Antibiotic',
  'Antihistamine',
  'Decongestant',
  'Steroid',
  'Analgesic',
  'Antifungal',
  'EarDrop',
  'NasalSpray',
  'ThroatSpray',
  'Other',
];

const units = ['Strip', 'Bottle', 'Tube', 'Vial', 'Sachet', 'Tablet', 'Capsule'];

const inputClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

export default function MedicineManager() {
  const [medicines, setMedicines] = useState<MedicinePayload[]>([]);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMedicines = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/medicines', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load inventory.');
      }
      const data = (await response.json()) as MedicinePayload[];
      setMedicines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMedicines();
  }, []);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: form.barcode || undefined,
          name: form.name.trim(),
          category: form.category,
          unit: form.unit,
          buyingPrice: form.buyingPrice ? Number(form.buyingPrice) : undefined,
          sellingPrice: Number(form.sellingPrice),
          stock: form.stock ? Number(form.stock) : undefined,
          minStock: form.minStock ? Number(form.minStock) : undefined,
          expiryDate: form.expiryDate || undefined,
          batchNumber: form.batchNumber || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Could not save medicine.');
      }

      setMedicines((current) => [result, ...current]);
      setForm(initialFormState);
      setSuccess('Medicine added to inventory.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const totalItems = medicines.length;
  const lowStockCount = useMemo(() => medicines.filter((item) => item.stock <= item.minStock).length, [medicines]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Inventory control</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Medicine inventory</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Total items</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{totalItems}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="text-xs uppercase tracking-[0.3em] text-rose-600">Low stock</p>
              <p className="mt-2 text-2xl font-semibold text-rose-700">{lowStockCount}</p>
            </div>
          </div>
        </div>

        <form className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Medicine name*
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  required
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Barcode
                <input
                  className={inputClass}
                  value={form.barcode}
                  onChange={(event) => handleChange('barcode', event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Category
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(event) => handleChange('category', event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Unit
                <select
                  className={inputClass}
                  value={form.unit}
                  onChange={(event) => handleChange('unit', event.target.value)}
                >
                  {units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Selling price*
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">Rs. </span>
                  <input
                    className={`${inputClass} pl-9`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={(event) => handleChange('sellingPrice', event.target.value)}
                    required
                  />
                </div>
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Buying price
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">Rs. </span>
                  <input
                    className={`${inputClass} pl-9`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.buyingPrice}
                    onChange={(event) => handleChange('buyingPrice', event.target.value)}
                  />
                </div>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Stock quantity
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) => handleChange('stock', event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Minimum stock
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(event) => handleChange('minStock', event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Expiry date
                <input
                  className={inputClass}
                  type="date"
                  value={form.expiryDate}
                  onChange={(event) => handleChange('expiryDate', event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Batch number
                <input
                  className={inputClass}
                  value={form.batchNumber}
                  onChange={(event) => handleChange('batchNumber', event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
            <h3 className="text-lg font-semibold text-zinc-950">Quick inventory summary</h3>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Use this form to keep inventory data up to date and track stock levels for each medicine.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-white p-4 shadow-sm shadow-zinc-200/20">
                <p className="text-sm text-zinc-500">New item</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950">{form.name || 'Untitled'}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 shadow-sm shadow-zinc-200/20">
                <p className="text-sm text-zinc-500">Class</p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">{form.category}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 shadow-sm shadow-zinc-200/20">
                <p className="text-sm text-zinc-500">Unit</p>
                <p className="mt-2 text-lg font-semibold text-zinc-950">{form.unit}</p>
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Add medicine'}
            </button>
          </div>
        </form>

        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {success ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Current inventory</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Review your stocked medicines and spot low-stock items immediately.
            </p>
          </div>
          <div className="text-sm font-medium text-zinc-700">Sorted by lowest stock first</div>
        </div>

        {loading && medicines.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Loading inventory...
          </div>
        ) : medicines.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            No medicines added yet. Create inventory items with the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Min stock</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {medicines.map((medicine) => {
                  const lowStock = medicine.stock <= medicine.minStock;
                  return (
                    <tr key={medicine.id} className={lowStock ? 'bg-rose-50/80' : 'hover:bg-zinc-50'}>
                      <td className="px-4 py-3 font-semibold text-zinc-950">{medicine.name}</td>
                      <td className="px-4 py-3">{medicine.category.replace(/([A-Z])/g, ' $1').trim()}</td>
                      <td className="px-4 py-3">{medicine.stock}</td>
                      <td className="px-4 py-3">{medicine.minStock}</td>
                      <td className="px-4 py-3">{medicine.unit}</td>
                      <td className="px-4 py-3">Rs. {medicine.sellingPrice.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {medicine.expiryDate ? new Date(medicine.expiryDate).toLocaleDateString() : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
