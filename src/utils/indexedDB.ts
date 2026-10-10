import { CommentItem, StorageInfo, VideoItem } from '../types';

const DB_NAME = 'snip_tok_offline_db';
const DB_VERSION = 2;

const STORE_BLOBS = 'offline_blobs';
const STORE_VIDEOS = 'custom_videos';
const STORE_COMMENTS = 'user_comments';

export interface StoredBlobRecord {
  videoId: string;
  blob: Blob;
  size: number;
  mimeType: string;
  timestamp: string;
}

let dbInstance: IDBDatabase | null = null;

// Object URL Memory Leak Prevention Registry
const objectUrlRegistry = new Map<string, string>();

/**
 * Revoke and clean up an existing Object URL for a video ID
 */
export function revokeObjectUrl(videoId: string): void {
  const existingUrl = objectUrlRegistry.get(videoId);
  if (existingUrl) {
    try {
      URL.revokeObjectURL(existingUrl);
    } catch {
      // ignore
    }
    objectUrlRegistry.delete(videoId);
  }
}

/**
 * Revoke all in-memory Object URLs to completely free browser RAM
 */
export function revokeAllObjectUrls(): void {
  objectUrlRegistry.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  });
  objectUrlRegistry.clear();
}

export async function getDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store 1: offline_blobs
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'videoId' });
        }

        // Store 2: custom_videos
        if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
          db.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
        }

        // Store 3: user_comments
        if (!db.objectStoreNames.contains(STORE_COMMENTS)) {
          const commentStore = db.createObjectStore(STORE_COMMENTS, { keyPath: 'id' });
          commentStore.createIndex('videoId', 'videoId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        console.warn('IndexedDB open error (likely Private Browsing):', error);
        reject(error);
      };

      request.onblocked = () => {
        console.warn('IndexedDB database upgrade blocked by another open tab');
      };
    } catch (err) {
      console.warn('IndexedDB initialization exception:', err);
      reject(err);
    }
  });
}

/**
 * Downloads a video with streaming progress callback (0 -> 100%)
 * and stores it directly into IndexedDB.
 * Supports AbortSignal for graceful cancelation.
 */
export async function downloadAndSaveVideo(
  video: VideoItem,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const directUrl = video.url;

  try {
    const response = await fetch(directUrl, { signal });
    if (!response.ok) {
      throw new Error(`ভিডিও ডাউনলোড ব্যর্থ হয়েছে (সার্ভার রেসপন্স কোড: ${response.status})`);
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';

    // Verify it is not an HTML error page disguised as status 200
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      throw new Error(
        'প্রদত্ত লিংকটি কোনো সরাসরি ভিডিও স্ট্রিম প্রদান করছে না (ওয়েবপেজ বা এক্সেস ডিনায়েড)।'
      );
    }

    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

    let receivedBytes = 0;
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];

    if (reader) {
      while (true) {
        if (signal?.aborted) {
          throw new DOMException('Download aborted by user', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (totalBytes > 0 && onProgress) {
            const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
            onProgress(percent);
          } else if (onProgress) {
            // Simulated gradual progress if Content-Length is missing
            const simulated = Math.min(95, Math.round((receivedBytes / (10 * 1024 * 1024)) * 100));
            onProgress(simulated);
          }
        }
      }
    } else {
      const blobDirect = await response.blob();
      chunks.push(new Uint8Array(await blobDirect.arrayBuffer()));
      receivedBytes = blobDirect.size;
    }

    if (onProgress) onProgress(100);

    const fullBlob = new Blob(chunks as BlobPart[], { type: contentType });
    await saveVideoBlob(video.id, fullBlob, contentType);

    // Clean up any old Object URL for this video before creating new
    revokeObjectUrl(video.id);

    const objectUrl = URL.createObjectURL(fullBlob);
    objectUrlRegistry.set(video.id, objectUrl);
    return objectUrl;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log('Video download aborted');
    } else {
      console.error('Download error:', err);
    }
    throw err;
  }
}

/**
 * Save video blob to IndexedDB
 */
