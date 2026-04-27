import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ENDPOINT = process.env.MINIO_ENDPOINT ?? 'localhost';
const PORT = parseInt(process.env.MINIO_PORT ?? '9000', 10);
const USE_SSL = process.env.MINIO_USE_SSL === 'true';
const ACCESS_KEY = process.env.MINIO_ROOT_USER ?? 'minioadmin';
const SECRET_KEY = process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin';
export const BUCKET = process.env.MINIO_BUCKET ?? 'patient-media';

// Singleton S3 client (compatible with MinIO)
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: `${USE_SSL ? 'https' : 'http'}://${ENDPOINT}:${PORT}`,
      region: 'us-east-1', // MinIO ignores region but SDK requires it
      credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return _client;
}

/** Create the bucket if it doesn't exist yet. Called on first upload. */
export async function ensureBucketExists(): Promise<void> {
  const client = getClient();
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/** Upload a file buffer/stream to MinIO */
export async function uploadToMinio(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await ensureBucketExists();
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Generate a presigned GET URL (default 1 hour expiry) */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

/** Delete an object from MinIO */
export async function deleteFromMinio(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Fetch object metadata + streamable body — used by the proxy route */
export async function getObjectResponse(key: string) {
  const client = getClient();
  return client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}
