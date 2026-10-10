import React from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

interface IOSInstallGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallGuide: React.FC<IOSInstallGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-zinc-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <span className="text-xl font-black text-white">S</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">SnipTok অ্যাপ ইনস্টল করুন</h3>
            <p className="text-xs text-zinc-400">iPhone / iPad Safari ব্রাউজার</p>
          </div>
        </div>

        <div className="space-y-3.5 my-5 text-sm text-zinc-300">
          <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/40">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Share className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white">১. Safari এর Share বাটনে ট্যাপ করুন</p>
              <p className="text-xs text-zinc-400 mt-0.5">নিচের টুলবারের মাঝের শেয়ার আইকনটি চাপুন</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/40">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <PlusSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-white">২. "Add to Home Screen" বেছে নিন</p>
              <p className="text-xs text-zinc-400 mt-0.5">মেনু স্ক্রোল করে 'Add to Home Screen' চাপুন</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm transition active:scale-98 cursor-pointer"
        >
          বুঝেছি (Close)
        </button>
      </div>
    </div>
  );
};
