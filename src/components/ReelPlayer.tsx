import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Download,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Music,
  Plus,
  Check,
  Sparkles,
  Disc3,
  AlertTriangle,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VideoItem } from '../types';
import { getAlternativeVideoUrls } from '../utils/urlParser';

interface ReelPlayerProps {
  video: VideoItem;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenComments: (video: VideoItem) => void;
  onShare: (video: VideoItem) => void;
  onDownload: (video: VideoItem) => void;
  isDownloaded: boolean;
  downloadProgress?: number; // 0 - 100 if downloading
  isDownloading?: boolean;
  onLikeToggle?: (videoId: string, isLiked: boolean) => void;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

export const ReelPlayer: React.FC<ReelPlayerProps> = ({
  video,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
  onShare,
  onDownload,
  isDownloaded,
  downloadProgress = 0,
  isDownloading = false,
  onLikeToggle,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Multi-fallback candidate streaming URLs (raw=1, dl=1, direct)
  const candidateUrls = useMemo(() => {
    if (video.objectUrl) return [video.objectUrl];
    return getAlternativeVideoUrls(video.url);
  }, [video.objectUrl, video.url]);

  const [currentUrlIndex, setCurrentUrlIndex] = useState<number>(0);

  // Reset candidate index when video ID or main URL changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setVideoError(null);
  }, [video.id, video.url]);

  const activeSourceUrl = candidateUrls[currentUrlIndex] || video.objectUrl || video.url;

