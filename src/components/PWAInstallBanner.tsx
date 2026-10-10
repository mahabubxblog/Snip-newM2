import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { IOSInstallGuide } from './IOSInstallGuide';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // If already running standalone or user dismissed, don't show
  if (isInstalled || isDismissed) {
    return null;
  }

  // If Android/Chromium install prompt is available
  if (isInstallable) {
    return (
      <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 z-40 max-w-sm bg-zinc-900/95 border border-zinc-700/80 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-zinc-100 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white shrink-0 shadow-md">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">SnipTok অ্যাপ ইনস্টল করুন</h4>
            <p className="text-[11px] text-zinc-400 truncate">ফুলস্ক্রিন ও অফলাইন স্পিড পেতে</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={install}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition shadow-md shadow-rose-600/30 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            ইনস্টল
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            aria-label="বাদ দিন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // If iOS Safari
  if (isIOS) {
    return (
      <>
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 z-40 max-w-sm bg-zinc-900/95 border border-zinc-700/80 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-zinc-100 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center text-white shrink-0 shadow-md">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-white truncate">হোম স্ক্রিনে রাখুন</h4>
              <p className="text-[11px] text-zinc-400 truncate">iPhone এ নেটিভ অ্যাপের মতো চালান</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              নিয়মাবলী
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              aria-label="বাদ দিন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <IOSInstallGuide isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
      </>
    );
  }

  return null;
};
