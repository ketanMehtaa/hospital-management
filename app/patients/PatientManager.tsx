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

export default function PatientManager() {
  const [patients, setPatients] = useState<PatientPayload[]>([]);
  const [form, setForm] = useState<FormState>(() => createInitialFormState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/patients', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load patients.');
      }
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

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePhoneChange = (value: string) => {
    const normalizedPhone = value.replace(/\D/g, '').slice(0, 10);
    handleChange('phone', normalizedPhone);
  };

  const handleAgeChange = (value: string) => {
    if (!value) {
      handleChange('age', '');
      return;
    }

    const numericAge = Number(value);
    if (Number.isNaN(numericAge)) {
      return;
    }

    const clampedAge = Math.min(110, Math.max(0, Math.trunc(numericAge)));
    handleChange('age', String(clampedAge));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (form.phone.length !== 10) {
        throw new Error('Phone number must be exactly 10 digits.');
      }

      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((() => {
          const resolvedVisitTime = form.visitTime || getCurrentTimeInput();
          const visitAt = new Date(`${form.visitDate}T${resolvedVisitTime}:00`).toISOString();
          return {
            ...form,
            age: form.age ? Number(form.age) : undefined,
            visitAt,
          };
        })()),
      });

      const isJsonResponse = response.headers.get('content-type')?.includes('application/json');
      const result = isJsonResponse ? ((await response.json()) as PatientPayload | { error?: string }) : null;
      if (!response.ok) {
        const message = result && 'error' in result ? result.error : undefined;
        throw new Error(message || `Could not create patient. (HTTP ${response.status})`);
      }

      const createdPatient =
        result && typeof result === 'object' && 'id' in result && 'name' in result ? (result as PatientPayload) : null;

      if (!createdPatient) {
        throw new Error('Server returned an invalid response while saving the patient.');
      }

      setPatients((current) => [createdPatient, ...current]);
      setForm(createInitialFormState());
      setSuccess('Patient saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const patientCount = useMemo(() => patients.length, [patients]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Patients</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Patient registry</h2>
          </div>
          <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-700">
            {patientCount} saved patient{patientCount === 1 ? '' : 's'}
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="space-y-2 text-sm text-zinc-700">
            Name*
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Age*
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              type="number"
              min="0"
              max="110"
              step="1"
              value={form.age}
              onChange={(event) => handleAgeChange(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Gender*
            <select
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={form.gender}
              onChange={(event) => handleChange('gender', event.target.value)}
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
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              type="tel"
              inputMode="numeric"
              minLength={10}
              maxLength={10}
              pattern="\d{10}"
              value={form.phone}
              onChange={(event) => handlePhoneChange(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Visit date*
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              type="date"
              value={form.visitDate}
              onChange={(event) => handleChange('visitDate', event.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Visit time
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              type="time"
              value={form.visitTime}
              onChange={(event) => handleChange('visitTime', event.target.value)}
              required
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
            Address
            <textarea
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              rows={3}
              value={form.address}
              onChange={(event) => handleChange('address', event.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            Diagnosis
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={form.diagnosis}
              onChange={(event) => handleChange('diagnosis', event.target.value)}
            />
          </label>

          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600">Add new patients and keep your visit records in one place.</div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save patient'}
            </button>
          </div>
        </form>

        {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {success ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm shadow-zinc-200/20">
        <h3 className="mb-4 text-lg font-semibold text-zinc-950">Recent patients</h3>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-semibold text-zinc-950">{patient.name}</td>
                    <td className="px-4 py-3">
                      <div>{new Date(patient.visitAt).toLocaleDateString()}</div>
                      <div className="text-xs text-zinc-500">
                        {new Date(patient.visitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">{patient.phone || '--'}</td>
                    <td className="px-4 py-3">{patient.diagnosis || '--'}</td>
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
