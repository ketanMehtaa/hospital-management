'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

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
};

const getTodayDateInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeInput = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
});

/** Convert a stored ISO visitAt into separate date + time inputs */
const visitAtToFormFields = (visitAt: string): { visitDate: string; visitTime: string } => {
  const d = new Date(visitAt);
  const visitDate = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const visitTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
});

// ─── Input / Select class ─────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

// ─────────────────────────────────────────────────────────────────────────────

export default function PatientManager() {
  const [patients, setPatients] = useState<PatientPayload[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Fetch all patients ──────────────────────────────────────────────────────
  const fetchPatients = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/patients', { cache: 'no-store' });
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

  const handlePhoneChange = (value: string) => {
    handleChange('phone', value.replace(/\D/g, '').slice(0, 10));
  };

  const handleAgeChange = (value: string) => {
    if (!value) { handleChange('age', ''); return; }
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
    setForm(patientToFormState(patient));
    setError(null);
    setSuccess(null);
    // Scroll form into view smoothly
    document.getElementById('patient-form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
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

      const isEdit = editingId !== null;
      const url = isEdit ? `/api/patients/${editingId}` : '/api/patients';
      const method = isEdit ? 'PATCH' : 'POST';

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
          message || `Could not ${isEdit ? 'update' : 'create'} patient. (HTTP ${response.status})`,
        );
      }

      const savedPatient =
        result && typeof result === 'object' && 'id' in result && 'name' in result
          ? (result as PatientPayload)
          : null;

      if (!savedPatient) {
        throw new Error('Server returned an invalid response.');
      }

      if (isEdit) {
        setPatients((current) =>
          current.map((p) => (p.id === savedPatient.id ? savedPatient : p)),
        );
        setSuccess('Patient updated successfully.');
        setEditingId(null);
      } else {
        setPatients((current) => [savedPatient, ...current]);
        setSuccess('Patient saved successfully.');
      }

      setForm(createInitialFormState());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const patientCount = useMemo(() => patients.length, [patients]);
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
              {isEditing ? 'Editing' : 'Patients'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
              {isEditing ? 'Edit patient record' : 'Patient registry'}
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

        {/* Edit banner */}
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
              {patients.find((p) => p.id === editingId)?.name ?? 'patient'}
            </span>
            &mdash; changes will be saved on submit.
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

          <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
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
              {isEditing
                ? 'Edit the fields above and submit to save changes.'
                : 'Add new patients and keep your visit records in one place.'}
            </div>
            <button
              id="patient-submit-btn"
              type="submit"
              className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isEditing
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-zinc-950 hover:bg-zinc-800'
              }`}
              disabled={loading}
            >
              {loading
                ? isEditing
                  ? 'Updating...'
                  : 'Saving...'
                : isEditing
                  ? 'Update patient'
                  : 'Save patient'}
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        ) : null}
      </section>

      {/* ── Patient list ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <h3 className="mb-4 text-lg font-semibold text-zinc-950">Recent patients <span className="text-sm font-normal text-zinc-400">(last 10)</span></h3>

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
                    key={patient.id}
                    className={`transition ${
                      editingId === patient.id
                        ? 'bg-amber-50'
                        : 'hover:bg-zinc-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-zinc-950">{patient.name}</td>
                    <td className="px-4 py-3">
                      <div>{new Date(patient.visitAt).toLocaleDateString()}</div>
                      <div className="text-xs text-zinc-500">
                        {new Date(patient.visitAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">{patient.phone || '--'}</td>
                    <td className="px-4 py-3">{patient.diagnosis || '--'}</td>
                    <td className="px-4 py-3 text-right">
                      {editingId === patient.id ? (
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
