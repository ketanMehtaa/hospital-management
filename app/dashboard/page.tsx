'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = {
  from: string;
  to: string;
  totalRevenue: number;
  totalCash: number;
  totalOnline: number;
  totalDiscount: number;
  billCount: number;
  patientCount: number;
  categories: { category: string; revenue: number }[];
  topMedicines: { name: string; qty: number; revenue: number }[];
  daily: { date: string; revenue: number; cash: number; online: number; bills: number }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const CATEGORY_COLORS: Record<string, string> = {
  OpdConsultation: '#6366f1',
  Medicine: '#10b981',
  Endoscopy: '#f59e0b',
  Procedure: '#8b5cf6',
  HearingTest: '#06b6d4',
  Radiology: '#f43f5e',
  Pathology: '#84cc16',
};
const colorFor = (cat: string, i: number) =>
  CATEGORY_COLORS[cat] ?? `hsl(${(i * 47) % 360},70%,55%)`;

// ─── PIN screen ───────────────────────────────────────────────────────────────

function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const inputs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleDigit = (idx: number, val: string) => {
    const digit = val.replace(/\D/, '').slice(-1);
    const next = pin.slice(0, idx) + digit + pin.slice(idx + 1);
    setPin(next);
    setError('');
    if (digit && idx < 3) inputs[idx + 1].current?.focus();
    if (next.length === 4) verify(next);
  };

  const handleKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const next = pin.slice(0, idx) + '' + pin.slice(idx + 1);
      setPin(next);
      if (idx > 0) inputs[idx - 1].current?.focus();
    }
  };

  const verify = async (p: string) => {
    const res = await fetch(`/api/dashboard/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: p }),
    });
    if (res.ok) {
      onUnlock();
    } else {
      setError('Incorrect PIN');
      setShake(true);
      setPin('');
      inputs[0].current?.focus();
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
      <div className="text-center">
        <div className="mb-3 inline-flex size-14 items-center justify-center rounded-2xl bg-zinc-950">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="white"
            className="size-7"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-zinc-950">Dashboard</h2>
        <p className="mt-1 text-sm text-zinc-500">Enter your 4-digit PIN to continue</p>
      </div>

      <div className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={inputs[i]}
            id={`pin-digit-${i}`}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={pin[i] ?? ''}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onFocus={(e) => e.target.select()}
            className="size-14 rounded-2xl border border-zinc-200 bg-white text-center text-xl font-semibold text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            autoFocus={i === 0}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .animate-shake{animation:shake 0.45s ease-in-out;}
      `}</style>
    </div>
  );
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawBar(
  canvas: HTMLCanvasElement,
  data: Record<string, unknown>[],
  labelKey: string,
  valueKey: string,
  colorFn: (item: Record<string, unknown>, i: number) => string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  if (W === 0 || H === 0) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);
  const pL = 60;
  const pR = 16;
  const pT = 20;
  const pB = 48;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const barW = Math.min(48, (cW / data.length) * 0.55);
  const gap = cW / data.length;

  // Gridlines + y-axis labels
  for (let i = 0; i <= 4; i++) {
    const y = pT + cH - (cH * i) / 4;
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pL, y);
    ctx.lineTo(W - pR, y);
    ctx.stroke();
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(fmt((max * i) / 4).split('.')[0], pL - 6, y + 4);
  }

  data.forEach((d, i) => {
    const val = Number(d[valueKey]);
    const barH = (val / max) * cH;
    const x = pL + i * gap + (gap - barW) / 2;
    const y = pT + cH - barH;
    ctx.fillStyle = colorFn(d, i);
    ctx.beginPath();
    ctx.roundRect(x, y, barW, Math.max(barH, 2), 5);
    ctx.fill();
    const label = String(d[labelKey])
      .replace(/([A-Z])/g, ' $1')
      .trim();
    const short = label.length > 9 ? label.slice(0, 8) + '…' : label;
    ctx.fillStyle = '#71717a';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(short, x + barW / 2, H - pB + 16);
  });
}

