'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';

type PatientPayload = {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  diagnosis: string | null;
  visitAt: string;
  createdAt: string;
  visitType?: 'Consultation' | 'FollowUp';
  visitId?: string;
};

type FormState = {
  name: string;
  age: string;
  gender: string;
  phone: string;
  address: string;
  diagnosis: string;
  visitDate: string;
  visitTime: string;
  visitType: 'Consultation' | 'FollowUp';
};

const getTodayDateInput = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

const getCurrentTimeInput = () => {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
};

const createInitialFormState = (): FormState => ({
  name: '',
  age: '',
  gender: '',
  phone: '',
  address: '',
  diagnosis: '',
  visitDate: getTodayDateInput(),
  visitTime: getCurrentTimeInput(),
  visitType: 'Consultation',
});

const visitAtToFormFields = (visitAt: string): { visitDate: string; visitTime: string } => {
  const d = new Date(visitAt);
  const visitDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const visitTime = d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return { visitDate, visitTime };
};

const patientToFormState = (p: PatientPayload): FormState => ({
  name: p.name,
  age: p.age !== null ? String(p.age) : '',
  gender: p.gender ?? '',
  phone: p.phone ?? '',
  address: p.address ?? '',
  diagnosis: p.diagnosis ?? '',
  ...visitAtToFormFields(p.visitAt),
  visitType: p.visitType ?? 'Consultation',
});

// ─── Input / Select class ─────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

// ─────────────────────────────────────────────────────────────────────────────

