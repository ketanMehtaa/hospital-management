import { NextRequest } from 'next/server';

import { getObjectResponse } from '@/app/lib/minio';

/**
 * GET /api/media/proxy?key=<encoded-object-key>
 *
 * Streams an object from MinIO through the Next.js server.
 * This avoids the browser ever talking directly to MinIO, which eliminates:
 *   - CORS issues (MinIO blocks cross-origin requests by default)
 *   - Docker hostname problems (MinIO is `minio:9000` inside Docker,
 *     but the browser cannot resolve that hostname)
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return new Response('Missing key parameter', { status: 400 });
  }

  try {
    const result = await getObjectResponse(key);

    if (!result.Body) {
      return new Response('Object not found', { status: 404 });
    }

    const contentType = result.ContentType ?? 'application/octet-stream';
    const contentLength = result.ContentLength;

    // AWS SDK v3 returns a SdkStream — call transformToWebStream() to get a
    // Web-standard ReadableStream that Next.js Response can consume directly.
    const webStream = result.Body.transformToWebStream();

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      // Cache in the browser for 1 hour to avoid hammering the proxy
      'Cache-Control': 'private, max-age=3600',
      // Allow <video> range requests (seek / scrub)
      'Accept-Ranges': 'bytes',
    };

    if (contentLength !== undefined) {
      headers['Content-Length'] = String(contentLength);
    }

    // Suggest a filename for the browser's save-as dialog
    const filename = key.split('/').pop() ?? 'download';
    headers['Content-Disposition'] = `inline; filename="${filename}"`;

    return new Response(webStream, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return new Response(message, { status: 500 });
  }
}
