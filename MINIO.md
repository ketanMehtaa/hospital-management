# MinIO — Patient Media Storage

> **Offline, self-hosted object storage for patient photos and videos.**  
> No cloud account required. All data stays on your own server.

---

## What is MinIO?

[MinIO](https://min.io/) is an open-source, S3-compatible object storage server you run yourself.
"S3-compatible" means the same AWS SDK code that talks to Amazon S3 talks to MinIO without changes — just a different endpoint URL.

We use it to store patient photos and videos, keeping all sensitive media on-premises.

---

## Why MinIO instead of saving files to disk?

| Requirement | Disk folder | MinIO |
|---|---|---|
| Survives container restarts | ✅ with volumes | ✅ with volumes |
| Scales to terabytes | ❌ single mount | ✅ |
| Built-in browser console | ❌ | ✅ (`localhost:9001`) |
| S3 SDK / presigned URLs | ❌ | ✅ |
| Works completely offline | ✅ | ✅ |
| Separates files from DB | ❌ | ✅ |

The database stores **metadata only** (filename, size, date, description, format).  
The actual bytes live in MinIO. This keeps the PostgreSQL database small and fast.

---

## Architecture

```
Browser
  │
  │  uploads via multipart POST
  ▼
Next.js  ──────────────────────────► MinIO  (port 9000, internal Docker network)
  │   (server-to-server, no CORS)      │
  │                                    │  stores /patient-media bucket
  │  serves via /api/media/proxy       │
  ◄───────────────────────────────────
  │
  │  streams file bytes back
  ▼
Browser  (renders <img> or <video>)
```

### Why the proxy route?

All media is served through **`/api/media/proxy?key=<objectKey>`** — the browser never talks to MinIO directly. This solves two problems:

1. **CORS** — MinIO rejects cross-origin requests from the browser by default.
2. **Docker hostname** — Inside the Docker network, MinIO is reachable at `http://minio:9000`. The browser has no DNS for `minio`, so direct URLs would break. The proxy runs on the Next.js server which *is* inside the network.

---

## Bucket & folder structure

```
patient-media/              ← bucket name (auto-created on first upload)
  └─ patients/
       └─ {patient-uuid}/   ← one folder per patient
            ├─ {uuid}-photo.jpg
            ├─ {uuid}-scan.png
            └─ {uuid}-endoscopy.mp4
```

### Why the `{uuid}-` prefix on filenames?

Object storage has **no folders** in the true sense — keys are just strings.
The `patients/{id}/` prefix acts as a virtual folder in the MinIO console.

The UUID prefix before each filename solves the **collision problem**: if a patient has two files both named `photo.jpg`, uploading the second would silently overwrite the first without the UUID. With `{uuid}-photo.jpg` both coexist safely.

> **Why not `{patient-id}/{uuid}/{filename}`?**  
> The original implementation used three levels (`{id}/{uuid}/{filename}`), which created a stub single-file subfolder for every upload — making the MinIO console hard to read. The flat `{id}/{uuid}-{filename}` achieves the same uniqueness guarantee with a cleaner two-level tree.

---

## File format compatibility

All file types are accepted for upload and stored as-is in MinIO. Browser display support varies:

| Format | Source | Upload | Browser Preview |
|---|---|---|---|
| JPEG | Any phone/camera | ✅ | ✅ All browsers |
| PNG | Screenshots, scans | ✅ | ✅ All browsers |
| WebP | Modern Android | ✅ | ✅ Chrome, Firefox, Safari |
| AVIF | Modern Android | ✅ | ✅ Chrome, Firefox |
| **HEIC / HEIF** | **iPhone (default)** | ✅ stored | ❌ No browser can display — download link shown |
| MP4 | All phones, cameras | ✅ | ✅ All browsers |
| **MOV** | **iPhone video** | ✅ stored | ⚠️ Safari only — download link shown on Chrome/Firefox |
| WebM | Android / screen capture | ✅ | ✅ Chrome, Firefox |

> **Tip for iPhone users:** Go to **Settings → Camera → Formats → Most Compatible**.
> This makes the camera save JPEG and MP4 instead of HEIC and MOV.
> Files will preview directly in the browser without needing a download.

---

## Docker setup

MinIO is defined as a service in `docker-compose.yml`:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
  ports:
    - "9000:9000"   # S3 API (used by the app)
    - "9001:9001"   # Web console (used by humans)
  volumes:
    - minio_data:/data
```

Start everything:

```bash
docker compose up -d
```

The Next.js app depends on MinIO being healthy before it starts.
The `patient-media` bucket is **created automatically** on the first file upload — no manual setup needed.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MINIO_ENDPOINT` | `localhost` | Hostname of MinIO (use `minio` when running via Docker Compose) |
| `MINIO_PORT` | `9000` | S3 API port |
| `MINIO_USE_SSL` | `false` | Set `true` if MinIO is behind HTTPS |
| `MINIO_ROOT_USER` | `minioadmin` | Access key (change in production!) |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | Secret key (change in production!) |
| `MINIO_BUCKET` | `patient-media` | Bucket name |

> ⚠️ **Change the root credentials before going to production.**
> Update them in your `.env` file — Docker Compose reads them automatically.

---

## MinIO Console walkthrough

1. Open **http://localhost:9001** in your browser
2. Log in with `minioadmin / minioadmin` (or your custom credentials)
3. Click **Object Browser** → **patient-media**
4. You'll see a `patients/` virtual folder → inside, one subfolder per patient ID
5. Click any file → **Preview** or **Download**

---

## Code structure

| File | Purpose |
|---|---|
| `app/lib/minio.ts` | Singleton S3 client — upload, delete, stream |
| `app/api/media/proxy/route.ts` | Streams files from MinIO to the browser |
| `app/api/patients/[id]/media/route.ts` | GET (list) · POST (upload) |
| `app/api/patients/[id]/media/[mediaId]/route.ts` | DELETE |
| `app/media/MediaManager.tsx` | Upload panel + photo/video gallery UI |
| `prisma/schema.prisma` | `PatientMedia` model + `MediaType` enum |

---

## Backup & recovery

MinIO data lives in the `hospital_minio_data` Docker volume.

```bash
# Backup (Windows — PowerShell)
docker run --rm `
  -v hospital_minio_data:/data `
  -v ${PWD}/backups:/backup `
  alpine tar czf /backup/minio-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm `
  -v hospital_minio_data:/data `
  -v ${PWD}/backups:/backup `
  alpine tar xzf /backup/minio-20260427.tar.gz -C /data
```

Or use the MinIO Client (`mc`) to mirror the bucket:

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mirror local/patient-media ./backups/patient-media/
```
