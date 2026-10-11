import React, { useEffect, useState, useRef } from 'react';
import {
  HardDrive,
  Trash2,
  Play,
  AlertTriangle,
  X,
  RefreshCw,
  CheckCircle2,
  DownloadCloud,
  Loader2,
  Sparkles,
  StopCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StorageInfo, VideoItem } from '../types';
import {
  getStorageUsage,
  deleteVideoBlob,
  clearAllOfflineStorage,
  formatBytes,
  batchDownloadVideos,
  BatchDownloadProgress,
} from '../utils/indexedDB';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  onPlayVideo: (videoId: string) => void;
  onStorageChanged: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  isOpen,
  onClose,
  videos,
  onPlayVideo,
  onStorageChanged,
  onShowToast,
}) => {
  const [storageData, setStorageData] = useState<StorageInfo>({ totalBytes: 0, items: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Batch Download State
  const [batchProgress, setBatchProgress] = useState<BatchDownloadProgress | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadStorage = async () => {
    setIsLoading(true);
    try {
      const data = await getStorageUsage();
      setStorageData(data);
    } catch (err) {
      console.warn('Storage info load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStorage();
      setConfirmClear(false);
    }
  }, [isOpen]);

  const handleDeleteItem = async (videoId: string) => {
    try {
      await deleteVideoBlob(videoId);
      await loadStorage();
      onStorageChanged();
    } catch (err) {
      console.warn('Delete item error:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllOfflineStorage();
      await loadStorage();
      setConfirmClear(false);
      onStorageChanged();
    } catch (err) {
      console.warn('Clear all error:', err);
    }
  };

  const safeItems = Array.isArray(storageData.items) ? storageData.items : [];
  const safeVideos = Array.isArray(videos) ? videos : [];

  // Calculate remaining un-downloaded videos
  const downloadedIdSet = new Set(safeItems.map((item) => item.videoId));
  const unDownloadedVideos = safeVideos.filter((v) => !downloadedIdSet.has(v.id));

  const handleStartBatchDownload = async (count: number) => {
    if (isBatchDownloading) return;
    if (unDownloadedVideos.length === 0) {
      if (onShowToast) onShowToast('সব ভিডিও ইতিমধ্যে অফলাইনে সংরক্ষিত আছে!', 'info');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsBatchDownloading(true);

    try {
      const { successCount, failCount } = await batchDownloadVideos(
        safeVideos,
        downloadedIdSet,
        count,
        (progress) => {
          setBatchProgress({ ...progress });
        },
        abortController.signal
      );

      await loadStorage();
      onStorageChanged();

      if (successCount > 0) {
        confetti({
          particleCount: 50,
          spread: 80,
          origin: { y: 0.7 },
        });
        if (onShowToast) {
          onShowToast(`সফলভাবে ${successCount}টি ভিডিও অফলাইনে সেভ হয়েছে!`, 'success');
        }
      } else if (failCount > 0 && !abortController.signal.aborted) {
        if (onShowToast) {
          onShowToast(`ভিডিও ডাউনলোড ব্যর্থ হয়েছে (${failCount}টি)`, 'error');
        }
      }
    } catch (err) {
      console.warn('Batch download error:', err);
    } finally {
      setIsBatchDownloading(false);
      abortControllerRef.current = null;
      setTimeout(() => {
        setBatchProgress(null);
      }, 3000);
    }
  };

  const handleCancelBatchDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsBatchDownloading(false);
      if (onShowToast) onShowToast('ব্যাচ ডাউনলোড বন্ধ করা হয়েছে', 'info');
    }
  };

  if (!isOpen) return null;

  // Map cached items to their video metadata if available
  const mappedItems = safeItems.map((item) => {
    const matched = safeVideos.find((v) => v.id === item.videoId);
    return {
      ...item,
      title: matched ? matched.title : `ভিডিও #${item.videoId.substring(0, 6)}`,
      creator: matched?.creator || 'অজানা ক্রিয়েটর',
      creatorHandle: matched?.creatorHandle,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">অফলাইন স্টোরেজ ম্যানেজার</h3>
              <p className="text-xs text-zinc-400">IndexedDB ব্রাউজার মেমোরি</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Summary Card */}
        <div className="p-4 sm:p-5 bg-zinc-950/50 border-b border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
              মোট সংরক্ষিত ডাটা
            </span>
            <button
              onClick={loadStorage}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              রিফ্রেশ
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {formatBytes(storageData.totalBytes)}
            </span>
            <span className="text-xs text-zinc-500">
              ({mappedItems.length} টি ভিডিও ক্যাশ করা হয়েছে)
            </span>
          </div>

          {/* Storage bar illustration */}
          <div className="w-full bg-zinc-800 h-2.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(5, (storageData.totalBytes / (500 * 1024 * 1024)) * 100))}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5 flex items-center justify-between">
            <span>সরাসরি অফলাইনে ইন্টারনেট ছাড়াই দেখার জন্য প্রস্তুত</span>
            <span>৫০০ MB প্রস্তাবিত সীমা</span>
          </p>
        </div>

        {/* QUICK BATCH DOWNLOAD SECTION */}
        <div className="p-3 sm:p-4 bg-zinc-900/90 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <DownloadCloud className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-zinc-200">
                এক ক্লিকে ব্যাচ ডাউনলোড (Batch Download)
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {unDownloadedVideos.length}টি বাকি
            </span>
          </div>

          {isBatchDownloading && batchProgress ? (
            <div className="p-3 rounded-xl bg-zinc-950 border border-rose-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-300 font-semibold flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                  ডাউনলোড হচ্ছে: {batchProgress.completed + 1} / {batchProgress.total}
                </span>
                <span className="font-mono text-zinc-300 font-bold">{batchProgress.currentPercent}%</span>
              </div>

              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-200"
                  style={{
                    width: `${Math.round(((batchProgress.completed + batchProgress.currentPercent / 100) / batchProgress.total) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="truncate max-w-[200px]">{batchProgress.currentTitle}</span>
                <button
                  onClick={handleCancelBatchDownload}
                  className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <StopCircle className="w-3 h-3" />
                  থামুন
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">
                পরবর্তী ভিডিওগুলো এক ক্লিকে লোকাল মেমোরিতে নামিয়ে রাখুন:
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {[10, 20, 30, 40].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleStartBatchDownload(num)}
                    disabled={unDownloadedVideos.length === 0}
                    className="min-h-[38px] py-1.5 px-1 bg-zinc-800 hover:bg-rose-600 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                    title={`পরবর্তী ${num}টি ভিডিও ডাউনলোড করুন`}
                  >
                    +{num}টি
                  </button>
                ))}
                <button
                  onClick={() => handleStartBatchDownload(unDownloadedVideos.length)}
                  disabled={unDownloadedVideos.length === 0}
                  className="min-h-[38px] py-1.5 px-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 text-white rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                  title="সব বাকি ভিডিও ডাউনলোড করুন"
                >
                  সব ({unDownloadedVideos.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Video List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {mappedItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30 text-rose-500" />
              <p className="text-sm font-medium text-zinc-400">কোনো অফলাইন ভিডিও সংরক্ষিত নেই</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                ফিডের ডানপাশের ডাউনলোড আইকন চেপে যে কোনো ভিডিও অফলাইন মোডের জন্য সেভ করুন।
              </p>
            </div>
          ) : (
            mappedItems.map((item) => (
              <div
                key={item.videoId}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700/60 transition group"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <h4 className="text-sm font-medium text-zinc-100 truncate">{item.title}</h4>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                    <span>{item.creator}</span>
                    <span>•</span>
                    <span className="font-mono text-zinc-300 font-semibold">{formatBytes(item.size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      onPlayVideo(item.videoId);
                      onClose();
                    }}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white transition cursor-pointer flex items-center justify-center"
                    title="প্লে করুন"
                    aria-label="প্লে করুন"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.videoId)}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer flex items-center justify-center"
                    title="মুছে ফেলুন"
                    aria-label="মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/70">
          {confirmClear ? (
            <div className="flex items-center justify-between gap-2 p-2.5 bg-red-950/50 border border-red-800/60 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>সব ক্যাশ মুছে ফেলতে চান?</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  হ্যাঁ, মুছুন
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setConfirmClear(true)}
                disabled={mappedItems.length === 0}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30 disabled:hover:text-red-400 flex items-center gap-1.5 py-2 px-2.5 rounded-lg hover:bg-red-500/10 transition cursor-pointer min-h-[44px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                সব ক্যাশ মেমোরি খালি করুন
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition cursor-pointer min-h-[44px]"
              >
                সম্পন্ন
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
