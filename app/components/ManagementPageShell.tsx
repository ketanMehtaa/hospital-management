import type { ReactNode } from 'react';

type ManagementPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function ManagementPageShell({
  eyebrow,
  title,
  description,
  children,
}: ManagementPageShellProps) {
  return (
    <main className="space-y-6 text-zinc-950">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm shadow-zinc-200/20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">{eyebrow}</p>
        <h2 className="mt-3 text-4xl font-semibold">{title}</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">{description}</p>
      </section>

      {children}
    </main>
  );
}
