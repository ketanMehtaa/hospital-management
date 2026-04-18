import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { pin } = (await request.json()) as { pin?: string };

  const correctPin = process.env.DASHBOARD_PIN ?? '0000';

  if (!pin || pin !== correctPin) {
    return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