export async function saveVideoBlob(videoId: string, blob: Blob, mimeType = 'video/mp4'): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);

      const record: StoredBlobRecord = {
        videoId,
        blob,
        size: blob.size,
        mimeType: mimeType || blob.type || 'video/mp4',
        timestamp: new Date().toISOString(),
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        const err = request.error;
        console.error('saveVideoBlob error:', err);
        reject(err);
      };
    });
  } catch (err) {
    console.error('saveVideoBlob exception:', err);
    throw err;
  }
}

/**
 * Retrieve blob for a specific video ID and return or reuse Object URL
 */
export async function getVideoObjectURL(videoId: string): Promise<string | null> {
  // If we already have an active Object URL in memory, reuse it
  if (objectUrlRegistry.has(videoId)) {
    return objectUrlRegistry.get(videoId)!;
  }

  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.get(videoId);

      request.onsuccess = () => {
        const record = request.result as StoredBlobRecord | undefined;
        if (record && record.blob) {
          const url = URL.createObjectURL(record.blob);
          objectUrlRegistry.set(videoId, url);
          resolve(url);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('getVideoObjectURL error:', err);
    return null;
  }
}

/**
 * Get all cached video IDs
 */
export async function getAllDownloadedVideoIds(): Promise<string[]> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = (request.result || []) as string[];
        resolve(keys);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Delete a cached video blob and revoke its Object URL
 */
export async function deleteVideoBlob(videoId: string): Promise<void> {
  // Revoke from memory registry first
  revokeObjectUrl(videoId);

  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.delete(videoId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('deleteVideoBlob error:', err);
  }
}

/**
 * Get detailed storage usage information
 */
export async function getStorageUsage(): Promise<StorageInfo> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result || []) as StoredBlobRecord[];
        const safeRecords = Array.isArray(records) ? records : [];
        let totalBytes = 0;
        const items = safeRecords.map((rec) => {
          totalBytes += rec.size || 0;
          return {
            videoId: rec.videoId,
            size: rec.size || 0,
            mimeType: rec.mimeType,
            timestamp: rec.timestamp,
          };
        });

        resolve({ totalBytes, items });
      };

      request.onerror = () => {
        resolve({ totalBytes: 0, items: [] });
      };
    });
  } catch {
    return { totalBytes: 0, items: [] };
  }
}

/**
 * Clear all offline stored blobs and revoke all memory Object URLs
 */
export async function clearAllOfflineStorage(): Promise<void> {
  revokeAllObjectUrls();

  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_BLOBS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('clearAllOfflineStorage error:', err);
  }
}

/**
 * COMMENTS ENGINE: Get comments by video ID
 */
export async function getCommentsByVideoId(videoId: string): Promise<CommentItem[]> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_COMMENTS, 'readonly');
      const store = tx.objectStore(STORE_COMMENTS);
      const index = store.index('videoId');
      const request = index.getAll(videoId);

      request.onsuccess = () => {
        const comments = (request.result || []) as CommentItem[];
        const safeComments = Array.isArray(comments) ? comments : [];
        safeComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(safeComments);
      };

      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * COMMENTS ENGINE: Add a new comment
 */
export async function addCommentToStorage(comment: CommentItem): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMMENTS, 'readwrite');
      const store = tx.objectStore(STORE_COMMENTS);
      const request = store.put(comment);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('addComment error:', err);
  }
}

/**
 * COMMENTS ENGINE: Like / unlike a comment
 */
export async function toggleCommentLike(commentId: string): Promise<CommentItem | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_COMMENTS, 'readwrite');
      const store = tx.objectStore(STORE_COMMENTS);
      const request = store.get(commentId);

      request.onsuccess = () => {
        const comment = request.result as CommentItem | undefined;
        if (!comment) {
          resolve(null);
          return;
        }

        const isLiked = !comment.isLiked;
        const likes = isLiked ? (comment.likes || 0) + 1 : Math.max(0, (comment.likes || 0) - 1);
        const updated = { ...comment, isLiked, likes };

        const updateReq = store.put(updated);
        updateReq.onsuccess = () => resolve(updated);
        updateReq.onerror = () => resolve(comment);
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Format bytes into human readable format (MB / KB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] || 'B'}`;
}
