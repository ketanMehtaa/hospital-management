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
    <header className="sticky top-0 z-50 rounded-b-3xl border border-t-0 border-zinc-200 bg-white/80 px-4 py-3 shadow-sm shadow-zinc-200/20 backdrop-blur-md sm:px-5 sm:py-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500">Hospital Management</p>
        </div>

        <nav aria-label="Primary" className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
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
