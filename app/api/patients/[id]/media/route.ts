import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';
import { deleteFromMinio, uploadToMinio } from '@/app/lib/minio';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

/* ------------------------------------------------------------------ */
/*  GET /api/patients/[id]/media                                        */
/*  Returns raw DB records. Media is served via /api/media/proxy        */
/* ------------------------------------------------------------------ */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const records = await prisma.patientMedia.findMany({
      where: { patientId: id },
      orderBy: { capturedAt: 'desc' },
    });

    return NextResponse.json(records);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch media.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/patients/[id]/media                                       */
/*  Accepts multipart/form-data: file, capturedAt, description          */
/* ------------------------------------------------------------------ */

/** 500 MB — keep in sync with the client-side MAX_FILE_BYTES constant */
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ── Size guard: check before parsing the body ────────────────────
    // Without this, an oversized request causes Next.js to throw the
    // unhelpful "Failed to parse body as FormData" error.
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum upload size is 500 MB.' },
        { status: 413 },
      );
    }

    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const capturedAt = form.get('capturedAt') as string | null;
    const description = (form.get('description') as string | null) ?? undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!capturedAt) {
      return NextResponse.json({ error: 'capturedAt is required' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const mediaType = mimeType.startsWith('video/') ? 'Video' : 'Photo';
    // Flatten the key: uuid prefix prevents collisions without adding an extra folder level.
    // Result in MinIO: patient-media / patients/{id} / {uuid}-{filename}
    const safeFilename = file.name.replace(/[^\w.\-]/g, '_'); // sanitize spaces etc.
    const objectKey = `patients/${id}/${randomUUID()}-${safeFilename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToMinio(objectKey, buffer, mimeType);

    const record = await prisma.patientMedia.create({
      data: {
        patientId: id,
        objectKey,
        filename: file.name,
        mimeType,
        sizeBytes: buffer.byteLength,
        mediaType: mediaType as 'Photo' | 'Video',
        capturedAt: new Date(capturedAt),
        description,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload media.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