function drawLine(
  canvas: HTMLCanvasElement,
  data: { date: string; revenue: number; cash: number; online: number }[],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  if (W === 0 || H === 0) return;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const maxV = Math.max(...data.map((d) => d.revenue), 1);
  const pL = 62;
  const pR = 16;
  const pT = 20;
  const pB = 48;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = pT + cH - (cH * i) / 4;
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pL, y);
    ctx.lineTo(W - pR, y);
    ctx.stroke();
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(fmt((maxV * i) / 4).split('.')[0], pL - 6, y + 4);
  }

  const series: { key: 'revenue' | 'cash' | 'online'; color: string }[] = [
    { key: 'revenue', color: '#6366f1' },
    { key: 'cash', color: '#10b981' },
    { key: 'online', color: '#3b82f6' },
  ];

  series.forEach(({ key, color }) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    data.forEach((d, i) => {
      const x = pL + (i / Math.max(data.length - 1, 1)) * cW;
      const y = pT + cH - (d[key] / maxV) * cH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    data.forEach((d, i) => {
      const x = pL + (i / Math.max(data.length - 1, 1)) * cW;
      const y = pT + cH - (d[key] / maxV) * cH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  });

  // X labels
  data.forEach((d, i) => {
    if (data.length <= 10 || i % Math.ceil(data.length / 8) === 0) {
      const x = pL + (i / Math.max(data.length - 1, 1)) * cW;
      ctx.fillStyle = '#71717a';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.date.slice(5), x, H - pB + 16);
    }
  });
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({
  data,
  labelKey,
  valueKey,
  colorFn,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  colorFn: (item: Record<string, unknown>, i: number) => string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!wrapRef.current || !canvasRef.current || data.length === 0) return;
    const canvas = canvasRef.current;
    const ro = new ResizeObserver(() => drawBar(canvas, data, labelKey, valueKey, colorFn));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [data, labelKey, valueKey, colorFn]);

  return (
    <div ref={wrapRef} className="h-64 w-full">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ─── Line chart ───────────────────────────────────────────────────────────────

function LineChart({
  data,
}: {
  data: { date: string; revenue: number; cash: number; online: number }[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!wrapRef.current || !canvasRef.current || data.length === 0) return;
    const canvas = canvasRef.current;
    const ro = new ResizeObserver(() => drawLine(canvas, data));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [data]);

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="h-72 w-full">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="flex flex-wrap gap-5 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 rounded bg-indigo-500" />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 rounded bg-emerald-500" />
          Cash
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 rounded bg-blue-500" />
          Online
        </span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  color = 'zinc',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const bg: Record<string, string> = {
    zinc: 'bg-zinc-50 border-zinc-200',
    green: 'bg-emerald-50 border-emerald-100',
    blue: 'bg-blue-50 border-blue-100',
    violet: 'bg-violet-50 border-violet-100',
    amber: 'bg-amber-50 border-amber-100',
  };
  const text: Record<string, string> = {
    zinc: 'text-zinc-950',
    green: 'text-emerald-800',
    blue: 'text-blue-800',
    violet: 'text-violet-800',
    amber: 'text-amber-800',
  };
  return (
    <div className={`rounded-2xl border p-4 ${bg[color] ?? bg.zinc}`}>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${text[color] ?? text.zinc}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [mode, setMode] = useState<'today' | 'range'>('today');

  const inputCls =
    'rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

  const fetchData = async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?from=${f}&to=${t}`);
      if (!res.ok) throw new Error('Failed to load dashboard data.');
      setData((await res.json()) as DashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unlocked) {
      const f = mode === 'today' ? today() : from;
      const t = mode === 'today' ? today() : to;
      void fetchData(f, t);
    }
  }, [unlocked, mode]); // eslint-disable-line

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

  const handleApply = () => fetchData(from, to);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Analytics
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950">Dashboard</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('today')}
              className={`rounded-xl px-4 py-1.5 transition ${mode === 'today' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              className={`rounded-xl px-4 py-1.5 transition ${mode === 'range' ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:text-zinc-950'}`}
            >
              Date range
            </button>
          </div>

          {mode === 'range' && (
            <>
              <input
                id="dash-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className={inputCls}
              />
              <span className="text-zinc-400">–</span>
              <input
                id="dash-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                onClick={handleApply}
                className="rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          Loading…
        </div>
      )}
      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* ── KPI cards ─────────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total revenue" value={`Rs. ${fmt(data.totalRevenue)}`} color="zinc" />
            <Stat
              label="Cash collected"
              value={`Rs. ${fmt(data.totalCash)}`}
              sub={`${data.totalRevenue > 0 ? ((data.totalCash / data.totalRevenue) * 100).toFixed(1) : 0}% of total`}
              color="green"
            />
            <Stat
              label="Online collected"
              value={`Rs. ${fmt(data.totalOnline)}`}
              sub={`${data.totalRevenue > 0 ? ((data.totalOnline / data.totalRevenue) * 100).toFixed(1) : 0}% of total`}
              color="blue"
            />
            <Stat label="Discounts given" value={`Rs. ${fmt(data.totalDiscount)}`} color="amber" />
            <Stat label="Bills generated" value={String(data.billCount)} color="violet" />
            <Stat label="New patients" value={String(data.patientCount)} color="zinc" />
            <Stat
              label="Avg bill value"
              value={data.billCount > 0 ? `Rs. ${fmt(data.totalRevenue / data.billCount)}` : '—'}
              color="zinc"
            />
            <Stat
              label="Period"
              value={data.from === data.to ? data.from : `${data.from} → ${data.to}`}
              color="zinc"
            />
          </div>

          {/* ── Revenue trend ──────────────────────────────────────────── */}
          {data.daily.length > 0 && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-zinc-950">
                Revenue trend
                <span className="ml-2 text-xs font-normal text-zinc-400">Rs. / day</span>
              </h3>
              <LineChart data={data.daily} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ── Revenue by category ───────────────────────────────────── */}
            {data.categories.length > 0 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-zinc-950">Revenue by category</h3>
                <BarChart
                  data={data.categories as unknown as Record<string, unknown>[]}
                  labelKey="category"
                  valueKey="revenue"
                  colorFn={(d, i) => colorFor(String(d['category']), i)}
                />
                {/* Legend */}
                <div className="mt-4 space-y-2">
                  {data.categories.map((c, i) => (
                    <div key={c.category} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: colorFor(c.category, i) }}
                        />
                        <span className="text-zinc-700">
                          {c.category.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </div>
                      <span className="font-medium text-zinc-950">Rs. {fmt(c.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Top medicines ─────────────────────────────────────────── */}
            {data.topMedicines.length > 0 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-zinc-950">Top medicines sold</h3>
                <div className="space-y-3">
                  {data.topMedicines.map((m, i) => {
                    const pct = data.totalRevenue > 0 ? (m.revenue / data.totalRevenue) * 100 : 0;
                    return (
                      <div key={m.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                              {i + 1}
                            </span>
                            <span className="text-zinc-800 font-medium">{m.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-zinc-950">
                              Rs. {fmt(m.revenue)}
                            </span>
                            <span className="ml-2 text-xs text-zinc-400">× {m.qty}</span>
                          </div>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Daily detail table ─────────────────────────────────────── */}
          {data.daily.length > 1 && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-zinc-950">Daily breakdown</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                  <thead>
                    <tr>
                      {['Date', 'Bills', 'Cash', 'Online', 'Revenue'].map((h) => (
                        <th key={h} className="px-4 py-2 font-medium text-zinc-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.daily.map((d) => (
                      <tr key={d.date} className="hover:bg-zinc-50 transition">
                        <td className="px-4 py-2 font-medium text-zinc-950">{d.date}</td>
                        <td className="px-4 py-2 text-zinc-600">{d.bills}</td>
                        <td className="px-4 py-2 text-emerald-700">Rs. {fmt(d.cash)}</td>
                        <td className="px-4 py-2 text-blue-700">Rs. {fmt(d.online)}</td>
                        <td className="px-4 py-2 font-semibold text-zinc-950">
                          Rs. {fmt(d.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.billCount === 0 && (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
              No bills found for this period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
