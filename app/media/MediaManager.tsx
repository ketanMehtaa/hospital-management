'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface Patient {
  id: string;
  name: string;
  phone?: string | null;
}

interface MediaRecord {
  id: string;
  patientId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: 'Photo' | 'Video';
  capturedAt: string;
  description?: string | null;
  objectKey: string; // used to construct the proxy URL
}

interface UploadFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  File-type helpers                                                   */
/* ------------------------------------------------------------------ */

/** Build a URL that streams the file through Next.js (no CORS, no Docker hostname issues) */
function proxyUrl(objectKey: string) {
  return `/api/media/proxy?key=${encodeURIComponent(objectKey)}`;
}

/** HEIC/HEIF — saved by iPhone when "Most Compatible" is OFF */
function isHeic(mime: string) {
  return mime === 'image/heic' || mime === 'image/heif';
}

/** MOV — default iPhone/iPad video container. Chrome/Firefox can't play it. */
function isMov(mime: string) {
  return mime === 'video/quicktime';
}

/** Returns true when the browser can render the file inline */
function isBrowserViewable(mime: string) {
  if (isHeic(mime)) return false;
  // MOV only works in Safari
  if (isMov(mime))
    return (
      typeof navigator !== 'undefined' &&
      /Safari/.test(navigator.userAgent) &&
      !/Chrome/.test(navigator.userAgent)
    );
  return true;
}

