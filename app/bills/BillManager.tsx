'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Patient = {
  id: number;
  name: string;
  phone?: string | null;
};

type Medicine = {
  id: number;
  name: string;
  sellingPrice: number;
};

type BillItemForm = {
  medicineId: string;
  category: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: number;
};

type BillRecord = {
  id: number;
  billNumber: string;
  patientName: string;
  phone?: string | null;
  billDate: string;
  billTime?: string | null;
  discount: number;
  totalAmount: number;
  items: Array<{ id: number; description: string; quantity: number; unitPrice: number; amount: number }>;
  createdAt: string;
};

const billCategories = [
  'OpdConsultation',
  'Medicine',
  'Endoscopy',
  'Procedure',
  'HearingTest',
  'Radiology',
  'Pathology',
];

const initialLineItem: BillItemForm = {
  medicineId: '',
  category: 'Medicine',
  description: '',
  quantity: '1',
  unitPrice: '0',
  amount: 0,
};

const initialFormState = {
  patientId: '',
  patientName: '',
  phone: '',
  billDate: new Date().toISOString().slice(0, 10),
  billTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  discount: '0',
  items: [initialLineItem],
};

export default function BillManager() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [form, setForm] = useState(() => ({ ...initialFormState }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPatients = async () => {
    const response = await fetch('/api/patients', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load patients.');
    setPatients(await response.json());
  };

  const fetchMedicines = async () => {
    const response = await fetch('/api/medicines', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load medicines.');
    setMedicines(await response.json());
  };

  const fetchBills = async () => {
    const response = await fetch('/api/bills', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load bills.');
    setBills(await response.json());
  };

  useEffect(() => {
    void Promise.all([fetchPatients(), fetchMedicines(), fetchBills()]).catch((err) => {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    });
  }, []);

  const handlePatientChange = (patientId: string) => {
    const selected = patients.find((patient) => patient.id === Number(patientId));
    setForm((current) => ({
      ...current,
      patientId,
      patientName: selected ? selected.name : current.patientName,
      phone: selected?.phone || current.phone,
    }));
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateLineItem = (index: number, field: keyof BillItemForm, value: string) => {
    setForm((current) => {
      const nextItems = [...current.items];
      const item = { ...nextItems[index], [field]: value };

      if (field === 'medicineId') {
        const selected = medicines.find((medicine) => medicine.id === Number(value));
        if (selected) {
          item.description = selected.name;
          item.unitPrice = String(selected.sellingPrice);
          item.category = 'Medicine';
        }
      }

      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      item.amount = Number((quantity * unitPrice).toFixed(2));
      nextItems[index] = item;

      return { ...current, items: nextItems };
    });
  };

  const addLineItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, { ...initialLineItem }] }));
  };

  const removeLineItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const lineTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.amount), 0),
    [form.items]
  );

  const discountValue = Number(form.discount) || 0;
  const payableAmount = Math.max(0, lineTotal - discountValue);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!form.patientName.trim()) {
      setError('Please provide a patient name.');
      setLoading(false);
      return;
    }

    const filteredItems = form.items
      .map((item) => ({
        medicineId: item.medicineId ? Number(item.medicineId) : undefined,
        category: item.category,
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        amount: Number(item.amount),
      }))
      .filter((item) => item.description && item.quantity > 0 && item.unitPrice >= 0);

    if (filteredItems.length === 0) {
      setError('Add at least one valid billing item.');
      setLoading(false);
      return;
    }

    if (payableAmount < 0) {
      setError('Discount cannot exceed the bill total.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: form.patientId ? Number(form.patientId) : undefined,
          patientName: form.patientName.trim(),
          phone: form.phone.trim() || undefined,
          billDate: form.billDate,
          billTime: form.billTime.trim() || undefined,
          discount: discountValue,
          items: filteredItems,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Could not create bill.');
      }

      setBills((current) => [result, ...current]);
      setForm({ ...initialFormState, billDate: form.billDate, billTime: form.billTime });
      setSuccess('Bill created successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Billing</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Create new bill</h2>
            <p className="mt-2 text-sm text-zinc-600">Generate invoices and track totals for each visit.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Subtotal</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">₹{lineTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Payable</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-950">₹{payableAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-zinc-700">
              Patient record
              <select
                value={form.patientId}
                onChange={(event) => handlePatientChange(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Select patient (or enter manually)</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              Patient name*
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                value={form.patientName}
                onChange={(event) => updateField('patientName', event.target.value)}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              Phone
              <input
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2 text-sm text-zinc-700">
              Bill date
              <input
                type="date"
                value={form.billDate}
                onChange={(event) => updateField('billDate', event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              Bill time
              <input
                type="time"
                value={form.billTime}
                onChange={(event) => updateField('billTime', event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              Discount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(event) => updateField('discount', event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <div className="space-y-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-950">Bill items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add item
              </button>
            </div>

            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div key={index} className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-200/20">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <label className="space-y-2 text-sm text-zinc-700">
                      Medicine
                      <select
                        value={item.medicineId}
                        onChange={(event) => updateLineItem(index, 'medicineId', event.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">Select medicine</option>
                        {medicines.map((medicine) => (
                          <option key={medicine.id} value={medicine.id}>
                            {medicine.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-zinc-700">
                      Category
                      <select
                        value={item.category}
                        onChange={(event) => updateLineItem(index, 'category', event.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        {billCategories.map((category) => (
                          <option key={category} value={category}>
                            {category.replace(/([A-Z])/g, ' $1').trim()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-zinc-700">
                      Description
                      <input
                        value={item.description}
                        onChange={(event) => updateLineItem(index, 'description', event.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-zinc-700">
                      Quantity
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateLineItem(index, 'quantity', event.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="space-y-2 text-sm text-zinc-700">
                      Unit price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => updateLineItem(index, 'unitPrice', event.target.value)}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                    <div className="space-y-2 text-sm text-zinc-700">
                      <span>Amount</span>
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-950">
                        ₹{item.amount.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 text-sm text-zinc-700">
              <p>Subtotal: ₹{lineTotal.toFixed(2)}</p>
              <p>Discount: ₹{discountValue.toFixed(2)}</p>
              <p className="text-lg font-semibold">Total payable: ₹{payableAmount.toFixed(2)}</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving bill...' : 'Create bill'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Recent bills</h3>
            <p className="mt-2 text-sm text-zinc-600">Review the latest invoices created from this dashboard.</p>
          </div>
          <div className="text-sm font-medium text-zinc-700">{bills.length} bills</div>
        </div>

        {bills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            No bills yet. Create your first bill using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Bill #</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="px-4 py-3 font-semibold text-zinc-950">{bill.billNumber}</td>
                    <td className="px-4 py-3">{bill.patientName}</td>
                    <td className="px-4 py-3">{bill.items.length}</td>
                    <td className="px-4 py-3">₹{bill.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {new Date(bill.billDate).toLocaleDateString()} {bill.billTime ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
