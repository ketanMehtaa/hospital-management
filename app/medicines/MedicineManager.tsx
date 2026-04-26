'use client';

import { type FormEvent,useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchPayload = {
  id: string;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  purchasePrice: number | null;
  createdAt: string;
};

type MedicinePayload = {
  id: string;
  barcode: string | null;
  name: string;
  category: string;
  unit: string;
  buyingPrice: number | null;
  sellingPrice: number;
  minStock: number;
  totalStock: number;
  batches: BatchPayload[];
  createdAt: string;
};

type FormState = {
  barcode: string;
  name: string;
  category: string;
  unit: string;
  buyingPrice: string;
  sellingPrice: string;
  minStock: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
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
const UNITS = ['Strip', 'Bottle', 'Tube', 'Vial', 'Sachet', 'Tablet', 'Capsule'];

const emptyForm = (): FormState => ({
  barcode: '',
  name: '',
  category: 'Other',
  unit: 'Strip',
  buyingPrice: '',
  sellingPrice: '',
  minStock: '10',
});

const medToForm = (m: MedicinePayload): FormState => ({
  barcode: m.barcode ?? '',
  name: m.name,
  category: m.category,
  unit: m.unit,
  buyingPrice: m.buyingPrice !== null ? String(m.buyingPrice) : '',
  sellingPrice: String(m.sellingPrice),
  minStock: String(m.minStock),
});

const inputCls =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        timeZone: 'Asia/Kolkata',
      })
    : '—';

const isExpiringSoon = (expiryDate: string | null) => {
  if (!expiryDate) return false;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return diff > 0 && diff < 90 * 24 * 60 * 60 * 1000; // < 90 days
};

const isExpired = (expiryDate: string | null) => {
  if (!expiryDate) return false;
  return new Date(expiryDate).getTime() < Date.now();
};

// ─── Batch inline edit row ────────────────────────────────────────────────────

