import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  LogOut,
  ListVideo,
  PlusCircle,
  Github,
  Play,
  Trash2,
  Edit3,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Sparkles,
  ArrowUp,
  ArrowDown,
  CloudDownload,
} from 'lucide-react';
import { GitHubSyncConfig, VideoItem } from '../types';
import { normalizeVideoUrl } from '../utils/urlParser';
import {
  verifyGitHubRepo,
  commitVideosListToGitHub,
  fetchRemoteVideosFromGitHub,
} from '../utils/githubSync';

interface AdminStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  onSaveVideos: (updatedVideos: VideoItem[], notifyMsg?: string) => Promise<void>;
  onPlayVideoInFeed: (videoId: string) => void;
}

export const AdminStudioModal: React.FC<AdminStudioModalProps> = ({
  isOpen,
  onClose,
  videos,
  onSaveVideos,
  onPlayVideoInFeed,
}) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sniptok_admin_is_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Active tab: 'list' | 'edit' | 'github'
  const [activeTab, setActiveTab] = useState<'list' | 'edit' | 'github'>('list');

  // Video Form state
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    caption: '',
    url: '',
    creator: 'মাহাবুব আহমেদ',
    creatorHandle: '@mahabub_creator',
    creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    audioTrack: 'Original Sound - SnipTok Beats',
  });
  const [parsedPreview, setParsedPreview] = useState<{
    directUrl: string;
    provider: string;
    isValid: boolean;
    notes: string;
  } | null>(null);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // GitHub Sync state
  const [githubConfig, setGithubConfig] = useState<GitHubSyncConfig>(() => {
    try {
      const saved = localStorage.getItem('sniptok_github_config');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      owner: 'mahabubxblog',
      repo: 'mahabubxblog.github.io',
      token: '',
      branch: 'main',
      filePath: 'public/videos.json',
    };
  });
  const [isVerifyingGh, setIsVerifyingGh] = useState(false);
  const [ghVerifyResult, setGhVerifyResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSyncingGh, setIsSyncingGh] = useState(false);
  const [ghSyncResult, setGhSyncResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isPullingGh, setIsPullingGh] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

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

  // Sync GitHub config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sniptok_github_config', JSON.stringify(githubConfig));
    } catch {
      // ignore
    }
  }, [githubConfig]);

  // Update parsed video preview when URL input changes
  useEffect(() => {
    if (formData.url.trim()) {
      const res = normalizeVideoUrl(formData.url);
      setParsedPreview(res);
    } else {
      setParsedPreview(null);
    }
  }, [formData.url]);

  // Handle Admin Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === 'Ma44332211') {
      setIsAuthenticated(true);
      try {
        localStorage.setItem('sniptok_admin_is_auth', 'true');
      } catch {
        // In private browsing, in-memory auth still functions
      }
      setAuthError('');
      setPasswordInput('');
    } else {
      setAuthError('ভুল পাসওয়ার্ড! সঠিক অ্যাডমিন পাসওয়ার্ড ("Ma44332211") প্রদান করুন।');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('sniptok_admin_is_auth');
    } catch {
      // ignore
    }
    setActiveTab('list');
  };

  // Switch to edit existing video
  const startEditing = (video: VideoItem) => {
    setEditingVideoId(video.id);
    setFormData({
      title: video.title,
      caption: video.caption,
      url: video.originalUrl || video.url,
      creator: video.creator,
      creatorHandle: video.creatorHandle,
      creatorAvatar: video.creatorAvatar,
      audioTrack: video.audioTrack,
    });
    setFormMsg(null);
    setActiveTab('edit');
  };

  // Reset form for adding new video
  const startAddNew = () => {
    setEditingVideoId(null);
    setFormData({
      title: '',
      caption: '#shorts #viral #bangla',
      url: '',
      creator: 'মাহাবুব আহমেদ',
      creatorHandle: '@mahabub_creator',
      creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      audioTrack: 'Original Sound - SnipTok Beats',
    });
    setFormMsg(null);
    setActiveTab('edit');
  };

  // Move video up in slot order
  const moveVideoUp = async (index: number) => {
    if (index <= 0) return;
    const safeList = [...videos];
    const temp = safeList[index];
    safeList[index] = safeList[index - 1];
    safeList[index - 1] = temp;
    await onSaveVideos(safeList, 'ভিডিও স্লটের ক্রম পরিবর্তন করা হয়েছে!');
    if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
      triggerGitHubSync(safeList);
    }
  };

  // Move video down in slot order
  const moveVideoDown = async (index: number) => {
    if (index >= videos.length - 1) return;
    const safeList = [...videos];
    const temp = safeList[index];
    safeList[index] = safeList[index + 1];
    safeList[index + 1] = temp;
    await onSaveVideos(safeList, 'ভিডিও স্লটের ক্রম পরিবর্তন করা হয়েছে!');
    if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
      triggerGitHubSync(safeList);
    }
  };

  // Save / Update video
  const handleSaveVideoForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.url.trim()) {
      setFormMsg({ type: 'error', text: 'ভিডিও শিরোনাম এবং ভিডিওর লিংক আবশ্যক।' });
      return;
    }

    const parsed = normalizeVideoUrl(formData.url);
    const directUrl = parsed.isValid ? parsed.directUrl : formData.url.trim();

    let updatedList: VideoItem[];
    if (editingVideoId) {
      // Update existing
      updatedList = videos.map((v) => {
        if (v.id === editingVideoId) {
          return {
            ...v,
            title: formData.title.trim(),
            caption: formData.caption.trim(),
            url: directUrl,
            originalUrl: formData.url.trim(),
            creator: formData.creator.trim(),
            creatorHandle: formData.creatorHandle.trim(),
            creatorAvatar: formData.creatorAvatar.trim(),
            audioTrack: formData.audioTrack.trim(),
          };
        }
        return v;
      });
    } else {
      // Add new video slot (up to 100)
      if (videos.length >= 100) {
        setFormMsg({ type: 'error', text: 'সর্বোচ্চ ১০০ টি ভিডিও স্লট পূর্ণ হয়েছে!' });
        return;
      }

      const newVideo: VideoItem = {
        id: 'snip-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
        title: formData.title.trim(),
        caption: formData.caption.trim(),
        url: directUrl,
        originalUrl: formData.url.trim(),
        creator: formData.creator.trim() || 'ক্রিয়েটর',
        creatorHandle: formData.creatorHandle.trim() || '@creator',
        creatorAvatar: formData.creatorAvatar.trim() || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        audioTrack: formData.audioTrack.trim() || 'Original Sound',
        likes: Math.floor(Math.random() * 200) + 10,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        isLocalCustom: true,
      };

      updatedList = [newVideo, ...videos];
    }

    await onSaveVideos(updatedList, editingVideoId ? 'ভিডিও আপডেট করা হয়েছে!' : 'নতুন ভিডিও সফলভাবে যুক্ত হয়েছে!');
    setFormMsg({
      type: 'success',
      text: editingVideoId ? 'ভিডিও সফলভাবে আপডেট হয়েছে!' : 'নতুন ভিডিও সফলভাবে যুক্ত করা হয়েছে!',
    });

    // If GitHub token is configured, auto trigger commit
    if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
      triggerGitHubSync(updatedList);
    }

    setTimeout(() => {
      setActiveTab('list');
      setEditingVideoId(null);
    }, 1200);
  };

  // Delete video
  const handleDeleteVideo = async (videoId: string) => {
    if (confirm('আপনি কি এই ভিডিওটি স্লট থেকে মুছে ফেলতে চান?')) {
      const updatedList = videos.filter((v) => v.id !== videoId);
      await onSaveVideos(updatedList, 'ভিডিও স্লট থেকে মুছে ফেলা হয়েছে!');
      if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
        triggerGitHubSync(updatedList);
      }
    }
  };

  // GitHub token verification
  const handleVerifyGitHub = async () => {
    setIsVerifyingGh(true);
    setGhVerifyResult(null);
    try {
      const res = await verifyGitHubRepo(githubConfig);
      setGhVerifyResult(res);
    } catch (err) {
      setGhVerifyResult({
        success: false,
        message: 'যাচাইকালে সমস্যা হয়েছে: ' + String(err),
      });
    } finally {
      setIsVerifyingGh(false);
    }
  };

  // Pull live videos from GitHub
  const handlePullFromGitHub = async () => {
    setIsPullingGh(true);
    try {
      const res = await fetchRemoteVideosFromGitHub(githubConfig);
      if (res.success && res.data) {
        await onSaveVideos(res.data, res.message);
        alert(res.message);
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('GitHub থেকে পুল করতে ব্যর্থ: ' + String(err));
    } finally {
      setIsPullingGh(false);
    }
  };

  // Commit to GitHub REST API
  const triggerGitHubSync = async (listToCommit = videos) => {
    setIsSyncingGh(true);
    setGhSyncResult(null);
    try {
      const res = await commitVideosListToGitHub(githubConfig, listToCommit);
      setGhSyncResult(res);
    } catch (err) {
      setGhSyncResult({
        success: false,
        message: 'সিঙ্ক করার সময় সমস্যা: ' + String(err),
      });
    } finally {
      setIsSyncingGh(false);
    }
  };

  // Backup & Restore
  const handleDownloadJson = () => {
    const clean = videos.map(({ objectUrl, loadError, ...rest }) => rest);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(clean, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'videos.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = () => {
    const clean = videos.map(({ objectUrl, loadError, ...rest }) => rest);
    navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await onSaveVideos(parsed, `${parsed.length} টি ভিডিও ইমপোর্ট সম্পন্ন হয়েছে!`);
          alert(`${parsed.length} টি ভিডিও সফলভাবে ইমপোর্ট করা হয়েছে!`);
        } else {
          alert('অবৈধ JSON ফাইল ফরম্যাট।');
        }
      } catch (err) {
        alert('ফাইল রিড করতে ব্যর্থ: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const safeVideos = Array.isArray(videos) ? videos : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-100">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center font-bold text-white shadow-md shadow-rose-500/20">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">SnipTok Creator Studio</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono font-semibold">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-zinc-400">১ থেকে ১০০ ভিডিও স্লট ও গিটহাব লাইভ অটো-সিঙ্ক</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition cursor-pointer"
                title="লগআউট"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center"
              aria-label="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Not Authenticated -> Password Form */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
              <Lock className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">অ্যাডমিন অ্যাক্সেস আবশ্যক</h4>
            <p className="text-xs text-zinc-400 mb-6">
              ভিডিও আপলোড, ড্রপবক্স লিঙ্ক ম্যানেজ এবং GitHub লাইভ সিঙ্ক করতে গোপন অ্যাডমিন পাসওয়ার্ড প্রদান করুন।
            </p>

            <form onSubmit={handleLogin} className="w-full space-y-3">
              <div className="relative">
                <input
                  type="password"
                  placeholder="অ্যাডমিন পাসওয়ার্ড লিখুন..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 min-h-[44px]"
                  autoFocus
                />
              </div>

              {authError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5 justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-rose-600/30 cursor-pointer active:scale-98 min-h-[44px]"
              >
                লগইন করুন (Login)
              </button>

              <p className="text-[11px] text-zinc-500 pt-2">
                🔒 ১০০% ক্লায়েন্ট-সাইড ভেরিফিকেশন (নো সার্ভার ডিপেনডেন্সি)
              </p>
            </form>
          </div>
        ) : (
          /* Authenticated Admin Dashboard */
          <>
            {/* Dashboard Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-4 pt-2 gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => {
                  setActiveTab('list');
                  setEditingVideoId(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] ${
                  activeTab === 'list'
                    ? 'border-rose-500 text-rose-400 bg-zinc-900/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ListVideo className="w-4 h-4" />
                ভিডিও তালিকা ({safeVideos.length}/১০০)
              </button>

              <button
                onClick={startAddNew}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] ${
                  activeTab === 'edit'
                    ? 'border-rose-500 text-rose-400 bg-zinc-900/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                {editingVideoId ? 'ভিডিও এডিট' : '+ নতুন ভিডিও যোগ'}
              </button>

              <button
                onClick={() => setActiveTab('github')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] ${
                  activeTab === 'github'
                    ? 'border-rose-500 text-rose-400 bg-zinc-900/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Github className="w-4 h-4" />
                GitHub লাইভ সিঙ্ক
                {githubConfig.token && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: VIDEO LIST */}
            {activeTab === 'list' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar">
                <div className="flex items-center justify-between bg-zinc-800/40 p-3 rounded-xl border border-zinc-800">
                  <div className="text-xs text-zinc-400">
                    বর্তমানে মোট <strong className="text-white font-mono">{safeVideos.length}</strong> টি ভিডিও স্লট ব্যবহৃত হচ্ছে (সর্বোচ্চ ১০০ টি)।
                  </div>
                  <button
                    onClick={startAddNew}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition cursor-pointer min-h-[36px]"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    নতুন ভিডিও যুক্ত করুন
                  </button>
                </div>

                <div className="space-y-2">
                  {safeVideos.map((vid, idx) => (
                    <div
                      key={vid.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-400 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-zinc-100 truncate">
                            {vid.title}
                          </h4>
                          <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{vid.caption}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-mono">
                            <span className="text-rose-400">{vid.creator}</span>
                            <span>•</span>
                            <span className="truncate max-w-[200px]" title={vid.url}>
                              {vid.url}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Move Up / Down Buttons */}
                        <button
                          onClick={() => moveVideoUp(idx)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 text-xs transition cursor-pointer"
                          title="উপরে স্থানান্তর করুন"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveVideoDown(idx)}
                          disabled={idx === safeVideos.length - 1}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-20 text-zinc-300 text-xs transition cursor-pointer"
                          title="নিচে স্থানান্তর করুন"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            onPlayVideoInFeed(vid.id);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1 transition cursor-pointer min-h-[36px]"
                          title="প্লে করে দেখুন"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                          <span className="hidden sm:inline">টেস্ট</span>
                        </button>
                        <button
                          onClick={() => startEditing(vid)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1 transition cursor-pointer min-h-[36px]"
                          title="এডিট"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                          <span className="hidden sm:inline">এডিট</span>
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="min-w-[36px] min-h-[36px] p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer flex items-center justify-center"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ADD / EDIT VIDEO */}
            {activeTab === 'edit' && (
              <form onSubmit={handleSaveVideoForm} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
                {formMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      formMsg.type === 'success'
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/60 border border-red-800 text-red-300'
                    }`}
                  >
                    {formMsg.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {formMsg.text}
                  </div>
                )}

                {/* Video URL Input */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                    <span>ভিডিও লিংক (Dropbox Share Link / Direct MP4 URL / Google Drive) *</span>
                    <span className="text-rose-400 font-mono text-[11px]">Auto CORS Normalization</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://www.dropbox.com/scl/fi/.../video.mp4?rlkey=...&dl=0"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono min-h-[44px]"
                      required
                    />
                  </div>

                  {/* URL Parser Feedback & Live Player Preview */}
                  {parsedPreview && (
                    <div className="mt-2 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                        <span className="font-semibold text-white">স্বয়ংক্রিয় রূপান্তর:</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                          {parsedPreview.provider.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-zinc-400">{parsedPreview.notes}</p>
                      <div className="p-2 bg-zinc-900 rounded-lg text-emerald-400 font-mono text-[11px] break-all border border-zinc-800">
                        {parsedPreview.directUrl}
                      </div>

                      {/* Mini Live Preview Player */}
                      {parsedPreview.isValid && (
                        <div className="pt-2">
                          <span className="text-[11px] text-zinc-400 font-semibold block mb-1">
                            লাইভ প্রিভিউ টেস্ট (Live Player Preview):
                          </span>
                          <div className="w-44 h-64 bg-black rounded-xl overflow-hidden border border-zinc-700 mx-auto sm:mx-0 shadow-lg">
                            <video
                              src={parsedPreview.directUrl}
                              controls
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    ভিডিওর শিরোনাম (Title) *
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: মেঘের রাজ্যে সাজেক ভ্যালি ⛰️"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 min-h-[44px]"
                    required
                  />
                </div>

                {/* Caption & Hashtags */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                    <span>ক্যাপশন ও হ্যাশট্যাগ (Caption & Hashtags)</span>
                    <span className="text-zinc-500 text-[11px]">#shorts #viral #reels</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ভিডিও সম্পর্কে কিছু লিখুন... #shorts #viral #bangla"
                    value={formData.caption}
                    onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['#shorts', '#viral', '#reels', '#bangla', '#nature', '#travelbd', '#foodie'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (!formData.caption.includes(tag)) {
                            setFormData({
                              ...formData,
                              caption: (formData.caption + ' ' + tag).trim(),
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer min-h-[30px]"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creator & Audio Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      ক্রিয়েটরের নাম (Creator Name)
                    </label>
                    <input
                      type="text"
                      placeholder="মাহাবুব আহমেদ"
                      value={formData.creator}
                      onChange={(e) => setFormData({ ...formData, creator: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 min-h-[40px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      হ্যান্ডেল (@Handle)
                    </label>
                    <input
                      type="text"
                      placeholder="@mahabub_creator"
                      value={formData.creatorHandle}
                      onChange={(e) => setFormData({ ...formData, creatorHandle: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 min-h-[40px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      অডিও ট্র্যাক নাম (Music Title)
                    </label>
                    <input
                      type="text"
                      placeholder="Original Sound - Sajek Vibes"
                      value={formData.audioTrack}
                      onChange={(e) => setFormData({ ...formData, audioTrack: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 min-h-[40px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      প্রোফাইল অ্যাভাটার URL (Avatar URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={formData.creatorAvatar}
                      onChange={(e) => setFormData({ ...formData, creatorAvatar: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 min-h-[40px]"
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('list');
                      setEditingVideoId(null);
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer min-h-[40px]"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95 min-h-[40px]"
                  >
                    {editingVideoId ? 'আপডেট করুন' : 'স্লটে সংরক্ষণ করুন'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: GITHUB LIVE SYNC */}
            {activeTab === 'github' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
                {/* Information Card */}
                <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                    <Github className="w-5 h-5" />
                    <span>১০০% ফ্রি লাইভ গ্লোবাল সিঙ্ক (GitHub REST API)</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    এখানে আপনার GitHub পার্সোনাল এক্সেস টোকেন কনফিগার করলে আপনি অ্যাডমিন থেকে ভিডিও যুক্ত বা এডিট করলে তা সরাসরি আপনার গিটহাব রিপোজিটরির <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">public/videos.json</code> ফাইলে অটোমেটিকভাবে কমিট হবে! ফলে সব ভিজিটর কোনো পেইড ডেটাবেস ছাড়াই সম্পূর্ণ ফ্রিতে রিয়েলটাইম আপডেট পাবে।
                  </p>
                  <div className="pt-1">
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=SnipTok+Admin"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline font-medium min-h-[30px]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      ১-ক্লিকে 'repo' স্কোপসহ ক্লাসিক টোকেন তৈরি করার লিঙ্ক (GitHub Settings)
                    </a>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        GitHub Username / Owner
                      </label>
                      <input
                        type="text"
                        placeholder="mahabubxblog"
                        value={githubConfig.owner}
                        onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-rose-500 min-h-[44px]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Repository Name
                      </label>
                      <input
                        type="text"
                        placeholder="mahabubxblog.github.io"
                        value={githubConfig.repo}
                        onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-rose-500 min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                      <span>GitHub Personal Access Token (PAT with 'repo' scope)</span>
                      <span className="text-[11px] text-zinc-500 font-mono">ghp_...</span>
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={githubConfig.token}
                      onChange={(e) => setGithubConfig({ ...githubConfig, token: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-rose-500 min-h-[44px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        ব্রাঞ্চ (Branch)
                      </label>
                      <input
                        type="text"
                        placeholder="main"
                        value={githubConfig.branch}
                        onChange={(e) => setGithubConfig({ ...githubConfig, branch: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-rose-500 min-h-[40px]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        ফাইল পাথ (File Path)
                      </label>
                      <input
                        type="text"
                        placeholder="public/videos.json"
                        value={githubConfig.filePath}
                        onChange={(e) => setGithubConfig({ ...githubConfig, filePath: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 font-mono focus:outline-none focus:border-rose-500 min-h-[40px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Verification, Pull, and Manual Push buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    onClick={handleVerifyGitHub}
                    disabled={isVerifyingGh || !githubConfig.token}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-xl text-xs font-medium cursor-pointer transition min-h-[40px]"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingGh ? 'animate-spin' : ''}`} />
                    টোকেন ভেরিফাই করুন (Verify Token)
                  </button>

                  <button
                    onClick={handlePullFromGitHub}
                    disabled={isPullingGh || !githubConfig.owner || !githubConfig.repo}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-xl text-xs font-medium cursor-pointer transition min-h-[40px]"
                  >
                    <CloudDownload className={`w-3.5 h-3.5 ${isPullingGh ? 'animate-bounce' : ''}`} />
                    GitHub থেকে লাইভ ডেটা আনুন (Pull)
                  </button>

                  <button
                    onClick={() => triggerGitHubSync()}
                    disabled={isSyncingGh || !githubConfig.token}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-lg shadow-rose-600/20 min-h-[40px]"
                  >
                    <Github className="w-3.5 h-3.5" />
                    {isSyncingGh ? 'কমিট হচ্ছে...' : 'এখনই GitHub এ কমিট করুন (Push to Live)'}
                  </button>
                </div>

                {/* Feedback Boxes */}
                {ghVerifyResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      ghVerifyResult.success
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/60 border border-red-800 text-red-300'
                    }`}
                  >
                    {ghVerifyResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {ghVerifyResult.message}
                  </div>
                )}

                {ghSyncResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      ghSyncResult.success
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/60 border border-red-800 text-red-300'
                    }`}
                  >
                    {ghSyncResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {ghSyncResult.message}
                  </div>
                )}

                {/* Backup & Tools Section */}
                <div className="pt-4 border-t border-zinc-800">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2.5">
                    ব্যাকআপ ও রিস্টোর টুলস (Offline Backup & Tools)
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleDownloadJson}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer transition min-h-[36px]"
                    >
                      <Download className="w-3.5 h-3.5 text-rose-400" />
                      videos.json ডাউনলোড
                    </button>

                    <button
                      onClick={handleCopyJson}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer transition min-h-[36px]"
                    >
                      <Copy className="w-3.5 h-3.5 text-blue-400" />
                      {copiedJson ? 'কপি হয়েছে!' : 'JSON টেক্সট কপি'}
                    </button>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer transition min-h-[36px]">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      JSON ফাইল ইমপোর্ট
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportJsonFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
