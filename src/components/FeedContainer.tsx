import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  HardDrive,
  SlidersHorizontal,
  DownloadCloud,
  Compass,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Repeat,
} from 'lucide-react';
import { VideoItem } from '../types';
import { ReelPlayer } from './ReelPlayer';

interface FeedContainerProps {
  videos: VideoItem[];
  allVideosCount: number;
  offlineVideosCount: number;
  feedFilter: 'all' | 'offline';
  onChangeFilter: (filter: 'all' | 'offline') => void;
  isOfflineSimulated: boolean;
  onToggleOfflineSimulator: () => void;
  isDeviceOnline: boolean;
  onOpenStorageModal: () => void;
  onOpenAdminStudio: () => void;
  onOpenComments: (video: VideoItem) => void;
  onShareVideo: (video: VideoItem) => void;
  onDownloadVideo: (video: VideoItem) => void;
  downloadedVideoIds: Set<string>;
  downloadProgressMap: Record<string, number>;
  onLikeToggle?: (videoId: string, isLiked: boolean) => void;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

export const FeedContainer: React.FC<FeedContainerProps> = ({
  videos,
  allVideosCount,
  offlineVideosCount,
  feedFilter,
  onChangeFilter,
  isOfflineSimulated,
  onToggleOfflineSimulator,
  onOpenStorageModal,
  onOpenAdminStudio,
  onOpenComments,
  onShareVideo,
  onDownloadVideo,
  downloadedVideoIds,
  downloadProgressMap,
  onLikeToggle,
  activeIndex,
  setActiveIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true); // Start muted per web autoplay policy
  const [isAutoAdvance, setIsAutoAdvance] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sniptok_auto_advance') === 'true';
    } catch {
      return false;
    }
  });

  const toggleAutoAdvance = () => {
    setIsAutoAdvance((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sniptok_auto_advance', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Safe videos array
  const safeVideos = Array.isArray(videos) ? videos : [];

  // Prevent out of bounds index if list size drops
  useEffect(() => {
    if (safeVideos.length > 0 && activeIndex > safeVideos.length) {
      setActiveIndex(Math.max(0, safeVideos.length - 1));
    }
  }, [safeVideos.length, activeIndex, setActiveIndex]);

  // Throttled scroll listener via requestAnimationFrame to avoid rapid thrashing
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = containerRef.current;
      if (!container) return;

      const height = container.clientHeight;
      if (height <= 0) return;

      const scrollTop = container.scrollTop;
      const newIndex = Math.round(scrollTop / height);
      // Support index up to safeVideos.length for the End-of-Feed Loop card
      const clampedIndex = Math.max(0, Math.min(safeVideos.length, newIndex));

      if (clampedIndex !== activeIndex && (safeVideos.length > 0 || clampedIndex === 0)) {
        setActiveIndex(clampedIndex);
      }
    });
  }, [safeVideos.length, activeIndex, setActiveIndex]);

  // Auto-advance callback when video playback finishes: loops back from last video to 1st video
  const handleVideoEnded = useCallback(() => {
    if (safeVideos.length <= 1) return;
    const next = (activeIndex + 1) % safeVideos.length;
    setActiveIndex(next);
    const container = containerRef.current;
    if (container) {
      const height = container.clientHeight;
      container.scrollTo({ top: next * height, behavior: 'smooth' });
    }
  }, [safeVideos.length, activeIndex, setActiveIndex]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Keyboard navigation: Up/Down with smooth Playlist Loop, j/k, 'm', Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA'].includes(targetTag)) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;
      const height = container.clientHeight;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        if (safeVideos.length === 0) return;
        // Loop back to index 0 if on or past the last video
        const next = activeIndex >= safeVideos.length - 1 ? 0 : activeIndex + 1;
        container.scrollTo({ top: next * height, behavior: 'smooth' });
        setActiveIndex(next);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        if (safeVideos.length === 0) return;
        // Loop back to last video if at index 0
        const prev = activeIndex <= 0 ? safeVideos.length - 1 : activeIndex - 1;
        container.scrollTo({ top: prev * height, behavior: 'smooth' });
        setActiveIndex(prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      } else if (e.code === 'Space') {
        // Space key pause/play trigger
        e.preventDefault();
        const currentActiveVideo = container.querySelector(
          `.snap-item:nth-child(${activeIndex + 1}) video`
        ) as HTMLVideoElement | null;
        if (currentActiveVideo) {
          if (currentActiveVideo.paused) {
            currentActiveVideo.play().catch(() => {});
          } else {
            currentActiveVideo.pause();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, safeVideos.length, setActiveIndex]);

  // Smooth scroll sync when activeIndex changes externally
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const height = container.clientHeight;
    const targetScroll = activeIndex * height;
    if (Math.abs(container.scrollTop - targetScroll) > 10) {
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [activeIndex]);

  const toggleMute = () => setIsMuted((prev) => !prev);

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] bg-black flex flex-col overflow-hidden">
      {/* TOP HEADER CONTROLS (Floating Glass Bar) */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-4 pt-3 pb-2 bg-gradient-to-b from-black/85 via-black/45 to-transparent pointer-events-auto">
        {/* Brand Logo & Studio trigger */}
        <div className="flex items-center gap-2">
          <div
            onClick={onOpenAdminStudio}
            className="flex items-center gap-1.5 cursor-pointer group min-h-[44px]"
            title="SnipTok ক্রিয়েটর স্টুডিও খুলুন"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center font-black text-white shadow-lg shadow-rose-500/25 group-hover:scale-105 transition">
              S
            </div>
            <span className="font-extrabold text-base tracking-tight text-white hidden xs:inline">
              Snip<span className="text-rose-500">Tok</span>
            </span>
          </div>

          {/* Admin Studio Quick Badge */}
          <button
            onClick={onOpenAdminStudio}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium backdrop-blur-md transition cursor-pointer min-h-[44px]"
            title="অ্যাডমিন প্যানেল (পাসওয়ার্ড: Ma44332211)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">স্টুডিও</span>
          </button>
        </div>

        {/* Center: Segmented Filter ("সব" vs "অফলাইন") */}
        <div className="flex items-center p-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-xs font-semibold">
          <button
            onClick={() => onChangeFilter('all')}
            className={`min-h-[36px] px-3.5 py-1 rounded-full transition cursor-pointer flex items-center justify-center ${
              feedFilter === 'all'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            সব ({allVideosCount})
          </button>
          <button
            onClick={() => onChangeFilter('offline')}
            className={`min-h-[36px] px-3.5 py-1 rounded-full transition cursor-pointer flex items-center justify-center gap-1 ${
              feedFilter === 'offline'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>অফলাইন</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.2 rounded-full">
              {offlineVideosCount}
            </span>
          </button>
        </div>

        {/* Right: Auto-Loop toggle + Offline Simulator + Storage Modal Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Auto-Advance / Playlist Loop Toggle */}
          <button
            onClick={toggleAutoAdvance}
            className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition cursor-pointer ${
              isAutoAdvance
                ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-white border-zinc-800'
            }`}
            title="অটো-লুপ মোড: ভিডিও শেষ হলে স্বয়ংক্রিয়ভাবে পরবর্তী ভিডিও এবং শেষ ভিডিওর পর ১ম ভিডিও থেকে শুরু হবে"
          >
            <Repeat className={`w-3.5 h-3.5 ${isAutoAdvance ? 'text-rose-400 animate-pulse' : 'text-zinc-400'}`} />
            <span className="text-[10px] font-semibold hidden md:inline">
              {isAutoAdvance ? 'অটো-লুপ চালু' : 'অটো-লুপ'}
            </span>
          </button>

          {/* Offline Simulator Switch */}
          <button
            onClick={onToggleOfflineSimulator}
            className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition cursor-pointer ${
              isOfflineSimulated
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-zinc-900/60 text-zinc-300 hover:text-white border-zinc-800'
            }`}
            title="ইন্টারনেট সংযোগ বন্ধ করে অফলাইন মোড সিমুলেট করুন"
          >
            {isOfflineSimulated ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-semibold hidden md:inline">অফলাইন সিমুলেটর</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-semibold hidden md:inline">অনলাইন</span>
              </>
            )}
          </button>

          {/* Storage Manager Trigger */}
          <button
            onClick={onOpenStorageModal}
            className="min-w-[44px] min-h-[44px] p-2 sm:px-3 sm:py-2 rounded-full bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 backdrop-blur-md transition flex items-center justify-center gap-1 cursor-pointer"
            title="অফলাইন মেমোরি ম্যানেজার"
          >
            <HardDrive className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-mono font-semibold hidden sm:inline">
              {offlineVideosCount}
            </span>
          </button>
        </div>
      </header>

      {/* OFFLINE SIMULATION BANNER */}
      {isOfflineSimulated && (
        <div className="absolute top-14 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
          <div className="bg-amber-600/90 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>অফলাইন মোড সিমুলেটেড — শুধুমাত্র ক্যাশ করা ভিডিও প্লে হবে</span>
            <button
              onClick={onToggleOfflineSimulator}
              className="ml-1 text-[10px] underline font-bold hover:text-amber-100 cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* REELS VERTICAL SNAP FEED */}
      {safeVideos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400 select-none">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
            {feedFilter === 'offline' ? (
              <DownloadCloud className="w-8 h-8 text-rose-500/60" />
            ) : (
              <Compass className="w-8 h-8 text-rose-500/60" />
            )}
          </div>
          <h3 className="text-base font-bold text-zinc-200">
            {feedFilter === 'offline' ? 'কোনো অফলাইন ভিডিও নেই' : 'কোনো ভিডিও পাওয়া যায়নি'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-xs mt-1 leading-relaxed">
            {feedFilter === 'offline'
              ? 'ফিডের সব ভিডিও থেকে পছন্দের যেকোনো ভিডিও অফলাইনে ডাউনলোড করে নিন।'
              : 'অ্যাডমিন স্টুডিও থেকে নতুন Dropbox অথবা MP4 ভিডিও লিংক যুক্ত করুন।'}
          </p>
          {feedFilter === 'offline' ? (
            <button
              onClick={() => onChangeFilter('all')}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              সব ভিডিও দেখুন
            </button>
          ) : (
            <button
              onClick={onOpenAdminStudio}
              className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              স্টুডিও খুলুন
            </button>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 w-full h-full snap-container overflow-y-scroll no-scrollbar"
        >
          {safeVideos.map((video, idx) => {
            const distance = idx - activeIndex;
            // TikTok-style preloading: next 4-5 videos smart preloaded
            let preloadMode: 'auto' | 'metadata' | 'none' = 'none';
            if (distance === 0) {
              preloadMode = 'auto';
            } else if (distance === 1 || distance === 2) {
              preloadMode = 'auto'; // Immediate next 2 videos buffered in high priority
            } else if (distance === 3 || distance === 4 || distance === -1) {
              preloadMode = 'metadata'; // Next 3-4 videos and previous 1 video metadata preloaded
            } else {
              preloadMode = 'none'; // Distant videos unbuffered to prevent network congestion
            }

            return (
              <div key={video.id} className="w-full h-full snap-item relative">
                <ReelPlayer
                  video={video}
                  isActive={idx === activeIndex}
                  preloadMode={preloadMode}
                  isMuted={isMuted}
                  onToggleMute={toggleMute}
                  onOpenComments={onOpenComments}
                  onShare={onShareVideo}
                  onDownload={onDownloadVideo}
                  isDownloaded={downloadedVideoIds.has(video.id)}
                  downloadProgress={downloadProgressMap[video.id] || 0}
                  isDownloading={
                    downloadProgressMap[video.id] !== undefined &&
                    downloadProgressMap[video.id] < 100
                  }
                  onLikeToggle={onLikeToggle}
                  isAutoAdvance={isAutoAdvance}
                  onEnded={handleVideoEnded}
                />
              </div>
            );
          })}

          {/* LOOP END CARD: যখন ব্যবহারকারী ফিডের সব ভিডিও দেখে ফেলবে */}
          {safeVideos.length > 0 && (
            <div className="w-full h-full snap-item relative bg-gradient-to-b from-zinc-950 via-zinc-900 to-black flex flex-col items-center justify-center p-6 text-center select-none">
              <div className="max-w-sm w-full p-6 sm:p-7 rounded-3xl bg-zinc-900/95 border border-zinc-800/80 shadow-2xl backdrop-blur-xl flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
                  <RotateCcw className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-bold text-white mb-1.5">
                  সব ভিডিও দেখা শেষ! 🎉
                </h3>
                <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                  আপনি ফিডের মোট <strong className="text-white font-mono">{safeVideos.length}টি</strong> ভিডিওর সবগুলো উপভোগ করেছেন।
                </p>

                <div className="flex flex-col gap-2.5 w-full">
                  <button
                    onClick={() => {
                      setActiveIndex(0);
                      const container = containerRef.current;
                      if (container) {
                        container.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="w-full py-3.5 px-5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-2xl text-sm font-bold shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition min-h-[44px]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    আবার ১ম ভিডিও থেকে শুরু করুন (Loop Feed)
                  </button>

                  <button
                    onClick={onOpenStorageModal}
                    className="w-full py-3 px-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition min-h-[40px]"
                  >
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    অফলাইনে সেভ করুন ({offlineVideosCount} টি সেভ করা)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK FLOATING NAV ARROWS (Desktop / Tablet Ergonomics with Loop Wrap-around) */}
      <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 flex-col gap-2 z-30">
        <button
          onClick={() => {
            if (safeVideos.length === 0) return;
            const prev = activeIndex <= 0 ? safeVideos.length - 1 : activeIndex - 1;
            setActiveIndex(prev);
          }}
          className="p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 transition cursor-pointer shadow-xl min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
          title={activeIndex <= 0 ? "সর্বশেষ ভিডিওতে যান" : "পূর্ববর্তী ভিডিও (Up Arrow)"}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            if (safeVideos.length === 0) return;
            const next = activeIndex >= safeVideos.length - 1 ? 0 : activeIndex + 1;
            setActiveIndex(next);
          }}
          className={`p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 transition cursor-pointer shadow-xl min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 ${
            activeIndex >= safeVideos.length - 1 ? 'border-rose-500/60 text-rose-400 shadow-rose-500/20' : ''
          }`}
          title={
            activeIndex >= safeVideos.length - 1
              ? 'আবার ১ম ভিডিও থেকে দেখুন (Loop to Start)'
              : 'পরবর্তী ভিডিও (Down Arrow)'
          }
        >
          {activeIndex >= safeVideos.length - 1 ? (
            <RotateCcw className="w-5 h-5 text-rose-400" />
          ) : (
            <ArrowDown className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
