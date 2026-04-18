'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/patients', label: 'Patients' },
  { href: '/medicines', label: 'Medicines' },
  { href: '/bills', label: 'Bills' },
];

export default function AppHeader() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/patients') {
      return pathname === '/' || pathname.startsWith('/patients');
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-200/20 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Hospital Management</p>
          <h1 className="mt-1 text-lg font-semibold text-zinc-950 sm:text-xl">Dashboard</h1>
        </div>

        <nav aria-label="Primary" className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
