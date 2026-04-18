'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

type BillPayload = {
  id: string;
  billNumber: string;
  patientId: string | null;
  patientName: string;
  phone: string | null;
  billAt: string;
  discount: number;
  totalAmount: number;
  createdAt: string;
  items: BillItemPayload[];
};

type BillItemPayload = {
  id: string;
  billId: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  medicineId: string | null;
  medicine?: {
    id: string;
    name: string;
  } | null;
};

type PatientOption = {
  id: string;
  name: string;
  phone: string | null;
};

type MedicineOption = {
  id: string;
  name: string;
  sellingPrice: number;
};

type BillItemForm = {
  category: string;
  description: string;
  quantity: string;
  unitPrice: string;
  medicineId: string;
};

type FormState = {
  patientId: string;
  patientName: string;
  phone: string;
  billAt: string;
  discount: string;
  items: BillItemForm[];
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

const getTodayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createInitialFormState = (): FormState => ({
  patientId: '',
  patientName: '',
  phone: '',
  billAt: getTodayDateInput(),
  discount: '0',
  items: [
    {
      category: 'Medicine',
      description: '',
      quantity: '1',
      unitPrice: '',
      medicineId: '',
    },
  ],
});

const inputClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

export default function BillManager() {
  const [bills, setBills] = useState<BillPayload[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bills', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load bills.');
      }
      const data = (await response.json()) as BillPayload[];
      setBills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/patients', { cache: 'no-store' });
      if (response.ok) {
        const data = (await response.json()) as PatientOption[];
        setPatients(data);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

  const fetchMedicines = async () => {
    try {
      const response = await fetch('/api/medicines', { cache: 'no-store' });
      if (response.ok) {
        const data = (await response.json()) as MedicineOption[];
        setMedicines(data);
      }
    } catch (err) {
      console.error('Failed to fetch medicines:', err);
    }
  };

  useEffect(() => {
    void fetchBills();
    void fetchPatients();
    void fetchMedicines();
  }, []);

  const handleChange = (field: keyof Omit<FormState, 'items'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));

    // Auto-fill patient details when patient is selected
    if (field === 'patientId' && value) {
      const selectedPatient = patients.find((p) => p.id === value);
      if (selectedPatient) {
        setForm((current) => ({
          ...current,
          patientName: selectedPatient.name,
          phone: selectedPatient.phone || '',
        }));
      }
    }
  };

  const handleItemChange = (index: number, field: keyof BillItemForm, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));

    // Auto-fill price when medicine is selected
    if (field === 'medicineId' && value) {
      const selectedMedicine = medicines.find((m) => m.id === value);
      if (selectedMedicine) {
        setForm((current) => ({
          ...current,
          items: current.items.map((item, i) =>
            i === index
              ? {
                  ...item,
                  unitPrice: selectedMedicine.sellingPrice.toString(),
                  description: selectedMedicine.name,
                }
              : item
          ),
        }));
      }
    }
  };

  const addItem = () => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          category: 'Medicine',
          description: '',
          quantity: '1',
          unitPrice: '',
          medicineId: '',
        },
      ],
    }));
  };

  const removeItem = (index: number) => {
    if (form.items.length > 1) {
      setForm((current) => ({
        ...current,
        items: current.items.filter((_, i) => i !== index),
      }));
    }
  };

  const calculateSubtotal = () => {
    return form.items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = parseFloat(form.discount) || 0;
    return Math.max(0, subtotal - discount);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate form
      if (!form.patientName.trim()) {
        throw new Error('Patient name is required.');
      }

      if (form.items.length === 0) {
        throw new Error('At least one item is required.');
      }

      for (const item of form.items) {
        if (!item.description.trim()) {
          throw new Error('All items must have a description.');
        }
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          throw new Error('All items must have a valid quantity.');
        }
        if (!item.unitPrice || parseFloat(item.unitPrice) <= 0) {
          throw new Error('All items must have a valid unit price.');
        }
      }

      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: form.patientId || undefined,
          patientName: form.patientName.trim(),
          phone: form.phone || undefined,
          billAt: form.billAt,
          discount: parseFloat(form.discount) || 0,
          items: form.items.map((item) => ({
            category: item.category,
            description: item.description.trim(),
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            medicineId: item.medicineId || undefined,
          })),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Could not create bill.');
      }

      setBills((current) => [result, ...current]);
      setForm(createInitialFormState());
      setSuccess('Bill created successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const totalBills = bills.length;
  const totalRevenue = useMemo(() =>
    bills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount.toString()), 0),
    [bills]
  );

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Billing system</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Create new bill</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Total bills</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{totalBills}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Total revenue</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">Rs. {totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            {/* Patient Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Select Patient
                <select
                  className={inputClass}
                  value={form.patientId}
                  onChange={(event) => handleChange('patientId', event.target.value)}
                >
                  <option value="">New Patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} {patient.phone && `(${patient.phone})`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Patient Name*
                <input
                  className={inputClass}
                  value={form.patientName}
                  onChange={(event) => handleChange('patientName', event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                Phone
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                Bill Date*
                <input
                  className={inputClass}
                  type="date"
                  value={form.billAt}
                  onChange={(event) => handleChange('billAt', event.target.value)}
                  required
                />
              </label>
            </div>

            {/* Bill Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-950">Bill Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
                >
                  Add Item
                </button>
              </div>

              {form.items.map((item, index) => (
                <div key={index} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-medium text-zinc-950">Item {index + 1}</h4>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="space-y-2 text-sm text-zinc-700">
                      Category
                      <select
                        className={inputClass}
                        value={item.category}
                        onChange={(event) => handleItemChange(index, 'category', event.target.value)}
                      >
                        {billCategories.map((category) => (
                          <option key={category} value={category}>
                            {category.replace(/([A-Z])/g, ' $1').trim()}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-zinc-700">
                      Medicine (Optional)
                      <select
                        className={inputClass}
                        value={item.medicineId}
                        onChange={(event) => handleItemChange(index, 'medicineId', event.target.value)}
                      >
                        <option value="">Select Medicine</option>
                        {medicines.map((medicine) => (
                          <option key={medicine.id} value={medicine.id}>
                            {medicine.name} - Rs. {medicine.sellingPrice}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-zinc-700">
                      Description*
                      <input
                        className={inputClass}
                        value={item.description}
                        onChange={(event) => handleItemChange(index, 'description', event.target.value)}
                        required
                      />
                    </label>

                    <label className="space-y-2 text-sm text-zinc-700">
                      Quantity*
                      <input
                        className={inputClass}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                        required
                      />
                    </label>

                    <label className="space-y-2 text-sm text-zinc-700">
                      Unit Price*
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">Rs. </span>
                        <input
                          className={`${inputClass} pl-9`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) => handleItemChange(index, 'unitPrice', event.target.value)}
                          required
                        />
                      </div>
                    </label>

                    <div className="flex items-end">
                      <div className="w-full rounded-2xl bg-white px-4 py-3 text-sm text-zinc-950">
                        <p className="text-xs text-zinc-500">Amount</p>
                        <p className="font-semibold">
                          Rs. {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Discount</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">Rs. </span>
                    <input
                      className={`${inputClass} pl-9`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discount}
                      onChange={(event) => handleChange('discount', event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Subtotal:</span>
                    <span className="font-medium">Rs. {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Discount:</span>
                    <span className="font-medium">-Rs. {parseFloat(form.discount || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-2 text-lg font-semibold">
                    <span>Total:</span>
                    <span>Rs. {calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Creating Bill...' : 'Create Bill'}
            </button>
          </div>
        </form>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {success && (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        )}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Recent Bills</h3>
            <p className="mt-2 text-sm text-zinc-600">
              View and manage all created bills.
            </p>
          </div>
          <div className="text-sm font-medium text-zinc-700">Sorted by newest first</div>
        </div>

        {loading && bills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Loading bills...
          </div>
        ) : bills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            No bills created yet. Create your first bill with the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Bill Number</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-semibold text-zinc-950">{bill.billNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-zinc-950">{bill.patientName}</p>
                        {bill.phone && <p className="text-xs text-zinc-500">{bill.phone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{new Date(bill.billAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{bill.items.length} item{bill.items.length !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 font-semibold">Rs. {parseFloat(bill.totalAmount.toString()).toFixed(2)}</td>
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