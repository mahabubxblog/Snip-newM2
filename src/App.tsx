/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { ToastMessage, VideoItem } from './types';
import {
  getAllDownloadedVideoIds,
  getVideoObjectURL,
  downloadAndSaveVideo,
  revokeAllObjectUrls,
} from './utils/indexedDB';
import {
  fetchVideosFromCloud,
  pushVideosToCloud,
} from './utils/cloudSync';
import { FeedContainer } from './components/FeedContainer';
import { CommentsDrawer } from './components/CommentsDrawer';
import { StorageManagerModal } from './components/StorageManagerModal';
import { AdminStudioModal } from './components/AdminStudioModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';

// BUILT-IN FALLBACK SEED VIDEOS (Ensures flawless startup even with zero network or local file restrictions)
const INITIAL_FALLBACK_VIDEOS: VideoItem[] = [
  {
    id: 'snip-01',
    title: 'মেঘের রাজ্যে সাজেক ভ্যালি ⛰️',
    caption: 'সকালের কুয়াশা আর পাহাড়ের অপরূপ সৌন্দর্য! প্রকৃতির অপার বিস্ময় বাংলাদেশ। #sajek #travelbd #shorts #viral #nature',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    creator: 'মাহাবুব আহমেদ',
    creatorHandle: '@mahabub_explorer',
    creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'Original Sound - Sajek Vibes',
    likes: 4820,
    commentsCount: 184,
    createdAt: '2026-10-01T10:00:00Z',
  },
  {
    id: 'snip-02',
    title: 'কক্সবাজার সমুদ্র সৈকতের সূর্যাস্ত 🌅',
    caption: 'বিশ্বের দীর্ঘতম প্রাকৃতিক সমুদ্র সৈকতে গোধূলির মায়াবী আলো। এক কাপ লাল চা আর সমুদ্রের গর্জন! #coxsbazar #sunset #beachlife #bangladesh #reels',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    creator: 'তুষার ভ্রমণ',
    creatorHandle: '@tushar_travels',
    creatorAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'Acoustic Sunset Melody - AcousticBD',
    likes: 8940,
    commentsCount: 392,
    createdAt: '2026-10-02T12:30:00Z',
  },
  {
    id: 'snip-03',
    title: 'পুরান ঢাকার স্পেশাল কাচ্চি বিরিয়ানি 🍛',
    caption: 'ঘিয়ে ভাজা আলু আর নরম খাসির মাংসের রসালো স্বাদ! আপনি কি কাচ্চি লাভার? কমেন্টে জানান। #dhakafood #kacchi #foodie #purandhaka #viral',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    creator: 'ফুডি ঢাকা',
    creatorHandle: '@dhakafoodster',
    creatorAvatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'Traditional Dhakai Flute - StudioDhaka',
    likes: 12450,
    commentsCount: 641,
    createdAt: '2026-10-03T15:15:00Z',
  },
  {
    id: 'snip-04',
    title: 'বৃষ্টির দিনে চায়ের কাপে আড্ডা ☕🌧️',
    caption: 'টিনের চালে বৃষ্টির রিমঝিম শব্দ আর ধোঁয়া ওঠা মশলা চা। এর চেয়ে শান্তির মুহূর্ত আর কী হতে পারে! #rain #monsoon #tea #adda #bangla',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    creator: 'নীল কাব্য',
    creatorHandle: '@neelkabbo',
    creatorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'Monsoon Raindrops - LoFi Bangla',
    likes: 6730,
    commentsCount: 219,
    createdAt: '2026-10-04T08:20:00Z',
  },
  {
    id: 'snip-05',
    title: 'সুন্দরবনের গহীন অরণ্যে অভিযান 🐅🌿',
    caption: 'ম্যানগ্রোভ বনের নদীপথে বুনো হরিণ আর পাখির মিষ্টি কলকাকলি। আমাদের গর্ব সুন্দরবন! #sundarbans #wildlife #forest #adventure #bangladesh',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    creator: 'আরণ্যক টিম',
    creatorHandle: '@arannok_wild',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'Deep Jungle Echoes - NatureAudio',
    likes: 7890,
    commentsCount: 312,
    createdAt: '2026-10-06T14:10:00Z',
  },
  {
    id: 'snip-06',
    title: 'রাতের আলোয় হাতিরঝিল ব্রিজ 🌃✨',
    caption: 'রাজধানীর আলোর ঝলকানি আর ব্রিজের আধুনিক স্থাপত্য। ঢাকার রাতের রূপ অতুলনীয়! #dhaka #hatirjheel #nightlights #citylife #shorts',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    creator: 'শহুরে ক্যামেরা',
    creatorHandle: '@urban_dhaka',
    creatorAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'City Lights Nocturne - UrbanBeats',
    likes: 5120,
    commentsCount: 142,
    createdAt: '2026-10-07T11:00:00Z',
  },
];

