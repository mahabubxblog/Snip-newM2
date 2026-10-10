import React, { useState, useEffect } from 'react';
import { X, Send, Heart, MessageCircle } from 'lucide-react';
import { CommentItem } from '../types';
import { getCommentsByVideoId, addCommentToStorage, toggleCommentLike } from '../utils/indexedDB';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  onCommentCountUpdate?: (videoId: string, count: number) => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  onCommentCountUpdate,
}) => {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [authorName, setAuthorName] = useState(() => {
    try {
      return localStorage.getItem('sniptok_user_name') || 'অতিথি দর্শক';
    } catch {
      return 'অতিথি দর্শক';
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Load comments whenever drawer opens or videoId changes
  useEffect(() => {
    if (!isOpen || !videoId) return;

    let isMounted = true;
    const loadComments = async () => {
      try {
        const stored = await getCommentsByVideoId(videoId);
        if (!isMounted) return;

        // If no stored comments yet, seed default interactive comments for rich experience
        if (stored.length === 0) {
          const initialSeeds: CommentItem[] = [
            {
              id: `seed-1-${videoId}`,
              videoId,
              author: 'রাহাত করিম',
              authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
              text: 'অসাধারণ শট! ভিডিও কোয়ালিটি অনেক স্মুথ 🔥❤️',
              createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
              likes: 12,
            },
            {
              id: `seed-2-${videoId}`,
              videoId,
              author: 'নুসরাত জাহান',
              authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
              text: 'অফলাইনেও ডাউনলোড করে দেখলাম, এক সেকেন্ডেও বাফারিং নাই! ধন্যবাদ SnipTok টিম 👍',
              createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
              likes: 8,
            },
          ];

          for (const c of initialSeeds) {
            if (!isMounted) return;
            await addCommentToStorage(c);
          }

          if (isMounted) {
            setComments(initialSeeds);
            onCommentCountUpdate?.(videoId, initialSeeds.length);
          }
        } else {
          setComments(stored);
          onCommentCountUpdate?.(videoId, stored.length);
        }
      } catch (err) {
        console.warn('Error loading comments:', err);
      }
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [isOpen, videoId, onCommentCountUpdate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newComment: CommentItem = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        videoId,
        author: authorName.trim() || 'দর্শনার্থী',
        authorAvatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authorName)}`,
        text: inputText.trim(),
        createdAt: new Date().toISOString(),
        likes: 0,
      };

      await addCommentToStorage(newComment);
      const updated = [newComment, ...comments];
      setComments(updated);
      setInputText('');

      try {
        localStorage.setItem('sniptok_user_name', authorName.trim());
      } catch (storageErr) {
        console.warn('LocalStorage author name error:', storageErr);
      }

      onCommentCountUpdate?.(videoId, updated.length);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    try {
      const updated = await toggleCommentLike(commentId);
      if (updated) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? updated : c))
        );
      }
    } catch (err) {
      console.warn('Failed to like comment:', err);
    }
  };

  const formatBengaliTime = (isoString: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diff < 60) return 'এইমাত্র';
      if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
      return `${Math.floor(diff / 86400)} দিন আগে`;
    } catch {
      return 'সম্প্রতি';
    }
  };

  if (!isOpen) return null;

  const safeComments = Array.isArray(comments) ? comments : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-xs transition-opacity duration-300">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Body */}
      <div
        className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-800 rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh] min-h-[50vh] text-zinc-100 z-10 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle pill */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-base text-white">মন্তব্যসমূহ ({safeComments.length})</h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video context badge */}
        <div className="px-5 py-2 bg-zinc-950/60 text-xs text-zinc-400 truncate border-b border-zinc-800/40">
          ভিডিও: <span className="text-zinc-200 font-medium">{videoTitle}</span>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {safeComments.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30 text-rose-500" />
              <p className="text-sm">এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্যটি আপনিই করুন!</p>
            </div>
          ) : (
            safeComments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3 text-sm group">
                <img
                  src={
                    comment.authorAvatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(comment.author)}`
                  }
                  alt={comment.author}
                  className="w-9 h-9 rounded-full object-cover bg-zinc-800 border border-zinc-700/60 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200 text-xs">{comment.author}</span>
                    <span className="text-[10px] text-zinc-500">
                      {formatBengaliTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-zinc-300 text-sm mt-0.5 leading-snug break-words">
                    {comment.text}
                  </p>
                </div>
                <button
                  onClick={() => handleLike(comment.id)}
                  className={`min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-xs transition cursor-pointer ${
                    comment.isLiked ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  aria-label="লাইক"
                >
                  <Heart
                    className={`w-4 h-4 ${comment.isLiked ? 'fill-rose-500 text-rose-500 scale-110' : ''}`}
                  />
                  <span className="text-[10px]">{comment.likes || 0}</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Comment input form */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/90 pb-6 sm:pb-3">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="আপনার নাম (ঐচ্ছিক)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-32 px-2.5 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
              />
              <span className="text-[11px] text-zinc-500 truncate">
                অফলাইনে IndexedDB তে সেভ হবে
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="একটি চমৎকার মন্তব্য লিখুন..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                maxLength={300}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSubmitting}
                className="min-w-[44px] min-h-[44px] p-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-xl transition cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                aria-label="পাঠান"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
