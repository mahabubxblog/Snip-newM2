export interface VideoItem {
  id: string;
  title: string;
  caption: string;
  url: string;
  originalUrl?: string;
  creator: string;
  creatorHandle: string;
  creatorAvatar: string;
  audioTrack: string;
  likes: number;
  commentsCount: number;
  createdAt: string;
  isLocalCustom?: boolean;
  downloadedAt?: string;
  blobSize?: number;
  objectUrl?: string; // In-memory Object URL when loaded from IndexedDB
  loadError?: string | null;
}

export interface CommentItem {
  id: string;
  videoId: string;
  author: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
}

export interface GitHubSyncConfig {
  owner: string;
  repo: string;
  token: string;
  branch: string;
  filePath: string;
}

export interface StorageInfo {
  totalBytes: number;
  items: {
    videoId: string;
    size: number;
    title?: string;
    mimeType?: string;
    timestamp?: string;
  }[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
