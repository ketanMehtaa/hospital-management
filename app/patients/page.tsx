import PatientManager from './PatientManager';

export default function PatientsPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm shadow-zinc-200/20 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            Patient management
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Patients</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Add new patients, store visit details, and review recent patient records from a single interface.
          </p>
        </div>
        <PatientManager />
      </div>
    </main>
  );
}