function BatchEditRow({
  batch,
  unit,
  onSave,
  onCancel,
}: {
  batch: BatchPayload;
  unit: string;
  onSave: (updated: BatchPayload) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(String(batch.quantity));
  const [bnum, setBnum] = useState(batch.batchNumber ?? '');
  const [exp, setExp] = useState(batch.expiryDate ? batch.expiryDate.slice(0, 10) : '');
  const [cost, setCost] = useState(batch.purchasePrice !== null ? String(batch.purchasePrice) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const smCls =
    'rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-950 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200';

  const handleSave = async () => {
    const n = Number(qty);
    if (isNaN(n) || n < 0) {
      setError('Invalid quantity');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/medicines/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: n,
          batchNumber: bnum || null,
          expiryDate: exp || null,
          purchasePrice: cost ? Number(cost) : null,
        }),
      });
      const result = (await res.json()) as BatchPayload | { error: string };
      if (!res.ok) throw new Error('error' in result ? result.error : 'Failed.');
      onSave(result as BatchPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <tr className="bg-amber-50/60">
      <td className="py-2 pr-3">
        <input
          className={smCls}
          value={bnum}
          onChange={(e) => setBnum(e.target.value)}
          placeholder="Batch #"
        />
      </td>
      <td className="py-2 pr-3">
        <input className={smCls} type="date" value={exp} onChange={(e) => setExp(e.target.value)} />
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1">
          <input
            className={`${smCls} w-20`}
            type="number"
            min="0"
            step="0.01"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setError('');
            }}
          />
          <span className="text-xs text-zinc-400">{unit}s</span>
        </div>
      </td>
      <td className="py-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
            Rs.
          </span>
          <input
            className={`${smCls} pl-7 w-24`}
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </td>
      <td className="py-2 pl-3">
        {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
          >
            {loading ? '…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Restock modal ────────────────────────────────────────────────────────────

function RestockModal({
  medicine,
  onClose,
  onDone,
}: {
  medicine: MedicinePayload;
  onClose: () => void;
  onDone: (updated: MedicinePayload) => void;
}) {
  const [qty, setQty] = useState('');
  const [batchNumber, setBatch] = useState('');
  const [expiryDate, setExpiry] = useState('');
  const [purchasePrice, setCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    qtyRef.current?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n <= 0) {
      setError('Enter a positive quantity.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/medicines/${medicine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'restock',
          quantity: n,
          batchNumber: batchNumber || undefined,
          expiryDate: expiryDate || undefined,
          purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        }),
      });
      const result = (await res.json()) as MedicinePayload | { error: string };
      if (!res.ok) throw new Error('error' in result ? result.error : 'Failed.');
      onDone(result as MedicinePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Restock
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-950">{medicine.name}</h3>
            <p className="mt-0.5 text-sm text-zinc-500">
              Current stock:&nbsp;
              <span className="font-semibold text-zinc-950">
                {medicine.totalStock} {medicine.unit}s
              </span>
              &nbsp;across {medicine.batches.length} batch
              {medicine.batches.length !== 1 ? 'es' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-xl p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="block font-medium">Quantity*</span>
              <input
                ref={qtyRef}
                className={inputCls}
                type="number"
                min="0.01"
                step="0.01"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setError('');
                }}
                placeholder="e.g. 100"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="block font-medium">Batch number</span>
              <input
                className={inputCls}
                value={batchNumber}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. BATCH-A1"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="block font-medium">Expiry date</span>
              <input
                className={inputCls}
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiry(e.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="block font-medium">Purchase price (Rs.)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                  Rs.{' '}
                </span>
                <input
                  className={`${inputCls} pl-10`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </label>
          </div>

          {error && (
            <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {loading ? 'Adding…' : '+ Add batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MedicineManager() {
  const [medicines, setMedicines] = useState<MedicinePayload[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [restockTarget, setRestockTarget] = useState<MedicinePayload | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchMedicines = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/medicines', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load inventory.');
      setMedicines((await res.json()) as MedicinePayload[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMedicines();
  }, []);

  const handleChange = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const startEdit = (med: MedicinePayload) => {
    setEditingId(med.id);
    setForm(medToForm(med));
    setError(null);
    setSuccess(null);
    document.getElementById('med-form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const isEdit = editingId !== null;
    const url = isEdit ? `/api/medicines/${editingId}` : '/api/medicines';
    const method = isEdit ? 'PATCH' : 'POST';

    const payload = {
      barcode: form.barcode || undefined,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      buyingPrice: form.buyingPrice ? Number(form.buyingPrice) : undefined,
      sellingPrice: Number(form.sellingPrice),
      minStock: form.minStock ? Number(form.minStock) : undefined,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as MedicinePayload | { error: string };
      if (!res.ok) throw new Error('error' in result ? result.error : `HTTP ${res.status}`);
      const saved = result as MedicinePayload;
      if (isEdit) {
        setMedicines((c) => c.map((m) => (m.id === saved.id ? saved : m)));
        setSuccess('Medicine updated.');
        setEditingId(null);
      } else {
        setMedicines((c) => [...c, saved].sort((a, b) => a.totalStock - b.totalStock));
        setSuccess('Medicine registered. Use "+ Add batch" to add stock.');
      }
      setForm(emptyForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestockDone = (updated: MedicinePayload) => {
    setMedicines((c) =>
      c.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.totalStock - b.totalStock),
    );
    setRestockTarget(null);
    setSuccess(`Batch added to ${updated.name}. New total: ${updated.totalStock} ${updated.unit}s`);
  };

  const handleBatchSaved = useCallback((medicineId: string, updatedBatch: BatchPayload) => {
    setMedicines((curr) =>
      curr
        .map((m) => {
          if (m.id !== medicineId) return m;
          const newBatches = m.batches.map((b) => (b.id === updatedBatch.id ? updatedBatch : b));
          const newTotal = newBatches.reduce((s, b) => s + b.quantity, 0);
          return { ...m, batches: newBatches, totalStock: newTotal };
        })
        .sort((a, b) => a.totalStock - b.totalStock),
    );
    setEditingBatchId(null);
    setSuccess('Batch updated.');
  }, []);

  const displayed = useMemo(() => {
    const q = search.toLowerCase();
    return medicines.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    );
  }, [medicines, search]);

  const lowStockCount = useMemo(
    () => medicines.filter((m) => m.totalStock <= m.minStock).length,
    [medicines],
  );

  const isEditing = editingId !== null;

  return (
    <>
      {restockTarget && (
        <RestockModal
          medicine={restockTarget}
          onClose={() => setRestockTarget(null)}
          onDone={handleRestockDone}
        />
      )}

      <div className="space-y-8">
        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <section
          id="med-form-section"
          className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20"
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
                {isEditing ? 'Editing' : 'Inventory control'}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                {isEditing ? 'Edit medicine' : 'Add medicine'}
              </h2>
              {!isEditing && (
                <p className="mt-1 text-sm text-zinc-500">
                  Register a new medicine, then add stock batches from the inventory table.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isEditing && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel edit
                </button>
              )}
              {lowStockCount > 0 && (
                <div className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
                  ⚠ {lowStockCount} low stock
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4 shrink-0"
              >
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
              </svg>
              Editing&nbsp;
              <span className="font-semibold">
                {medicines.find((m) => m.id === editingId)?.name}
              </span>
              &mdash; changes will be saved on submit.
            </div>
          )}

          <form id="med-form" onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Medicine name*</span>
                  <input
                    className={inputCls}
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Barcode</span>
                  <input
                    className={inputCls}
                    value={form.barcode}
                    onChange={(e) => handleChange('barcode', e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Category</span>
                  <select
                    className={inputCls}
                    value={form.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/([A-Z])/g, ' $1').trim()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Unit</span>
                  <select
                    className={inputCls}
                    value={form.unit}
                    onChange={(e) => handleChange('unit', e.target.value)}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Selling price*</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                      Rs.{' '}
                    </span>
                    <input
                      className={`${inputCls} pl-10`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.sellingPrice}
                      onChange={(e) => handleChange('sellingPrice', e.target.value)}
                      required
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Default buying price</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                      Rs.{' '}
                    </span>
                    <input
                      className={`${inputCls} pl-10`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.buyingPrice}
                      onChange={(e) => handleChange('buyingPrice', e.target.value)}
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="block font-medium">Min stock alert</span>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minStock}
                    onChange={(e) => handleChange('minStock', e.target.value)}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`mt-2 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold text-white transition disabled:opacity-60 ${
                  isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-zinc-950 hover:bg-zinc-800'
                }`}
              >
                {loading
                  ? isEditing
                    ? 'Updating…'
                    : 'Saving…'
                  : isEditing
                    ? 'Update medicine'
                    : 'Register medicine'}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}
          {success && (
            <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          )}
        </section>

        {/* ── Inventory ─────────────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-zinc-950">
              Inventory
              <span className="ml-2 text-sm font-normal text-zinc-400">
                ({medicines.length} medicines)
              </span>
            </h3>
            <div className="relative w-full sm:w-64">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Search name or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading && medicines.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              {search ? 'No medicines match your search.' : 'No medicines added yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((med) => {
                const now = Date.now();
                const activeStock = med.batches.reduce((acc, b) => {
                  const expired = b.expiryDate ? new Date(b.expiryDate).getTime() < now : false;
                  return acc + (expired ? 0 : b.quantity);
                }, 0);
                const expiredStock = med.totalStock - activeStock;

                const low = activeStock <= med.minStock;
                const expanded = expandedId === med.id;
                const isEditRow = editingId === med.id;

                return (
                  <div
                    key={med.id}
                    className={`rounded-2xl border transition ${
                      isEditRow
                        ? 'border-amber-200 bg-amber-50'
                        : low
                          ? 'border-rose-200 bg-rose-50/40'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50/60'
                    }`}
                  >
                    {/* ── Row ────────────────────────────────────────────── */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      {/* Name + category */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-zinc-950">{med.name}</span>
                          <span className="text-xs text-zinc-400">
                            {med.category.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          {low && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                              Low stock
                            </span>
                          )}
                          {expiredStock > 0 && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                              {expiredStock} expired
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {med.unit} · Rs. {med.sellingPrice.toFixed(2)} · min {med.minStock}
                        </p>
                      </div>

                      {/* Stock */}
                      <div className="text-right min-w-[80px]">
                        <p
                          className={`text-lg font-bold ${low ? 'text-rose-700' : 'text-zinc-950'}`}
                        >
                          {activeStock}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {med.batches.length} batch{med.batches.length !== 1 ? 'es' : ''}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : med.id)}
                          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 flex items-center gap-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Batches
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockTarget(med)}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="size-3"
                          >
                            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                          </svg>
                          Restock
                        </button>
                        {isEditRow ? (
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            id={`edit-med-${med.id}`}
                            onClick={() => startEdit(med)}
                            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                              className="size-3"
                            >
                              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.714 1.272l-.547 2.19a.75.75 0 0 0 .906.906l2.19-.547a2.75 2.75 0 0 0 1.272-.714l4.262-4.263a1.75 1.75 0 0 0 0-2.475ZM2.75 3.5c-.69 0-1.25.56-1.25 1.25v8.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 0 11 9v4.25H2.75V4.75H7A.75.75 0 0 0 7 3.5H2.75Z" />
                            </svg>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Batch detail ────────────────────────────────────── */}
                    {expanded && (
                      <div className="border-t border-zinc-200 px-4 pb-4 pt-3">
                        {med.batches.length === 0 ? (
                          <p className="text-sm text-zinc-400">
                            No stock batches. Click Restock to add the first batch.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs text-zinc-600">
                              <thead>
                                <tr className="text-zinc-400 uppercase tracking-wide">
                                  <th className="pb-2 pr-6">Batch #</th>
                                  <th className="pb-2 pr-6">Expiry</th>
                                  <th className="pb-2 pr-6">Qty</th>
                                  <th className="pb-2 pr-6">Purchase price</th>
                                  <th className="pb-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {med.batches.map((b) => {
                                  const exp = isExpired(b.expiryDate);
                                  const soon = !exp && isExpiringSoon(b.expiryDate);
                                  const isEditingThis = editingBatchId === b.id;
                                  if (isEditingThis) {
                                    return (
                                      <BatchEditRow
                                        key={b.id}
                                        batch={b}
                                        unit={med.unit}
                                        onSave={(updated) => handleBatchSaved(med.id, updated)}
                                        onCancel={() => setEditingBatchId(null)}
                                      />
                                    );
                                  }
                                  return (
                                    <tr key={b.id} className={exp ? 'opacity-50' : ''}>
                                      <td className="py-1.5 pr-6 font-medium text-zinc-800">
                                        {b.batchNumber ?? '—'}
                                      </td>
                                      <td className="py-1.5 pr-6">
                                        <span
                                          className={
                                            exp ? 'text-rose-600' : soon ? 'text-amber-600' : ''
                                          }
                                        >
                                          {fmtDate(b.expiryDate)}
                                          {exp && ' (expired)'}
                                          {soon && ' (expiring soon)'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 pr-6 font-semibold text-zinc-950">
                                        {b.quantity}
                                      </td>
                                      <td className="py-1.5 pr-6">
                                        {b.purchasePrice !== null
                                          ? `Rs. ${b.purchasePrice.toFixed(2)}`
                                          : '—'}
                                      </td>
                                      <td className="py-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setEditingBatchId(b.id)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100"
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="size-3"
                                          >
                                            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.714 1.272l-.547 2.19a.75.75 0 0 0 .906.906l2.19-.547a2.75 2.75 0 0 0 1.272-.714l4.262-4.263a1.75 1.75 0 0 0 0-2.475ZM2.75 3.5c-.69 0-1.25.56-1.25 1.25v8.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 0 11 9v4.25H2.75V4.75H7A.75.75 0 0 0 7 3.5H2.75Z" />
                                          </svg>
                                          Edit
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