export default function App() {
  // Master Videos State
  const [allVideos, setAllVideos] = useState<VideoItem[]>(INITIAL_FALLBACK_VIDEOS);

  // Active Feed View State
  const [feedFilter, setFeedFilter] = useState<'all' | 'offline'>('all');
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Network & Offline Simulation
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);

  // IndexedDB Download State
  const [downloadedVideoIds, setDownloadedVideoIds] = useState<Set<string>>(new Set());
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, number>>({});

  // Modals & Drawers
  const [activeCommentsVideo, setActiveCommentsVideo] = useState<VideoItem | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState<boolean>(false);
  const [isAdminStudioOpen, setIsAdminStudioOpen] = useState<boolean>(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsDeviceOnline(true);
      showToast('অনলাইন সংযোগ পাওয়া গেছে!', 'success');
    };
    const handleOffline = () => {
      setIsDeviceOnline(false);
      showToast('ইন্টারনেট সংযোগ বিচ্ছিন্ন! অফলাইন মোড চালু হয়েছে।', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  // Clean up all memory Object URLs on window unload to prevent browser memory leaks
  useEffect(() => {
    return () => {
      revokeAllObjectUrls();
    };
  }, []);

  // Load initial videos from JSON and LocalStorage (Dual-Save Strategy)
  useEffect(() => {
    let isMounted = true;

    const initLoad = async () => {
      let combinedVideos = [...INITIAL_FALLBACK_VIDEOS];

      // 1. Try fetching from Cloud Sync (Server / npoint / JSONBin)
      try {
        const cloudRes = await fetchVideosFromCloud();
        if (cloudRes.success && Array.isArray(cloudRes.videos) && cloudRes.videos.length > 0) {
          combinedVideos = cloudRes.videos;
        } else {
          // Fallback to static public/videos.json
          const res = await fetch('./videos.json');
          if (res.ok) {
            const remoteList = await res.json();
            if (Array.isArray(remoteList) && remoteList.length > 0) {
              combinedVideos = remoteList;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch cloud/static videos.json, using seed fallback:', err);
      }

      // 2. Merge with locally saved custom videos in localStorage
      try {
        const localCustom = localStorage.getItem('sniptok_custom_videos_list');
        if (localCustom) {
          const parsedLocal = JSON.parse(localCustom);
          if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
            combinedVideos = parsedLocal;
          }
        }
      } catch (err) {
        console.warn('LocalStorage videos parse error:', err);
      }

      // 3. Check IndexedDB for existing cached video blobs
      try {
        const downloadedIds = await getAllDownloadedVideoIds();
        if (!isMounted) return;

        setDownloadedVideoIds(new Set(downloadedIds));

        // Attach memory ObjectURLs for downloaded videos so they load offline
        const enriched = await Promise.all(
          combinedVideos.map(async (v) => {
            if (downloadedIds.includes(v.id)) {
              const objUrl = await getVideoObjectURL(v.id);
              if (objUrl) {
                return { ...v, objectUrl: objUrl };
              }
            }
            return v;
          })
        );

        if (isMounted) {
          setAllVideos(enriched);
        }
      } catch (err) {
        console.warn('IndexedDB check failed:', err);
        if (isMounted) {
          setAllVideos(combinedVideos);
        }
      }
    };

    initLoad();

    return () => {
      isMounted = false;
    };
  }, []);

  // Multi-device Auto-Sync: Periodically check Cloud for remote changes so all phones stay updated
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const checkCloudUpdates = async () => {
      if (!isDeviceOnline || isOfflineSimulated) return;
      try {
        const cloudResult = await fetchVideosFromCloud();
        if (
          cloudResult.success &&
          Array.isArray(cloudResult.videos) &&
          cloudResult.videos.length > 0
        ) {
          const remoteList = cloudResult.videos;
          setAllVideos((prev) => {
            const prevIds = prev.map((v) => v.id).join(',');
            const remoteIds = remoteList.map((v) => v.id).join(',');
            if (prevIds !== remoteIds || prev.length !== remoteList.length) {
              showToast(`🔄 ক্লাউড থেকে নতুন ভিডিও আপডেট হয়েছে (${remoteList.length}টি)!`, 'success');
              try {
                localStorage.setItem(
                  'sniptok_custom_videos_list',
                  JSON.stringify(remoteList.map(({ objectUrl, loadError, ...r }) => r))
                );
              } catch {
                // ignore
              }
              return remoteList;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Auto cloud sync check error:', err);
      }
    };

    timer = setInterval(checkCloudUpdates, 25000);
    const handleFocus = () => {
      checkCloudUpdates();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isDeviceOnline, isOfflineSimulated, showToast]);

  // Filtered Videos based on "সব" vs "অফলাইন"
  const visibleVideos = useMemo(() => {
    const safeAll = Array.isArray(allVideos) ? allVideos : [];

    if (feedFilter === 'offline' || isOfflineSimulated) {
      return safeAll.filter((v) => downloadedVideoIds.has(v.id));
    }

    return safeAll;
  }, [allVideos, feedFilter, isOfflineSimulated, downloadedVideoIds]);

  // Handle Video Download to IndexedDB
  const handleDownloadVideo = async (video: VideoItem) => {
    if (downloadedVideoIds.has(video.id)) {
      showToast('এই ভিডিওটি ইতিমধ্যে অফলাইনে সংরক্ষিত আছে!', 'info');
      return;
    }

    showToast(`"${video.title.substring(0, 20)}..." ডাউনলোড শুরু হয়েছে...`, 'info');
    setDownloadProgressMap((prev) => ({ ...prev, [video.id]: 5 }));

    try {
      const objUrl = await downloadAndSaveVideo(video, (percent) => {
        setDownloadProgressMap((prev) => ({ ...prev, [video.id]: percent }));
      });

      // Update state
      setDownloadedVideoIds((prev) => new Set([...prev, video.id]));
      setAllVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, objectUrl: objUrl } : v))
      );

      confetti({
        particleCount: 35,
        spread: 70,
        origin: { y: 0.8, x: 0.8 },
      });

      showToast('সফলভাবে অফলাইন স্টোরেজে সেভ হয়েছে! ইন্টারনেট ছাড়াই চলবে।', 'success');
    } catch (err) {
      showToast(`ডাউনলোড ব্যর্থ হয়েছে: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setTimeout(() => {
        setDownloadProgressMap((prev) => {
          const next = { ...prev };
          delete next[video.id];
          return next;
        });
      }, 1500);
    }
  };

  // Handle Share
  const handleShareVideo = async (video: VideoItem) => {
    const shareUrl = window.location.href;
    const shareData = {
      title: `SnipTok: ${video.title}`,
      text: `${video.title} - দেখুন SnipTok এ! ${video.caption}`,
      url: shareUrl,
    };

    if (navigator.share && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        showToast('ভিডিও শেয়ার করা হয়েছে!', 'success');
      } catch {
        // Dismissed or unsupported
      }
    } else {
      // Fallback copy to clipboard
      try {
        await navigator.clipboard.writeText(`${video.title}\n${shareUrl}`);
        showToast('ভিডিও লিঙ্ক ক্লিপবোর্ডে কপি করা হয়েছে!', 'success');
      } catch {
        showToast('লিঙ্ক কপি করা সম্ভব হয়নি।', 'error');
      }
    }
  };

  // Handle Save / Update Videos from Admin Studio
  const handleSaveVideos = async (updatedVideos: VideoItem[], notifyMsg?: string) => {
    const safeList = Array.isArray(updatedVideos) ? updatedVideos : [];
    setAllVideos(safeList);

    // 1. Save locally
    try {
      const cleanForStorage = safeList.map(({ objectUrl, loadError, ...rest }) => rest);
      localStorage.setItem('sniptok_custom_videos_list', JSON.stringify(cleanForStorage));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }

    // 2. Push to Cloud Sync so all phones update
    try {
      pushVideosToCloud(safeList, undefined, 'Ma44332211');
    } catch (cloudErr) {
      console.warn('Auto cloud push error on save:', cloudErr);
    }

    if (notifyMsg) {
      showToast(notifyMsg, 'success');
    }
  };

  // Play video from storage manager directly in feed
  const handlePlayVideoFromStorage = (videoId: string) => {
    const targetIdx = visibleVideos.findIndex((v) => v.id === videoId);
    if (targetIdx !== -1) {
      setActiveIndex(targetIdx);
    } else {
      // If currently in all filter, switch filter or jump
      const allIdx = allVideos.findIndex((v) => v.id === videoId);
      if (allIdx !== -1) {
        setFeedFilter('all');
        setActiveIndex(allIdx);
      }
    }
  };

  // Update downloaded count refresh
  const refreshStorageState = async () => {
    try {
      const ids = await getAllDownloadedVideoIds();
      setDownloadedVideoIds(new Set(ids));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] bg-zinc-950 text-zinc-100 overflow-hidden select-none font-sans">
      {/* Vertical Reels Snap Feed */}
      <FeedContainer
        videos={visibleVideos}
        allVideosCount={allVideos.length}
        offlineVideosCount={downloadedVideoIds.size}
        feedFilter={feedFilter}
        onChangeFilter={(f) => {
          setFeedFilter(f);
          setActiveIndex(0);
        }}
        isOfflineSimulated={isOfflineSimulated}
        onToggleOfflineSimulator={() => {
          setIsOfflineSimulated((prev) => !prev);
          showToast(
            !isOfflineSimulated
              ? 'অফলাইন মোড সিমুলেটর চালু হয়েছে (WiFi বন্ধ)'
              : 'অনলাইন মোডে ফিরে এসেছে',
            'info'
          );
        }}
        isDeviceOnline={isDeviceOnline}
        onOpenStorageModal={() => setIsStorageModalOpen(true)}
        onOpenAdminStudio={() => setIsAdminStudioOpen(true)}
        onOpenComments={(v) => setActiveCommentsVideo(v)}
        onShareVideo={handleShareVideo}
        onDownloadVideo={handleDownloadVideo}
        downloadedVideoIds={downloadedVideoIds}
        downloadProgressMap={downloadProgressMap}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />

      {/* Floating PWA Install Prompt (Android & iOS) */}
      <PWAInstallBanner />

      {/* Slide-up Comments Drawer */}
      {activeCommentsVideo && (
        <CommentsDrawer
          isOpen={!!activeCommentsVideo}
          onClose={() => setActiveCommentsVideo(null)}
          videoId={activeCommentsVideo.id}
          videoTitle={activeCommentsVideo.title}
          onCommentCountUpdate={(vId, count) => {
            setAllVideos((prev) =>
              prev.map((v) => (v.id === vId ? { ...v, commentsCount: count } : v))
            );
          }}
        />
      )}

      {/* Storage Manager Modal */}
      <StorageManagerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        videos={allVideos}
        onPlayVideo={handlePlayVideoFromStorage}
        onStorageChanged={refreshStorageState}
        onShowToast={showToast}
      />

      {/* Admin Creator Studio (1 to 100 slots, Dropbox Parser, GitHub Live Sync) */}
      <AdminStudioModal
        isOpen={isAdminStudioOpen}
        onClose={() => setIsAdminStudioOpen(false)}
        videos={allVideos}
        onSaveVideos={handleSaveVideos}
        onPlayVideoInFeed={(vId) => {
          const idx = allVideos.findIndex((v) => v.id === vId);
          if (idx !== -1) {
            setFeedFilter('all');
            setActiveIndex(idx);
          }
        }}
      />

      {/* Toast Notifications */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 border animate-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/60'
                : toast.type === 'error'
                ? 'bg-red-950/90 text-red-200 border-red-700/60'
                : 'bg-zinc-900/90 text-zinc-100 border-zinc-700/60'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                toast.type === 'success'
                  ? 'bg-emerald-400'
                  : toast.type === 'error'
                  ? 'bg-red-400'
                  : 'bg-rose-400'
              }`}
            />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
