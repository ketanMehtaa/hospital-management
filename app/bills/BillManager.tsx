'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillPayload = {
  id: string;
  billNumber: string;
  patientId: string | null;
  patientName: string;
  phone: string | null;
  billAt: string;
  discount: string;
  totalAmount: string;
  paidCash: string;
  paidOnline: string;
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
  medicine?: { id: string; name: string } | null;
};

type PatientOption = { id: string; name: string; phone: string | null };
type MedicineOption = { id: string; name: string; sellingPrice: number; totalStock: number };

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
  paidCash: string;
  paidOnline: string;
  items: BillItemForm[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const billCategories = [
  'OpdConsultation',
  'Medicine',
  'Endoscopy',
  'Procedure',
  'HearingTest',
  'Radiology',
  'Pathology',
] as const;

type BillCategory = (typeof billCategories)[number];

const defaultCategoryPrices: Partial<Record<BillCategory, number>> = {
  OpdConsultation: 500,
  Endoscopy: 500,
  Procedure: 500,
  HearingTest: 500,
  Radiology: 500,
  Pathology: 500,
};

const getTodayDateInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const makeBlankItem = (): BillItemForm => ({
  category: 'Medicine',
  description: '',
  quantity: '1',
  unitPrice: '',
  medicineId: '',
});

const createInitialFormState = (): FormState => ({
  patientId: '',
  patientName: '',
  phone: '',
  billAt: getTodayDateInput(),
  discount: '0',
  paidCash: '',
  paidOnline: '',
  items: [makeBlankItem()],
});

const billToFormState = (bill: BillPayload): FormState => ({
  patientId: bill.patientId ?? '',
  patientName: bill.patientName,
  phone: bill.phone ?? '',
  billAt: new Date(bill.billAt).toLocaleDateString('en-CA'),
  discount: String(bill.discount),
  paidCash: parseFloat(bill.paidCash) > 0 ? String(bill.paidCash) : '',
  paidOnline: parseFloat(bill.paidOnline) > 0 ? String(bill.paidOnline) : '',
  items: bill.items.map((item) => ({
    category: item.category,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    medicineId: item.medicineId ?? '',
  })),
});

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

// ─────────────────────────────────────────────────────────────────────────────

export default function BillManager() {
  const [bills, setBills] = useState<BillPayload[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Patient search combobox ────────────────────────────────────────────────
  const [patientQuery, setPatientQuery] = useState('');
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.phone ?? '').includes(q),
      )
      .slice(0, 8);
  }, [patientQuery, patients]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setPatientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bills', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load bills.');
      setBills((await res.json()) as BillPayload[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch('/api/patients', { cache: 'no-store' });
      if (res.ok) setPatients((await res.json()) as PatientOption[]);
    } catch { /* non-critical */ }
  };

  const fetchMedicines = async () => {
    try {
      const res = await fetch('/api/medicines', { cache: 'no-store' });
      if (res.ok) setMedicines((await res.json()) as MedicineOption[]);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    void fetchBills();
    void fetchPatients();
    void fetchMedicines();
  }, []);

  // ── Patient combobox handlers ──────────────────────────────────────────────

  const selectPatient = (patient: PatientOption) => {
    setForm((cur) => ({
      ...cur,
      patientId: patient.id,
      patientName: patient.name,
      phone: patient.phone ?? '',
    }));
    setPatientQuery(patient.name);
    setPatientDropdownOpen(false);
  };

  const clearPatient = () => {
    setForm((cur) => ({ ...cur, patientId: '', patientName: '', phone: '' }));
    setPatientQuery('');
    setPatientDropdownOpen(false);
  };

  // ── Form helpers ────────────────────────────────────────────────────────────

  const handleChange = (field: keyof Omit<FormState, 'items'>, value: string) => {
    setForm((cur) => ({ ...cur, [field]: value }));
  };

  const handleItemChange = (index: number, field: keyof BillItemForm, value: string) => {
    setForm((cur) => {
      const updatedItems = cur.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      );

      if (field === 'category') {
        const cat = value as BillCategory;
        updatedItems[index] = {
          ...updatedItems[index],
          medicineId: '',
          unitPrice: defaultCategoryPrices[cat] ? String(defaultCategoryPrices[cat]) : '',
          description: cat !== 'Medicine' ? cat.replace(/([A-Z])/g, ' $1').trim() : '',
        };
      }

      if (field === 'medicineId' && value) {
        const med = medicines.find((m) => m.id === value);
        if (med) {
          updatedItems[index] = {
            ...updatedItems[index],
            unitPrice: String(med.sellingPrice),
            description: med.name,
          };
        }
      }

      return { ...cur, items: updatedItems };
    });
  };

  const addItem = () =>
    setForm((cur) => ({ ...cur, items: [...cur.items, makeBlankItem()] }));

  const removeItem = (index: number) => {
    if (form.items.length > 1)
      setForm((cur) => ({ ...cur, items: cur.items.filter((_, i) => i !== index) }));
  };

  // ── Totals ──────────────────────────────────────────────────────────────────

  const subtotal = useMemo(
    () =>
      form.items.reduce(
        (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
        0,
      ),
    [form.items],
  );

  const total = useMemo(
    () => Math.max(0, subtotal - (parseFloat(form.discount) || 0)),
    [subtotal, form.discount],
  );

  const paidTotal = useMemo(
    () => (parseFloat(form.paidCash) || 0) + (parseFloat(form.paidOnline) || 0),
    [form.paidCash, form.paidOnline],
  );

  // ── Auto-fill missing amount to Online ──────────────────────────────────────
  useEffect(() => {
    const cashVal = parseFloat(form.paidCash) || 0;
    const remaining = Math.max(0, total - cashVal);
    
    // Check if what's already in the form matches the remaining value to prevent loops
    const currentOnline = parseFloat(form.paidOnline) || 0;
    if (Math.abs(currentOnline - remaining) > 0.01) {
      setForm((cur) => ({
        ...cur,
        paidOnline: remaining > 0 ? remaining.toFixed(2) : '',
      }));
    }
  }, [total, form.paidCash]);

  // ── Edit helpers ────────────────────────────────────────────────────────────

  const startEdit = (bill: BillPayload) => {
    setEditingId(bill.id);
    const fs = billToFormState(bill);
    setForm(fs);
    setPatientQuery(bill.patientName);
    setError(null);
    setSuccess(null);
    document.getElementById('bill-form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(createInitialFormState());
    setPatientQuery('');
    setError(null);
    setSuccess(null);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    // ── Validation ───────────────────────────────────────────────────────────
    if (!form.patientId) {
      setError('Please search and select a patient.');
      return;
    }
    if (form.items.length === 0) {
      setError('At least one item is required.');
      return;
    }
    for (const item of form.items) {
      if (!item.description.trim()) { setError('All items must have a description.'); return; }
      if (!item.quantity || parseFloat(item.quantity) <= 0) { setError('All items must have a valid quantity.'); return; }
      if (!item.unitPrice || parseFloat(item.unitPrice) <= 0) { setError('All items must have a valid unit price.'); return; }
    }

    // Cash + Online MUST equal the bill total — always required
    const cashVal = parseFloat(form.paidCash) || 0;
    const onlineVal = parseFloat(form.paidOnline) || 0;
    const diff = Math.abs(cashVal + onlineVal - total);
    if (diff > 0.01) {
      setError(
        `Payment required: Cash + Online must equal Rs. ${total.toFixed(2)}. Currently Rs. ${(cashVal + onlineVal).toFixed(2)}.`,
      );
      return;
    }

    setLoading(true);
    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `/api/bills/${editingId}` : '/api/bills';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: form.patientId || undefined,
          patientName: form.patientName.trim(),
          phone: form.phone || undefined,
          billAt: form.billAt,
          discount: parseFloat(form.discount) || 0,
          paidCash: cashVal,
          paidOnline: onlineVal,
          items: form.items.map((item) => ({
            category: item.category,
            description: item.description.trim(),
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            medicineId: item.medicineId || undefined,
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `Could not ${isEdit ? 'update' : 'create'} bill.`);

      const saved = result as BillPayload;
      if (isEdit) {
        setBills((cur) => cur.map((b) => (b.id === saved.id ? saved : b)));
        setSuccess('Bill updated successfully.');
        setEditingId(null);
      } else {
        setBills((cur) => [saved, ...cur]);
        setSuccess('Bill created successfully.');
      }
      setForm(createInitialFormState());
      setPatientQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = editingId !== null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Bill form ─────────────────────────────────────────────────────── */}
      <section
        id="bill-form-section"
        className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
              {isEditing ? 'Editing bill' : 'Billing system'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
              {isEditing ? 'Edit bill record' : 'Create new bill'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
            </svg>
            Editing&nbsp;
            <span className="font-semibold">
              {bills.find((b) => b.id === editingId)?.billNumber ?? 'bill'}
            </span>
            &mdash; submit to save changes.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">

            {/* ── Patient search + Phone + Bill Date ──────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 text-sm text-zinc-700">
                <span className="block font-medium">
                  Patient*
                  {form.patientId && (
                    <button
                      type="button"
                      onClick={clearPatient}
                      className="ml-2 text-xs font-normal text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
                    >
                      clear
                    </button>
                  )}
                </span>

                <div className="relative" ref={patientSearchRef}>
                  {/* Selected chip */}
                  {form.patientId ? (
                    <div className={`${inputCls} flex items-center justify-between !py-2.5`}>
                      <div>
                        <span className="font-medium text-zinc-950">{form.patientName}</span>
                        {form.phone && (
                          <span className="ml-2 text-xs text-zinc-400">{form.phone}</span>
                        )}
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Selected
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        id="patient-search"
                        className={`${inputCls} pl-10`}
                        placeholder="Search by name or phone…"
                        autoComplete="off"
                        value={patientQuery}
                        onChange={(e) => {
                          setPatientQuery(e.target.value);
                          setPatientDropdownOpen(true);
                        }}
                        onFocus={() => setPatientDropdownOpen(true)}
                      />
                    </>
                  )}

                  {/* Dropdown */}
                  {patientDropdownOpen && !form.patientId && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-100/80">
                      {filteredPatients.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-500">No patients found.</div>
                      ) : (
                        filteredPatients.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectPatient(p)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-zinc-50"
                          >
                            <span className="font-medium text-zinc-950">{p.name}</span>
                            {p.phone && <span className="text-xs text-zinc-400">{p.phone}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Phone — always read-only, auto-filled from patient */}
              <label className="space-y-2 text-sm text-zinc-700 flex flex-col">
                <span className="block font-medium">Phone</span>
                <input
                  className={`${inputCls} cursor-not-allowed bg-zinc-50 text-zinc-400 select-none`}
                  value={form.phone}
                  readOnly
                  tabIndex={-1}
                />
              </label>

              {/* Bill Date — sits in the same row as patient + phone */}
              <label className="space-y-2 text-sm text-zinc-700 flex flex-col">
                <span className="block font-medium">Bill Date*</span>
                <input
                  className={inputCls}
                  type="date"
                  value={form.billAt}
                  onChange={(e) => handleChange('billAt', e.target.value)}
                  required
                />
              </label>
            </div>

            {/* ── Bill items ──────────────────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-950">Bill Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
                >
                  + Add Item
                </button>
              </div>

              {form.items.map((item, index) => {
                const isMedicine = item.category === 'Medicine';
                const defaultPrice = defaultCategoryPrices[item.category as BillCategory];

                return (
                  <div key={index} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-medium text-zinc-950">Item {index + 1}</h4>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Category */}
                      <label className="space-y-2 text-sm text-zinc-700">
                        Category
                        <select
                          className={inputCls}
                          value={item.category}
                          onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                        >
                          {billCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.replace(/([A-Z])/g, ' $1').trim()}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Medicine picker OR auto-price display */}
                      {isMedicine ? (
                        <label className="space-y-2 text-sm text-zinc-700">
                          Medicine
                          <select
                            className={inputCls}
                            value={item.medicineId}
                            onChange={(e) => handleItemChange(index, 'medicineId', e.target.value)}
                          >
                            <option value="">— Select medicine —</option>
                            {medicines.map((med) => (
                              <option
                                key={med.id}
                                value={med.id}
                                disabled={med.totalStock <= 0}
                              >
                                {med.name} — Rs. {med.sellingPrice} — Stock: {med.totalStock}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : defaultPrice != null ? (
                        <label className="space-y-2 text-sm text-zinc-700">
                          Auto Price
                          <div className={`${inputCls} flex items-center justify-between !cursor-default select-none`}>
                            <span className="text-zinc-400 text-xs">Default</span>
                            <span className="font-semibold text-zinc-950">Rs. {defaultPrice}</span>
                          </div>
                        </label>
                      ) : null}

                      {/* Description */}
                      <label className="space-y-2 text-sm text-zinc-700">
                        Description*
                        <input
                          className={inputCls}
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          required
                        />
                      </label>

                      {/* Quantity */}
                      <label className="space-y-2 text-sm text-zinc-700">
                        Quantity*
                        <input
                          className={inputCls}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </label>

                      {/* Unit price */}
                      <label className="space-y-2 text-sm text-zinc-700">
                        Unit Price (Rs.)*
                        <div className="relative">
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                            Rs.
                          </span>
                          <input
                            className={`${inputCls} pl-10`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            required
                          />
                        </div>
                      </label>

                      {/* Amount chip */}
                      <label className="space-y-2 text-sm text-zinc-700">
                        Amount
                        <div className={`${inputCls} flex items-center justify-between !cursor-default select-none bg-zinc-100 border-zinc-100`}>
                          <span className="text-zinc-400 text-xs">Total</span>
                          <span className="font-semibold text-zinc-950">
                            Rs.{' '}
                            {(
                              (parseFloat(item.quantity) || 0) *
                              (parseFloat(item.unitPrice) || 0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Summary + payment ───────────────────────────────────────── */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 space-y-6">

              {/* Discount + breakdown */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-700">
                  Discount (Rs.)
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                      Rs.
                    </span>
                    <input
                      className={`${inputCls} pl-10`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discount}
                      onChange={(e) => handleChange('discount', e.target.value)}
                    />
                  </div>
                </label>

                <div className="space-y-3 pt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Subtotal</span>
                    <span className="font-medium text-zinc-950">Rs. {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Discount</span>
                    <span className="font-medium text-zinc-950">
                      − Rs. {parseFloat(form.discount || '0').toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-950">
                    <span>Total</span>
                    <span>Rs. {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment split */}
              <div className="border-t border-zinc-200 pt-5">
                <p className="mb-1 text-sm font-semibold text-zinc-700">Payment Received</p>
                <p className="mb-4 text-xs text-zinc-400">
                  Cash + Online must equal the total (Rs. {total.toFixed(2)}).
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Cash */}
                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-emerald-600">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95a.75.75 0 0 0 1.192-.91C12.637 5.55 11.596 5 10.5 5s-2.137.55-2.894 1.54A5.205 5.205 0 0 0 6.83 8H6a.75.75 0 0 0 0 1.5h.465a6.7 6.7 0 0 0 0 1H6A.75.75 0 0 0 6 12h.83c.182.528.43 1.005.776 1.46C8.363 14.45 9.404 15 10.5 15s2.137-.55 2.894-1.54a.75.75 0 0 0-1.192-.91c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95A3.505 3.505 0 0 1 8.362 12h2.388a.75.75 0 0 0 0-1.5H8.087a5.2 5.2 0 0 1 0-1h2.663a.75.75 0 0 0 0-1.5H8.362c.08-.18.17-.35.436-.55Z" clipRule="evenodd" />
                      </svg>
                      Cash
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">Rs.</span>
                      <input
                        id="paid-cash"
                        className={`${inputCls} pl-10`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.paidCash}
                        onChange={(e) => handleChange('paidCash', e.target.value)}
                      />
                    </div>
                  </label>

                  {/* Online */}
                  <label className="space-y-2 text-sm text-zinc-700">
                    <span className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-blue-600">
                        <path d="M2.5 4A1.5 1.5 0 0 0 1 5.5v1h18v-1A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1V14.5A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5V8.5ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" />
                      </svg>
                      Online
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">Rs.</span>
                      <input
                        id="paid-online"
                        className={`${inputCls} pl-10`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.paidOnline}
                        onChange={(e) => handleChange('paidOnline', e.target.value)}
                      />
                    </div>
                  </label>
                </div>

                {/* Live payment status */}
                {paidTotal > 0 && (
                  <div
                    className={`mt-3 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      Math.abs(paidTotal - total) <= 0.01
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    <span>
                      {Math.abs(paidTotal - total) <= 0.01
                        ? '✓ Payment matches total'
                        : paidTotal < total
                          ? `Remaining: Rs. ${(total - paidTotal).toFixed(2)}`
                          : `Overpaid by: Rs. ${(paidTotal - total).toFixed(2)}`}
                    </span>
                    <span>Rs. {paidTotal.toFixed(2)} paid</span>
                  </div>
                )}
              </div>
            </div>

            <button
              id="bill-submit-btn"
              type="submit"
              className={`inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isEditing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-zinc-950 hover:bg-zinc-800'
              }`}
              disabled={loading}
            >
              {loading
                ? isEditing ? 'Updating Bill...' : 'Creating Bill...'
                : isEditing ? 'Update Bill' : 'Create Bill'}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        )}
      </section>

      {/* ── Recent bills ───────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Recent Bills <span className="text-sm font-normal text-zinc-400">(last 10)</span></h3>
            <p className="mt-1 text-sm text-zinc-600">View and manage all created bills.</p>
          </div>
          <div className="text-sm font-medium text-zinc-500">Sorted by newest first</div>
        </div>

        {loading && bills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Loading bills…
          </div>
        ) : bills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            No bills created yet. Create your first bill above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Bill #</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {bills.slice(0, 10).map((bill) => {
                  const cash = parseFloat(bill.paidCash ?? '0');
                  const online = parseFloat(bill.paidOnline ?? '0');
                  return (
                    <tr
                      key={bill.id}
                      className={`transition ${editingId === bill.id ? 'bg-amber-50' : 'hover:bg-zinc-50'}`}
                    >
                      <td className="px-4 py-3 font-semibold text-zinc-950">{bill.billNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-950">{bill.patientName}</p>
                        {bill.phone && <p className="text-xs text-zinc-400">{bill.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {new Date(bill.billAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {bill.items.length} item{bill.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-950">
                        Rs. {parseFloat(bill.totalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 space-y-0.5 text-xs">
                        {cash > 0 && (
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Cash Rs. {cash.toFixed(2)}
                          </div>
                        )}
                        {online > 0 && (
                          <div className="flex items-center gap-1.5 text-blue-700">
                            <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                            Online Rs. {online.toFixed(2)}
                          </div>
                        )}
                        {cash === 0 && online === 0 && (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === bill.id ? (
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            type="button"
                            id={`edit-bill-${bill.id}`}
                            onClick={() => startEdit(bill)}
                            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3">
                              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.714 1.272l-.547 2.19a.75.75 0 0 0 .906.906l2.19-.547a2.75 2.75 0 0 0 1.272-.714l4.262-4.263a1.75 1.75 0 0 0 0-2.475ZM2.75 3.5c-.69 0-1.25.56-1.25 1.25v8.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 0 11 9v4.25H2.75V4.75H7A.75.75 0 0 0 7 3.5H2.75Z" />
                            </svg>
                            Edit
                          </button>
                        )}
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