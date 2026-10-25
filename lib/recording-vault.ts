import type { SlideMark } from './live-recording';

// A copy of an in-progress lecture recording kept in the browser (IndexedDB),
// so a crash, a closed tab or a dead battery loses neither the last minutes
// that were not yet sent for transcription nor the downloadable audio:
// - "tail": 16 kHz PCM of the segment still being recorded;
// - "segment": finished WAV segments not yet uploaded;
// - "media": the compressed whole-lesson copy offered for download.
// Nothing here leaves the device unless the teacher recovers it.

export type VaultMeta = {
  recordingId: string;
  userId: string;
  sessionId: string;
  title: string;
  language: 'zh-TW' | 'en';
  startedAt: number;
  /** Where the unsent tail starts in the lesson, in seconds. */
  tailStartSeconds: number;
  /** The index the tail becomes when it is sent. */
  nextIdx: number;
  /** Lesson length as of the last save, in seconds. */
  elapsedSeconds: number;
  marks: SlideMark[];
  /** Stopped normally; only the download copy is left. */
  finished: boolean;
};

export type VaultSegment = { idx: number; startSeconds: number; durationSeconds: number; blob: Blob };

export interface RecordingVault {
  putMeta(meta: VaultMeta): Promise<void>;
  listMeta(): Promise<VaultMeta[]>;
  appendTail(recordingId: string, samples: Int16Array): Promise<void>;
  readTail(recordingId: string): Promise<Int16Array>;
  clearTail(recordingId: string): Promise<void>;
  putSegment(recordingId: string, segment: VaultSegment): Promise<void>;
  listSegments(recordingId: string): Promise<VaultSegment[]>;
  deleteSegment(recordingId: string, idx: number): Promise<void>;
  appendMedia(recordingId: string, chunk: Blob): Promise<void>;
  readMedia(recordingId: string): Promise<Blob[]>;
  remove(recordingId: string): Promise<void>;
}

type Chunk =
  | { recordingId: string; kind: 'tail'; samples: Int16Array }
  | { recordingId: string; kind: 'segment'; segment: VaultSegment }
  | { recordingId: string; kind: 'media'; blob: Blob };

/** Joins the stored tail pieces in order. */
function joinInt16(parts: Int16Array[]): Int16Array {
  const out = new Int16Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    out[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  return out;
}

export function int16ToFloat(samples: Int16Array): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] / (samples[i] < 0 ? 0x8000 : 0x7fff);
  return out;
}

// Same behaviour as the IndexedDB vault, for tests and for browsers without it.
export function memoryVault(): RecordingVault {
  const metas = new Map<string, VaultMeta>();
  let chunks: Chunk[] = [];
  const of = (id: string) => chunks.filter((chunk) => chunk.recordingId === id);
  return {
    async putMeta(meta) { metas.set(meta.recordingId, { ...meta, marks: [...meta.marks] }); },
    async listMeta() { return Array.from(metas.values()); },
    async appendTail(recordingId, samples) { chunks.push({ recordingId, kind: 'tail', samples }); },
    async readTail(id) { return joinInt16(of(id).flatMap((chunk) => (chunk.kind === 'tail' ? [chunk.samples] : []))); },
    async clearTail(id) { chunks = chunks.filter((chunk) => !(chunk.recordingId === id && chunk.kind === 'tail')); },
    async putSegment(recordingId, segment) {
      chunks = chunks.filter((chunk) => !(chunk.recordingId === recordingId && chunk.kind === 'segment' && chunk.segment.idx === segment.idx));
      chunks.push({ recordingId, kind: 'segment', segment });
    },
    async listSegments(id) { return of(id).flatMap((chunk) => (chunk.kind === 'segment' ? [chunk.segment] : [])).sort((a, b) => a.idx - b.idx); },
    async deleteSegment(id, idx) { chunks = chunks.filter((chunk) => !(chunk.recordingId === id && chunk.kind === 'segment' && chunk.segment.idx === idx)); },
    async appendMedia(recordingId, blob) { chunks.push({ recordingId, kind: 'media', blob }); },
    async readMedia(id) { return of(id).flatMap((chunk) => (chunk.kind === 'media' ? [chunk.blob] : [])); },
    async remove(id) { metas.delete(id); chunks = chunks.filter((chunk) => chunk.recordingId !== id); },
  };
}

const DB_NAME = 'mindaitutor-recordings';
const request = <T,>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

function idbVault(db: IDBDatabase): RecordingVault {
  const chunksOf = async (id: string) => {
    const tx = db.transaction('chunks', 'readonly');
    const rows = await request(tx.objectStore('chunks').index('byRecording').getAll(id)) as (Chunk & { key: number })[];
    return rows.sort((a, b) => a.key - b.key);
  };
  const deleteWhere = async (id: string, keep: (chunk: Chunk) => boolean) => {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');
    const rows = await request(store.index('byRecording').getAll(id)) as (Chunk & { key: number })[];
    for (const row of rows) if (!keep(row)) store.delete(row.key);
    await done(tx);
  };
  const add = async (chunk: Chunk) => {
    const tx = db.transaction('chunks', 'readwrite');
    tx.objectStore('chunks').add(chunk);
    await done(tx);
  };
  return {
    async putMeta(meta) {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(meta);
      await done(tx);
    },
    async listMeta() {
      return request(db.transaction('meta', 'readonly').objectStore('meta').getAll()) as Promise<VaultMeta[]>;
    },
    appendTail: (recordingId, samples) => add({ recordingId, kind: 'tail', samples }),
    async readTail(id) {
      return joinInt16((await chunksOf(id)).flatMap((chunk) => (chunk.kind === 'tail' ? [chunk.samples] : [])));
    },
    clearTail: (id) => deleteWhere(id, (chunk) => chunk.kind !== 'tail'),
    async putSegment(recordingId, segment) {
      await deleteWhere(recordingId, (chunk) => !(chunk.kind === 'segment' && chunk.segment.idx === segment.idx));
      await add({ recordingId, kind: 'segment', segment });
    },
    async listSegments(id) {
      return (await chunksOf(id)).flatMap((chunk) => (chunk.kind === 'segment' ? [chunk.segment] : [])).sort((a, b) => a.idx - b.idx);
    },
    deleteSegment: (id, idx) => deleteWhere(id, (chunk) => !(chunk.kind === 'segment' && chunk.segment.idx === idx)),
    appendMedia: (recordingId, blob) => add({ recordingId, kind: 'media', blob }),
    async readMedia(id) {
      return (await chunksOf(id)).flatMap((chunk) => (chunk.kind === 'media' ? [chunk.blob] : []));
    },
    async remove(id) {
      await deleteWhere(id, () => false);
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').delete(id);
      await done(tx);
    },
  };
}

let opening: Promise<RecordingVault | null> | null = null;

/** The browser's vault, or null where IndexedDB is unavailable (private modes). */
export function openRecordingVault(): Promise<RecordingVault | null> {
  if (opening) return opening;
  opening = (async () => {
    if (typeof indexedDB === 'undefined') return null;
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('meta', { keyPath: 'recordingId' });
        db.createObjectStore('chunks', { keyPath: 'key', autoIncrement: true }).createIndex('byRecording', 'recordingId');
      };
      return idbVault(await request(open));
    } catch {
      return null;
    }
  })();
  return opening;
}