export default function PatientManager() {
  const [patients, setPatients] = useState<PatientPayload[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'edit' | 'follow-up'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Fetch all patients ──────────────────────────────────────────────────────
  const fetchPatients = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/visits', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load patients.');
      const data = (await response.json()) as PatientPayload[];
      setPatients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPatients();
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePhoneChange = async (value: string) => {
    const newPhone = value.replace(/\D/g, '').slice(0, 10);
    handleChange('phone', newPhone);

    if (mode === 'follow-up' && newPhone.length < 10) {
      setEditingId(null);
      setMode('create');
      setForm(() => ({
        ...createInitialFormState(),
        phone: newPhone,
      }));
      setSuccess(null);
    }

    if (newPhone.length === 10 && mode === 'create') {
      try {
        const res = await fetch(`/api/patients?phone=${newPhone}`);
        if (res.ok) {
          const patientsList = (await res.json()) as PatientPayload[];
          if (patientsList.length > 0) {
            const patient = patientsList[0];
            setEditingId(patient.id);
            setMode('follow-up');
            setForm((cur) => ({
              ...cur,
              name: patient.name,
              age: patient.age !== null ? String(patient.age) : '',
              gender: patient.gender ?? '',
              address: patient.address ?? '',
              diagnosis: '',
              visitDate: getTodayDateInput(),
              visitTime: getCurrentTimeInput(),
              visitType: 'FollowUp',
            }));
            setSuccess('Patient found. Ready to create a follow-up visit.');
          }
        }
      } catch (err) {
        // ignore
      }
    }
  };

  const handleAgeChange = (value: string) => {
    if (!value) {
      handleChange('age', '');
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num)) return;
    handleChange('age', String(Math.min(110, Math.max(0, Math.trunc(num)))));
  };

  const buildVisitAt = () => {
    const resolvedVisitTime = form.visitTime || getCurrentTimeInput();
    return new Date(`${form.visitDate}T${resolvedVisitTime}:00`).toISOString();
  };

  // Populate the form from a clicked patient row
  const startEdit = (patient: PatientPayload) => {
    setEditingId(patient.id);
    setMode('edit');
    setForm(patientToFormState(patient));
    setError(null);
    setSuccess(null);
    document.getElementById('patient-form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const startFollowUp = (patient: PatientPayload) => {
    setEditingId(patient.id);
    setMode('follow-up');
    setForm((cur) => ({
      ...patientToFormState(patient),
      diagnosis: '',
      visitDate: getTodayDateInput(),
      visitTime: getCurrentTimeInput(),
      visitType: 'FollowUp',
    }));
    setError(null);
    setSuccess(null);
    document.getElementById('patient-form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMode('create');
    setForm(createInitialFormState());
    setError(null);
    setSuccess(null);
  };

  // ── Submit: create or update ────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (form.phone.length !== 10) {
        throw new Error('Phone number must be exactly 10 digits.');
      }

      const payload = {
        ...form,
        age: form.age ? Number(form.age) : undefined,
        visitAt: buildVisitAt(),
      };

      let url = '/api/patients';
      let method = 'POST';

      if (mode !== 'create' && editingId) {
        url = `/api/patients/${editingId}`;
        method = 'PATCH';
        (payload as any).action = mode;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const result = isJson
        ? ((await response.json()) as PatientPayload | { error?: string })
        : null;

      if (!response.ok) {
        const message = result && 'error' in result ? result.error : undefined;
        throw new Error(
          message ||
            `Could not ${mode === 'edit' ? 'update' : 'create'} patient/visit. (HTTP ${response.status})`,
        );
      }

      const savedPatient =
        result && typeof result === 'object' && 'id' in result && 'name' in result
          ? (result as PatientPayload)
          : null;

      if (!savedPatient) {
        throw new Error('Server returned an invalid response.');
      }

      await fetchPatients();

      if (mode === 'edit' || mode === 'follow-up') {
        setSuccess(mode === 'edit' ? 'Patient updated successfully.' : 'Follow-up visit created.');
        setEditingId(null);
        setMode('create');
      } else {
        setSuccess('Patient saved successfully.');
      }

      setForm(createInitialFormState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // const patientCount = useMemo(() => patients.length, [patients]);
  const isEditing = editingId !== null;

  return (
    <div className="space-y-8">
      {/* ── Form section ─────────────────────────────────────────────────── */}
      <section
        id="patient-form-section"
        className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20"
      >
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
              {mode === 'edit'
                ? 'Editing'
                : mode === 'follow-up'
                  ? form.visitType === 'Consultation'
                    ? 'Consultation'
                    : 'Follow Up'
                  : 'Patients'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
              {mode === 'edit'
                ? 'Edit patient record'
                : mode === 'follow-up'
                  ? form.visitType === 'Consultation'
                    ? 'New consultation visit'
                    : 'New follow-up visit'
                  : 'Patient registry'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {(mode === 'edit' || mode === 'follow-up') && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel {mode}
              </button>
            )}
          </div>
        </div>

        {mode !== 'create' && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4 shrink-0"
            >
              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
            </svg>
            {mode === 'edit'
              ? 'Editing '
              : form.visitType === 'Consultation'
                ? 'Adding consultation for '
                : 'Follow-up for '}
            <span className="font-semibold">
              {patients.find((p) => p.id === editingId)?.name ?? 'patient'}
            </span>
            &mdash;{' '}
            {mode === 'edit' ? 'changes will be saved on submit.' : 'a new visit will be created.'}
          </div>
        )}

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-2 text-sm text-zinc-700">
            Name*
            <input
              id="patient-name"
              className={inputCls}
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Age*
            <input
              id="patient-age"
              className={inputCls}
              type="number"
              min="0"
              max="110"
              step="1"
              value={form.age}
              onChange={(e) => handleAgeChange(e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Gender*
            <select
              id="patient-gender"
              className={inputCls}
              value={form.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              required
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Phone*
            <input
              id="patient-phone"
              className={inputCls}
              type="tel"
              inputMode="numeric"
              minLength={10}
              maxLength={10}
              pattern="\d{10}"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Visit date*
            <input
              id="patient-visit-date"
              className={inputCls}
              type="date"
              value={form.visitDate}
              onChange={(e) => handleChange('visitDate', e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Visit time
            <input
              id="patient-visit-time"
              className={inputCls}
              type="time"
              value={form.visitTime}
              onChange={(e) => handleChange('visitTime', e.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Visit type*
            <select
              id="patient-visit-type"
              className={inputCls}
              value={form.visitType}
              onChange={(e) => handleChange('visitType', e.target.value)}
              required
            >
              <option value="Consultation">New Consultation</option>
              <option value="FollowUp">Follow-up</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Address
            <textarea
              id="patient-address"
              className={inputCls}
              rows={3}
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Diagnosis
            <input
              id="patient-diagnosis"
              className={inputCls}
              value={form.diagnosis}
              onChange={(e) => handleChange('diagnosis', e.target.value)}
            />
          </label>

          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600">
              {mode === 'edit'
                ? 'Edit the fields above and submit to save changes.'
                : mode === 'follow-up'
                  ? `Review the details and submit to create a new ${form.visitType === 'Consultation' ? 'consultation' : 'follow-up'} visit.`
                  : 'Add new patients and keep your visit records in one place.'}
            </div>
            <button
              id="patient-submit-btn"
              type="submit"
              className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                mode !== 'create'
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-zinc-950 hover:bg-zinc-800'
              }`}
              disabled={loading}
            >
              {loading
                ? mode === 'edit'
                  ? 'Updating...'
                  : mode === 'follow-up'
                    ? form.visitType === 'Consultation'
                      ? 'Saving Consultation...'
                      : 'Saving Follow-up...'
                    : 'Saving...'
                : mode === 'edit'
                  ? 'Update patient'
                  : mode === 'follow-up'
                    ? form.visitType === 'Consultation'
                      ? 'Save Consultation'
                      : 'Save Follow-up'
                    : 'Save patient'}
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}
      </section>

      {/* ── Patient list ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <h3 className="mb-4 text-lg font-semibold text-zinc-950">
          Recent visits <span className="text-sm font-normal text-zinc-400">(last 10)</span>
        </h3>

        {loading && patients.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Loading patients...
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            No patients yet. Add one using the form above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Visit</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Diagnosis</th>
                  <th className="px-4 py-3 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {patients.slice(0, 10).map((patient) => (
                  <tr
                    key={patient.visitId || patient.id}
                    className={`transition ${editingId === patient.id ? 'bg-amber-50' : 'hover:bg-zinc-50'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-zinc-950">{patient.name}</td>
                    <td className="px-4 py-3">
                      <div>
                        {new Date(patient.visitAt).toLocaleDateString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                        })}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(patient.visitAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata',
                        })}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            patient.visitType === 'FollowUp'
                              ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                              : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                          }`}
                        >
                          {patient.visitType === 'FollowUp' ? 'Follow-up' : 'Consultation'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{patient.phone || '--'}</td>
                    <td className="px-4 py-3">{patient.diagnosis || '--'}</td>
                    <td className="px-4 py-3 text-right">
                      {(mode === 'edit' || mode === 'follow-up') && editingId === patient.id ? (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
                        >
                          Cancel
                        </button>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startFollowUp(patient)}
                            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                          >
                            Follow Up
                          </button>
                          <button
                            type="button"
                            id={`edit-patient-${patient.id}`}
                            onClick={() => startEdit(patient)}
                            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
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
                        </div>
                      )}
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
