import MedicineManager from './MedicineManager';

export default function MedicinesPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm shadow-zinc-200/20">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Medicine inventory</p>
          <h1 className="mt-3 text-4xl font-semibold">Inventory</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            Manage medicine stock, pricing, batches, and expiry details from one dashboard.
          </p>
        </div>
        <MedicineManager />
      </div>
    </main>
  );
}