  const [isLiked, setIsLiked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`sniptok_liked_${video.id}`) === 'true';
    } catch {
      return false;
    }
  });
  const [likesCount, setLikesCount] = useState<number>(video.likes || 0);

  const [isFollowed, setIsFollowed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`sniptok_followed_${video.creatorHandle}`) === 'true';
    } catch {
      return false;
    }
  });

  const [progress, setProgress] = useState<number>(0);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [showPlayIcon, setShowPlayIcon] = useState<boolean>(false);
  const [playIconState, setPlayIconState] = useState<'play' | 'pause'>('play');

  // Double tap detection and cleanup refs
  const lastTapRef = useRef<number>(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimerMapRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      heartTimerMapRef.current.forEach((timer) => clearTimeout(timer));
      heartTimerMapRef.current.clear();
    };
  }, []);

  // Safe playback with browser autoplay rejection policy fallback
  const attemptPlayback = useCallback((el: HTMLVideoElement, mutedState: boolean) => {
    el.muted = mutedState;
    const playPromise = el.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          setVideoError(null);
        })
        .catch((err: Error) => {
          console.warn('Autoplay error detected:', err.message);

          // If unmuted autoplay was rejected by browser policy, fallback automatically to muted play!
          if (!el.muted) {
            el.muted = true;
            el.play()
              .then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
                setVideoError(null);
              })
              .catch(() => {
                setIsPlaying(false);
                setIsBuffering(false);
              });
          } else {
            setIsPlaying(false);
            setIsBuffering(false);
          }
        });
    }
  }, []);

  // Handle active video state changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isActive) {
      setVideoError(null);
      attemptPlayback(el, isMuted);
    } else {
      el.pause();
      el.currentTime = 0;
      setIsPlaying(false);
      setIsBuffering(false);
    }
  }, [isActive, isMuted, attemptPlayback]);

  // Sync mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Update time progress
  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (el && el.duration && isFinite(el.duration) && el.duration > 0) {
      setProgress((el.currentTime / el.duration) * 100);
    }
  };

  // Video Events
  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
    setVideoError(null);
  };
  const handleCanPlay = () => setIsBuffering(false);

  // Video Error Handler with automatic fallback cycling and detailed diagnosis
  const handleVideoError = () => {
    const el = videoRef.current;
    setIsBuffering(false);
    setIsPlaying(false);

    // If another candidate URL exists (e.g. dl=1 instead of raw=1 or direct), try it automatically!
    if (currentUrlIndex + 1 < candidateUrls.length) {
      console.log(`Primary URL failed, auto-trying fallback ${currentUrlIndex + 1}/${candidateUrls.length}`);
      setCurrentUrlIndex((prev) => prev + 1);
      setIsBuffering(true);
      return;
    }

    let errorDetail = 'ভিডিওটি লোড করা যাচ্ছে না।';
    if (el?.error) {
      switch (el.error.code) {
        case MediaError.MEDIA_ERR_NETWORK:
          errorDetail = 'নেটওয়ার্ক সংযোগ ত্রুটি। ইন্টারনেট বা ড্রপবক্স ব্যান্ডউইথ চেক করুন।';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorDetail = 'ভিডিও ফরম্যাট বা CORS স্ট্রিম সাপোর্ট করছে না। ড্রপবক্স লিংকটি "Anyone with link can view" শেয়ার করা কিনা এবং Brave Shields চেক করুন।';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorDetail = 'ভিডিও ডিকোড ত্রুটি হয়েছে।';
          break;
        default:
          errorDetail = 'মিডিয়া স্ট্রিম লোড করতে সমস্যা হয়েছে।';
      }
    }
    setVideoError(errorDetail);
  };

  // Manual Retry
  const handleRetryLoad = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = videoRef.current;
    if (el) {
      setVideoError(null);
      setIsBuffering(true);
      // Reset back to primary candidate or next
      setCurrentUrlIndex(0);
      el.load();
      attemptPlayback(el, isMuted);
    }
  };

  // Trigger floating heart
  const spawnHeart = (clientX?: number, clientY?: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = clientX && rect ? clientX - rect.left : (rect?.width || 300) / 2;
    const y = clientY && rect ? clientY - rect.top : (rect?.height || 500) / 2;

    const heartId = Date.now() + Math.random();
    const newHeart: FloatingHeart = {
      id: heartId,
      x,
      y,
    };

    setFloatingHearts((prev) => [...prev, newHeart]);

    const timer = setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== heartId));
      heartTimerMapRef.current.delete(heartId);
    }, 1000);

    heartTimerMapRef.current.set(heartId, timer);
  };

  // Like Toggle
  const handleLikeClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const nextLiked = !isLiked;
      setIsLiked(nextLiked);
      const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
      setLikesCount(nextCount);

      try {
        if (nextLiked) {
          localStorage.setItem(`sniptok_liked_${video.id}`, 'true');
          spawnHeart();
          confetti({
            particleCount: 30,
            spread: 60,
            origin: { y: 0.7, x: 0.85 },
            colors: ['#f43f5e', '#fb7185', '#fda4af'],
          });
        } else {
          localStorage.removeItem(`sniptok_liked_${video.id}`);
        }
      } catch (err) {
        console.warn('LocalStorage like save error:', err);
      }

      onLikeToggle?.(video.id, nextLiked);
    },
    [isLiked, likesCount, video.id, onLikeToggle]
  );

  // Follow Toggle
  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isFollowed;
    setIsFollowed(next);
    try {
      if (next) {
        localStorage.setItem(`sniptok_followed_${video.creatorHandle}`, 'true');
      } else {
        localStorage.removeItem(`sniptok_followed_${video.creatorHandle}`);
      }
    } catch (err) {
      console.warn('LocalStorage follow save error:', err);
    }
  };

  // Double tap / Single tap handler on video viewport
  const handleViewportTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected!
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      spawnHeart(e.clientX, e.clientY);
      if (!isLiked) {
        handleLikeClick();
      }
      lastTapRef.current = 0;
    } else {
      // Single tap
      lastTapRef.current = now;
      clickTimeoutRef.current = setTimeout(() => {
        // Toggle play/pause
        const el = videoRef.current;
        if (el) {
          if (el.paused) {
            el.play()
              .then(() => {
                setIsPlaying(true);
                setPlayIconState('play');
                triggerRippleIcon();
              })
              .catch(() => {
                setIsPlaying(false);
              });
          } else {
            el.pause();
            setIsPlaying(false);
            setPlayIconState('pause');
            triggerRippleIcon();
          }
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const triggerRippleIcon = () => {
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  };

  // Timeline scrub
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const el = videoRef.current;
    if (el && el.duration && isFinite(el.duration)) {
      el.currentTime = ratio * el.duration;
      setProgress(ratio * 100);
    }
  };

  // Video source preference: Object URL (cached blob) or network active candidate
  const videoSource = activeSourceUrl;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full snap-item bg-zinc-950 flex items-center justify-center overflow-hidden select-none"
      onClick={handleViewportTap}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSource}
        loop
        playsInline
        webkit-playsinline="true"
        preload={isActive ? 'auto' : 'none'}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onCanPlay={handleCanPlay}
        onError={handleVideoError}
        className="w-full h-full object-cover sm:object-contain sm:max-w-md mx-auto pointer-events-none"
      />

      {/* Buffering Indicator */}
      {isBuffering && !videoError && isActive && (
        <div className="absolute z-20 pointer-events-none flex flex-col items-center gap-2 p-3 rounded-2xl bg-black/40 backdrop-blur-xs">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-[11px] font-medium text-zinc-300">বাফারিং হচ্ছে...</span>
        </div>
      )}

      {/* Video Error Overlay */}
      {videoError && isActive && (
        <div
          className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-zinc-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 mb-3">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">ভিডিও প্লে করতে ব্যর্থ</h3>
          <p className="text-xs text-zinc-400 max-w-xs mb-4 leading-relaxed">{videoError}</p>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-xs">
            <button
              onClick={handleRetryLoad}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-95 min-h-[42px]"
            >
              <RotateCcw className="w-4 h-4" />
              আবার চেষ্টা করুন (Retry)
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(video);
              }}
              disabled={isDownloading || isDownloaded}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 transition cursor-pointer active:scale-95 min-h-[42px]"
            >
              <Download className="w-4 h-4 text-rose-400" />
              {isDownloaded ? 'সংরক্ষিত আছে' : isDownloading ? `ডাউনলোড হচ্ছে (${downloadProgress}%)` : 'অফলাইনে সেভ করুন'}
            </button>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 text-left space-y-1.5 max-w-xs w-full">
            <p className="font-semibold text-zinc-200 flex items-center gap-1">
              <span>💡 দ্রুত সমাধান টিপস:</span>
            </p>
            <p className="text-zinc-400 leading-normal">
              ১. <strong>Dropbox লিংক:</strong> ড্রপবক্স ফাইলে গিয়ে <em>Share &gt; "Anyone with link can view"</em> নিশ্চিত করে লিংক কপি করুন।
            </p>
            <p className="text-zinc-400 leading-normal">
              ২. <strong>Brave ব্রাউজার:</strong> উপরে সিংহ আইকনে ট্যাপ করে <em>Brave Shields সাময়িক বন্ধ</em> করে সাইটটি রিফ্রেশ দিন।
            </p>
          </div>
        </div>
      )}

      {/* Floating Heart Burst elements from double taps */}
      {floatingHearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute z-30 pointer-events-none animate-heart-pop text-rose-500 drop-shadow-lg"
          style={{ left: heart.x, top: heart.y }}
        >
          <Heart className="w-20 h-20 fill-rose-500 text-rose-500" />
        </div>
      ))}

      {/* Play / Pause temporary ripple indicator */}
      {showPlayIcon && (
        <div className="absolute z-20 pointer-events-none p-4 rounded-full bg-black/50 backdrop-blur-xs text-white animate-in zoom-in-75 duration-200">
          {playIconState === 'pause' ? (
            <Pause className="w-12 h-12 fill-white" />
          ) : (
            <Play className="w-12 h-12 fill-white" />
          )}
        </div>
      )}

      {/* Mute indicator badge on top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-16 right-4 z-20 min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition cursor-pointer active:scale-90 flex items-center justify-center"
        title={isMuted ? 'সাউন্ড অন করুন (m)' : 'মিউট করুন (m)'}
        aria-label="শব্দ নিয়ন্ত্রণ"
      >
        {isMuted ? <VolumeX className="w-5 h-5 text-zinc-300" /> : <Volume2 className="w-5 h-5 text-rose-400" />}
      </button>

      {/* RIGHT SIDE ACTION BAR (TikTok / Reels Style) */}
      <div
        className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4.5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Creator Avatar & Follow button */}
        <div className="relative mb-1">
          <img
            src={video.creatorAvatar}
            alt={video.creator}
            className="w-12 h-12 rounded-full border-2 border-white object-cover shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
            }}
          />
          <button
            onClick={handleFollowClick}
            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white transition active:scale-90 shadow-md cursor-pointer ${
              isFollowed ? 'bg-zinc-700 text-zinc-300' : 'bg-rose-600 hover:bg-rose-500'
            }`}
            title={isFollowed ? 'অনুসরণ করা হয়েছে' : 'অনুসরণ করুন'}
            aria-label="অনুসরণ"
          >
            {isFollowed ? <Check className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleLikeClick}
            className={`min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-black/30 backdrop-blur-md transition active:scale-75 cursor-pointer flex items-center justify-center ${
              isLiked ? 'text-rose-500' : 'text-white hover:text-rose-300'
            }`}
            aria-label="লাইক"
          >
            <Heart
              className={`w-7 h-7 transition-transform ${
                isLiked ? 'fill-rose-500 text-rose-500 scale-110' : ''
              }`}
            />
          </button>
          <span className="text-xs font-semibold text-zinc-200 mt-1 drop-shadow-md">
            {likesCount > 999 ? `${(likesCount / 1000).toFixed(1)}k` : likesCount}
          </span>
        </div>

        {/* Comments Trigger */}
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(video);
            }}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-black/30 backdrop-blur-md text-white hover:text-rose-300 transition active:scale-75 cursor-pointer flex items-center justify-center"
            aria-label="মন্তব্যসমূহ"
          >
            <MessageCircle className="w-7 h-7" />
          </button>
          <span className="text-xs font-semibold text-zinc-200 mt-1 drop-shadow-md">
            {video.commentsCount || 0}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(video);
            }}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-full bg-black/30 backdrop-blur-md text-white hover:text-rose-300 transition active:scale-75 cursor-pointer flex items-center justify-center"
            aria-label="শেয়ার করুন"
          >
            <Share2 className="w-7 h-7" />
          </button>
          <span className="text-xs font-semibold text-zinc-200 mt-1 drop-shadow-md">শেয়ার</span>
        </div>

        {/* Offline Download Button with Progress % */}
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(video);
            }}
            disabled={isDownloading}
            className={`min-w-[44px] min-h-[44px] relative p-2.5 rounded-full backdrop-blur-md transition active:scale-75 cursor-pointer flex items-center justify-center ${
              isDownloaded
                ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                : isDownloading
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-black/30 text-white hover:text-rose-300'
            }`}
            title={
              isDownloaded
                ? 'অফলাইনে ক্যাশ করা হয়েছে (ইন্টারনেট ছাড়াই চলবে)'
                : isDownloading
                ? `ডাউনলোড হচ্ছে: ${downloadProgress}%`
                : 'অফলাইনে দেখার জন্য ডাউনলোড করুন'
            }
            aria-label="অফলাইন ডাউনলোড"
          >
            {isDownloaded ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-400 fill-emerald-500/20" />
            ) : isDownloading ? (
              <div className="relative w-7 h-7 flex items-center justify-center">
                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-zinc-700"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-rose-500"
                    strokeDasharray={`${downloadProgress}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[8px] font-mono font-bold text-white">
                  {downloadProgress}%
                </span>
              </div>
            ) : (
              <Download className="w-7 h-7" />
            )}
          </button>
          <span className="text-[10px] font-semibold text-zinc-300 mt-1 drop-shadow-md">
            {isDownloaded ? 'ক্যাশড' : isDownloading ? `${downloadProgress}%` : 'অফলাইন'}
          </span>
        </div>

        {/* Rotating Music Disc */}
        <div className="relative mt-1">
          <div
            className={`w-10 h-10 rounded-full bg-zinc-900 border-2 border-zinc-700 p-1 flex items-center justify-center shadow-lg ${
              isPlaying ? 'animate-spin-disc' : 'animate-spin-disc-paused'
            }`}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-rose-600 via-zinc-800 to-rose-400 flex items-center justify-center">
              <Disc3 className="w-4 h-4 text-white" />
            </div>
          </div>
          {/* Animated floating music note */}
          {isPlaying && (
            <div className="absolute -top-3 -right-2 text-rose-400 pointer-events-none animate-note">
              <Music className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM OVERLAY INFO (Creator handle, caption, music marquee) */}
      <div
        className="absolute left-0 bottom-4 right-18 z-20 px-4 text-white pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-auto space-y-1.5 max-w-md">
          {/* Creator & verified */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white drop-shadow-md">
              {video.creatorHandle || '@' + video.creator}
            </span>
            <span className="p-0.5 rounded-full bg-rose-500 text-white" title="ভেরিফাইড ক্রিয়েটর">
              <Sparkles className="w-2.5 h-2.5" />
            </span>
            {video.isLocalCustom && (
              <span className="text-[10px] bg-zinc-800/80 px-1.5 py-0.5 rounded text-rose-300 font-mono">
                কাস্টম স্লট
              </span>
            )}
            {isDownloaded && (
              <span className="text-[10px] bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-2.5 h-2.5" />
                অফলাইন প্রস্তুত
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-sm font-semibold text-zinc-100 drop-shadow-md leading-tight line-clamp-2">
            {video.title}
          </h2>

          {/* Caption with hashtags */}
          <p className="text-xs text-zinc-200/90 drop-shadow leading-relaxed line-clamp-2">
            {video.caption}
          </p>

          {/* Audio track marquee */}
          <div className="flex items-center gap-2 pt-1 text-xs text-zinc-300">
            <Music className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <div className="overflow-hidden whitespace-nowrap w-48">
              <div className="inline-block animate-marquee font-mono text-[11px]">
                {video.audioTrack || 'Original Audio - SnipTok Exclusive'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM PROGRESS SCRUBBER BAR */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800/60 z-30 cursor-pointer group"
        onClick={handleScrub}
      >
        <div
          className="h-full bg-rose-600 transition-all duration-100 relative group-hover:h-2"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow-md" />
        </div>
      </div>
    </div>
  );
};
