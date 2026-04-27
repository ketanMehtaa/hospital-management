import { PrismaPg } from '@prisma/adapter-pg';
import { NextRequest, NextResponse } from 'next/server';

import { PrismaClient } from '@/app/generated/prisma/client';
import { deleteFromMinio } from '@/app/lib/minio';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined in the environment.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/patients/[id]/media/[mediaId]                           */
/* ------------------------------------------------------------------ */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const { id, mediaId } = await params;

    const record = await prisma.patientMedia.findUnique({
      where: { id: mediaId },
    });

    if (!record || record.patientId !== id) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    await deleteFromMinio(record.objectKey);
    await prisma.patientMedia.delete({ where: { id: mediaId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete media.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
