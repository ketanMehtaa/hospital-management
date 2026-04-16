import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center gap-10 rounded-[2rem] border border-zinc-200 bg-white p-10 shadow-lg shadow-zinc-200/20">
        <div className="flex flex-col items-center gap-6 text-center">
          <Image className="invert" src="/next.svg" alt="Next.js logo" width={100} height={20} priority />
          <div>
            <h1 className="text-4xl font-semibold text-zinc-950">Hospital management dashboard</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
              A starting point for patient registration, billing, and inventory. Use the Patients page to add and manage
              patient records.
            </p>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Link
            href="/patients"
            className="rounded-2xl bg-zinc-950 px-6 py-5 text-center text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Open Patients management
          </Link>
          <Link
            href="/medicines"
            className="rounded-2xl border border-zinc-200 px-6 py-5 text-center text-sm font-semibold text-zinc-950 transition hover:border-zinc-400"
          >
            Open Medicines inventory
          </Link>
        </div>
      </main>
    </div>
  );
}