/* ------------------------------------------------------------------ */
/*  Misc helpers                                                        */
/* ------------------------------------------------------------------ */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 500 MB hard limit — matches the server-side guard in the POST route */
const MAX_FILE_BYTES = 500 * 1024 * 1024;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mimeLabel(mime: string) {
  if (isHeic(mime)) return 'HEIC';
  if (isMov(mime)) return 'MOV';
  const ext = mime.split('/')[1]?.toUpperCase();
  return ext ?? mime;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

/** Shown when the browser can't render the file (HEIC, some MOV etc.) */
function UnsupportedPreview({ record }: { record: MediaRecord }) {
  return (
    <div className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-zinc-100 px-3 text-center">
      <span className="text-2xl">📄</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {mimeLabel(record.mimeType)}
      </span>
      <span className="text-[10px] text-zinc-400">Preview not available</span>
    </div>
  );
}

/** Fallback <img> that swaps to UnsupportedPreview on load error */
function SafeImage({ record }: { record: MediaRecord }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <UnsupportedPreview record={record} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxyUrl(record.objectKey)}
      alt={record.description ?? record.filename}
      className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  MediaManager                                                        */
/* ------------------------------------------------------------------ */
export default function MediaManager() {
  /* ---- Patients ---- */
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);

  /* ---- Upload form ---- */
  const [uploadPatientId, setUploadPatientId] = useState('');
  const [capturedAt, setCapturedAt] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Gallery ---- */
  const [galleryPatientId, setGalleryPatientId] = useState('');
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [lightbox, setLightbox] = useState<MediaRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxImgFailed, setLightboxImgFailed] = useState(false);

  /* ---- Load patients ---- */
  useEffect(() => {
    fetch('/api/patients')
      .then((r) => r.json())
      .then((data: Patient[]) => setPatients(data))
      .catch(() => {})
      .finally(() => setPatientsLoading(false));
  }, []);

  /* ---- Load media when gallery patient changes ---- */
  const loadMedia = useCallback(async (patientId: string) => {
    if (!patientId) {
      setMedia([]);
      return;
    }
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/media`);
      const data: MediaRecord[] = await res.json();
      setMedia(Array.isArray(data) ? data : []);
    } catch {
      setMedia([]);
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedia(galleryPatientId);
  }, [galleryPatientId, loadMedia]);

  // Reset lightbox-level error state when the file changes
  useEffect(() => {
    setLightboxImgFailed(false);
  }, [lightbox?.id]);

  /* ---- File selection ---- */
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).map<UploadFile>((f) => {
      const tooBig = f.size > MAX_FILE_BYTES;
      return {
        file: f,
        status: tooBig ? 'error' : 'pending',
        error: tooBig ? `Too large (${formatBytes(f.size)} · max 500 MB)` : undefined,
      };
    });
    setUploadFiles((prev) => [...prev, ...arr]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  /* ---- Upload ---- */
  const uploadAll = async () => {
    if (!uploadPatientId) return;
    if (!uploadFiles.some((f) => f.status === 'pending')) return;

    for (let i = 0; i < uploadFiles.length; i++) {
      if (uploadFiles[i].status !== 'pending') continue;

      setUploadFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f)),
      );

      const fd = new FormData();
      fd.append('file', uploadFiles[i].file);
      fd.append('capturedAt', capturedAt);
      fd.append('description', description);

      try {
        const res = await fetch(`/api/patients/${uploadPatientId}/media`, {
          method: 'POST',
          body: fd,
        });

        if (!res.ok) {
          const err = await res.json();
          setUploadFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: 'error', error: err.error ?? 'Upload failed' } : f,
            ),
          );
        } else {
          setUploadFiles((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: 'done' } : f)),
          );
        }
      } catch {
        setUploadFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: 'Network error' } : f)),
        );
      }
    }

    if (galleryPatientId === uploadPatientId) loadMedia(galleryPatientId);
  };

  const clearDone = () => setUploadFiles((prev) => prev.filter((f) => f.status !== 'done'));

  /* ---- Delete ---- */
  const handleDelete = async (record: MediaRecord) => {
    setDeleting(true);
    try {
      await fetch(`/api/patients/${record.patientId}/media/${record.id}`, {
        method: 'DELETE',
      });
      setMedia((prev) => prev.filter((m) => m.id !== record.id));
      if (lightbox?.id === record.id) setLightbox(null);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  /* ---- Render thumbnail in gallery card ---- */
  const renderThumbnail = (m: MediaRecord) => {
    if (!isBrowserViewable(m.mimeType)) {
      return <UnsupportedPreview record={m} />;
    }
    if (m.mediaType === 'Video') {
      return (
        <div className="relative h-40 w-full bg-zinc-900">
          <video
            src={proxyUrl(m.objectKey)}
            className="h-full w-full object-cover opacity-70"
            muted
            preload="metadata"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5 text-zinc-800"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </div>
      );
    }
    return <SafeImage record={m} />;
  };

  /* ---- Render lightbox content ---- */
  const renderLightboxMedia = (m: MediaRecord) => {
    const src = proxyUrl(m.objectKey);
    const downloadLink = (
      <a
        href={src}
        download={m.filename}
        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 transition"
      >
        ⬇ Download {m.filename}
      </a>
    );

    if (isHeic(m.mimeType)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 bg-zinc-100 py-16 rounded-t-2xl">
          <span className="text-4xl">📷</span>
          <p className="text-sm font-medium text-zinc-700">HEIC format — not viewable in browser</p>
          <p className="text-xs text-zinc-500 max-w-xs text-center">
            iPhone photos saved in HEIC format cannot be displayed in web browsers. Download the
            file and open it with Photos, Preview, or convert it to JPEG.
          </p>
          {downloadLink}
        </div>
      );
    }

    if (m.mediaType === 'Video') {
      return (
        <>
          <video
            key={m.id}
            src={src}
            controls
            autoPlay
            playsInline
            className="max-h-[70vh] w-full rounded-t-2xl bg-black"
            onError={(e) => {
              // Hide broken video element and show fallback
              (e.currentTarget as HTMLVideoElement).style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          {/* Fallback shown if browser can't decode (e.g. MOV on Chrome) */}
          <div
            style={{ display: 'none' }}
            className="flex-col items-center justify-center gap-3 bg-zinc-900 py-16 rounded-t-2xl"
          >
            <span className="text-4xl">🎬</span>
            <p className="text-sm font-medium text-white">
              {isMov(m.mimeType)
                ? 'MOV format — not supported in this browser'
                : 'Video cannot be played'}
            </p>
            <p className="text-xs text-zinc-400 max-w-xs text-center">
              {isMov(m.mimeType)
                ? 'MOV (QuickTime) videos require Safari or a video player app. Download to watch.'
                : 'Your browser cannot play this video format. Download the file to watch it.'}
            </p>
            <a
              href={src}
              download={m.filename}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition"
            >
              ⬇ Download {m.filename}
            </a>
          </div>
        </>
      );
    }

    // Photo — use SafeImage pattern but full-size
    if (lightboxImgFailed) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 bg-zinc-100 py-16 rounded-t-2xl">
          <span className="text-4xl">🖼</span>
          <p className="text-sm font-medium text-zinc-700">Image cannot be displayed</p>
          {downloadLink}
        </div>
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={m.description ?? m.filename}
        className="max-h-[70vh] w-full object-contain rounded-t-2xl"
        onError={() => setLightboxImgFailed(true)}
      />
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Patient Media</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload and view patient photos &amp; videos. Stored in MinIO.
        </p>
      </div>

      {/* ============================================================ */}
      {/* Upload Panel                                                  */}
      {/* ============================================================ */}
      <section
        className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
        aria-label="Upload media"
      >
        <div className="border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-800">Upload Files</h2>
          <span className="text-[10px] text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1">
            JPEG · PNG · HEIC · MP4 · MOV · WebM · and more
          </span>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          {/* Left — controls */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="upload-patient"
                className="block text-xs font-medium text-zinc-600 mb-1"
              >
                Patient
              </label>
              <select
                id="upload-patient"
                value={uploadPatientId}
                onChange={(e) => setUploadPatientId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">— Select patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.phone ? ` · ${p.phone}` : ''}
                  </option>
                ))}
              </select>
              {patientsLoading && <p className="mt-1 text-xs text-zinc-400">Loading patients…</p>}
            </div>

            <div>
              <label htmlFor="captured-at" className="block text-xs font-medium text-zinc-600 mb-1">
                Capture Date
              </label>
              <input
                id="captured-at"
                type="date"
                value={capturedAt}
                onChange={(e) => setCapturedAt(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>

            <div>
              <label
                htmlFor="media-description"
                className="block text-xs font-medium text-zinc-600 mb-1"
              >
                Description <span className="text-zinc-400">(optional)</span>
              </label>
              <textarea
                id="media-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Post-procedure endoscopy photos"
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
          </div>

          {/* Right — drop zone */}
          <div className="flex flex-col gap-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop zone for file upload"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 transition-colors ${
                dragging
                  ? 'border-zinc-600 bg-zinc-100'
                  : 'border-zinc-300 bg-zinc-50 hover:border-zinc-500 hover:bg-zinc-100'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-sm font-medium text-zinc-600">
                {dragging ? 'Drop to add' : 'Click or drop files here'}
              </p>
              <p className="text-xs text-zinc-400">Photos and videos · up to 500 MB each</p>
            </div>

            {/* Accept everything — HEIC, MOV, JPEG, MP4, WebM, PNG, AVIF etc. */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.heic,.heif,.mov"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            {/* File list */}
            {uploadFiles.length > 0 && (
              <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {uploadFiles.map((uf, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                  >
                    <span className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-800">{uf.file.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {formatBytes(uf.file.size)} · {uf.file.type || 'unknown type'}
                      </p>
                    </span>

                    {uf.status === 'uploading' && (
                      <span className="text-[10px] text-zinc-500 animate-pulse">uploading…</span>
                    )}
                    {uf.status === 'done' && (
                      <span className="text-[10px] font-semibold text-emerald-600">✓ done</span>
                    )}
                    {uf.status === 'error' && (
                      <span className="text-[10px] font-semibold text-red-500">{uf.error}</span>
                    )}
                    {uf.status === 'pending' && (
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFiles((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                        className="flex-shrink-0 text-zinc-400 hover:text-zinc-700 transition"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <button
                id="upload-submit-btn"
                type="button"
                disabled={
                  !uploadPatientId ||
                  !uploadFiles.some((f) => f.status === 'pending') ||
                  uploadFiles.some((f) => f.status === 'uploading')
                }
                onClick={uploadAll}
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploadFiles.some((f) => f.status === 'uploading')
                  ? 'Uploading…'
                  : `Upload${uploadFiles.filter((f) => f.status === 'pending').length ? ` ${uploadFiles.filter((f) => f.status === 'pending').length}` : ''} file${uploadFiles.filter((f) => f.status === 'pending').length !== 1 ? 's' : ''}`}
              </button>
              {uploadFiles.some((f) => f.status === 'done') && (
                <button
                  type="button"
                  onClick={clearDone}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition"
                >
                  Clear done
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* Gallery Panel                                                 */}
      {/* ============================================================ */}
      <section
        className="rounded-2xl border border-zinc-200 bg-white shadow-sm"
        aria-label="Media gallery"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-800">Gallery</h2>
          <div className="flex items-center gap-3">
            <label htmlFor="gallery-patient" className="text-xs font-medium text-zinc-500">
              Patient
            </label>
            <select
              id="gallery-patient"
              value={galleryPatientId}
              onChange={(e) => setGalleryPatientId(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="">— Select patient —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.phone ? ` · ${p.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6">
          {!galleryPatientId && (
            <p className="text-center text-sm text-zinc-400 py-12">
              Select a patient to view their media.
            </p>
          )}
          {galleryPatientId && mediaLoading && (
            <p className="text-center text-sm text-zinc-400 py-12 animate-pulse">Loading…</p>
          )}
          {galleryPatientId && !mediaLoading && media.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-12">
              No media found for this patient.
            </p>
          )}

          {!mediaLoading && media.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((m) => (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm transition hover:shadow-md"
                >
                  {/* Thumbnail */}
                  <button
                    type="button"
                    aria-label={`Preview ${m.filename}`}
                    onClick={() => setLightbox(m)}
                    className="block w-full"
                  >
                    {renderThumbnail(m)}
                  </button>

                  {/* Format badge */}
                  <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    {mimeLabel(m.mimeType)}
                  </span>

                  {/* Meta */}
                  <div className="px-3 py-2">
                    <p className="truncate text-xs font-medium text-zinc-800">{m.filename}</p>
                    <p className="text-[10px] text-zinc-500">
                      {formatDate(m.capturedAt)} · {formatBytes(m.sizeBytes)}
                    </p>
                    {m.description && (
                      <p className="mt-0.5 truncate text-[10px] italic text-zinc-400">
                        {m.description}
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    aria-label="Delete media"
                    onClick={() => setDeleteConfirm(m.id)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-zinc-600 opacity-0 shadow transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* Lightbox                                                      */}
      {/* ============================================================ */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${lightbox.filename}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl w-full overflow-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              id="lightbox-close-btn"
              aria-label="Close preview"
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/70 text-white hover:bg-zinc-900 transition"
            >
              ✕
            </button>

            {renderLightboxMedia(lightbox)}

            <div className="px-6 py-4 space-y-1">
              <p className="text-sm font-semibold text-zinc-900 pr-8">{lightbox.filename}</p>
              <p className="text-xs text-zinc-500 flex flex-wrap items-center gap-2">
                <span>{formatDate(lightbox.capturedAt)}</span>
                <span>·</span>
                <span>{formatBytes(lightbox.sizeBytes)}</span>
                <span>·</span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    lightbox.mediaType === 'Photo'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-violet-100 text-violet-700'
                  }`}
                >
                  {lightbox.mediaType}
                </span>
                <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                  {mimeLabel(lightbox.mimeType)}
                </span>
              </p>
              {lightbox.description && (
                <p className="text-sm text-zinc-600">{lightbox.description}</p>
              )}
              {/* Always show a download link */}
              <a
                href={proxyUrl(lightbox.objectKey)}
                download={lightbox.filename}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition pt-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Download original file
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Delete Confirmation Dialog                                    */}
      {/* ============================================================ */}
      {deleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">Delete this file?</h3>
            <p className="text-sm text-zinc-500">
              It will be permanently removed from both the gallery and storage. This cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                type="button"
                disabled={deleting}
                onClick={() => {
                  const record = media.find((m) => m.id === deleteConfirm);
                  if (record) handleDelete(record);
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
