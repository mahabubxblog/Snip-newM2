import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Sparkles,
  ArrowUp,
  ArrowDown,
  CloudDownload,
  BookOpen,
  Check,
  Video,
  Layers,
  HelpCircle,
  Zap,
  ShieldCheck,
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

  // Active tab: 'list' | 'edit' | 'bulk' | 'github' | 'guide'
  const [activeTab, setActiveTab] = useState<'list' | 'edit' | 'bulk' | 'github' | 'guide'>('list');

  // Bulk import state
  const [bulkUrlsText, setBulkUrlsText] = useState('');
  const [bulkCreatorName, setBulkCreatorName] = useState('মাহাবুব আহমেদ');
  const [bulkCreatorHandle, setBulkCreatorHandle] = useState('@mahabub_creator');
  const [bulkCaption, setBulkCaption] = useState('#shorts #viral #bangla');
  const [bulkAudioTrack, setBulkAudioTrack] = useState('Original Sound - SnipTok Beats');
  const [bulkImportMsg, setBulkImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImportingBulk, setIsImportingBulk] = useState(false);

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

  // GitHub Sync state with intelligent automatic repo detection
  const [githubConfig, setGithubConfig] = useState<GitHubSyncConfig>(() => {
    let defaultOwner = 'mahabubxblog';
    let defaultRepo = 'Snip-newM2';

    // Auto-detect owner and repo name if running on GitHub Pages (e.g. mahabubxblog.github.io/Snip-newM2/)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('.github.io')) {
        const detectedOwner = hostname.split('.')[0];
        if (detectedOwner) defaultOwner = detectedOwner;
        const segments = window.location.pathname.split('/').filter(Boolean);
        if (segments.length > 0 && segments[0]) {
          defaultRepo = segments[0];
        }
      }
    }

    try {
      const saved = localStorage.getItem('sniptok_github_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If repo was previously stuck on the default 'mahabubxblog.github.io', auto-correct to Snip-newM2
        if (parsed.repo === 'mahabubxblog.github.io' && defaultRepo !== 'mahabubxblog.github.io') {
          parsed.repo = defaultRepo;
        }
        return {
          owner: parsed.owner || defaultOwner,
          repo: parsed.repo || defaultRepo,
          token: parsed.token || '',
          branch: parsed.branch || 'main',
          filePath: parsed.filePath || 'public/videos.json',
        };
      }
    } catch {
      // ignore
    }
    return {
      owner: defaultOwner,
      repo: defaultRepo,
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

  // Hosting Guide Helper State
  const [guideTestUrl, setGuideTestUrl] = useState('');
  const [guideParsedResult, setGuideParsedResult] = useState<{
    directUrl: string;
    provider: string;
    isValid: boolean;
    notes: string;
  } | null>(null);
  const [copiedReleaseTemplate, setCopiedReleaseTemplate] = useState(false);

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

  // Handle Guide URL test change
  useEffect(() => {
    if (guideTestUrl.trim()) {
      const res = normalizeVideoUrl(guideTestUrl);
      setGuideParsedResult(res);
    } else {
      setGuideParsedResult(null);
    }
  }, [guideTestUrl]);

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

  // Memoized bulk URL parsing
  const bulkParsedEntries = useMemo(() => {
    if (!bulkUrlsText.trim()) return [];
    const lines = bulkUrlsText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && (l.startsWith('http://') || l.startsWith('https://') || l.startsWith('/')));

    return lines.map((line, idx) => {
      const parsed = normalizeVideoUrl(line);
      let derivedTitle = `ভিডিও #${videos.length + idx + 1}`;
      try {
        const urlObj = new URL(line.startsWith('/') ? `https://dummy.com${line}` : line);
        const segments = urlObj.pathname.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] || '';
        const cleanName = decodeURIComponent(lastSegment)
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim();
        if (cleanName) {
          derivedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        }
      } catch {
        // use fallback
      }
      return {
        originalUrl: line,
        parsed,
        title: derivedTitle,
      };
    });
  }, [bulkUrlsText, videos.length]);

  // Bulk Import Handler
  const handleBulkImport = async () => {
    if (bulkParsedEntries.length === 0) {
      setBulkImportMsg({ type: 'error', text: 'অন্তত একটি ভিডিও লিংক প্রবেশ করান।' });
      return;
    }
    const validEntries = bulkParsedEntries.filter((e) => e.parsed.isValid);
    if (validEntries.length === 0) {
      setBulkImportMsg({ type: 'error', text: 'কোনো বৈধ ভিডিও লিংক পাওয়া যায়নি।' });
      return;
    }

    const availableSlots = 100 - videos.length;
    if (availableSlots <= 0) {
      setBulkImportMsg({ type: 'error', text: 'সর্বোচ্চ ১০০ টি ভিডিও স্লট ইতিমধ্যে পূর্ণ!' });
      return;
    }

    const entriesToAdd = validEntries.slice(0, availableSlots);
    setIsImportingBulk(true);

    try {
      const newVideos: VideoItem[] = entriesToAdd.map((entry, index) => ({
        id: 'snip-' + Date.now().toString(36) + '-' + index + '-' + Math.random().toString(36).substring(2, 6),
        title: entry.title,
        caption: bulkCaption.trim() || '#shorts #viral #bangla',
        url: entry.parsed.directUrl,
        originalUrl: entry.originalUrl,
        creator: bulkCreatorName.trim() || 'মাহাবুব আহমেদ',
        creatorHandle: bulkCreatorHandle.trim() || '@mahabub_creator',
        creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        audioTrack: bulkAudioTrack.trim() || 'Original Sound - SnipTok Beats',
        likes: Math.floor(Math.random() * 250) + 15,
        commentsCount: Math.floor(Math.random() * 20),
        createdAt: new Date().toISOString(),
        isLocalCustom: true,
      }));

      const updatedList = [...newVideos, ...videos];
      await onSaveVideos(updatedList, `${newVideos.length} টি নতুন ভিডিও সফলভাবে যুক্ত হয়েছে!`);

      if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
        triggerGitHubSync(updatedList);
      }

      setBulkImportMsg({
        type: 'success',
        text: `অভিনন্দন! ${newVideos.length} টি নতুন ভিডিও ফিডে যুক্ত হয়েছে।`,
      });
      setBulkUrlsText('');

      setTimeout(() => {
        setActiveTab('list');
        setBulkImportMsg(null);
      }, 1400);
    } catch (err) {
      setBulkImportMsg({
        type: 'error',
        text: 'ভিডিও যোগ করার সময় সমস্যা হয়েছে: ' + String(err),
      });
    } finally {
      setIsImportingBulk(false);
    }
  };

  // GitHub token verification
  const handleVerifyGitHub = async () => {
    setIsVerifyingGh(true);
    setGhVerifyResult(null);
    try {
      const res = await verifyGitHubRepo(githubConfig);
      setGhVerifyResult(res);
      if (res.success && res.defaultBranch && res.defaultBranch !== githubConfig.branch) {
        setGithubConfig((prev) => ({ ...prev, branch: res.defaultBranch! }));
      }
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

  // Quick Action from Guide: Apply tested URL to new video form
  const handleApplyGuideUrlToNew = () => {
    if (!guideParsedResult?.isValid) return;
    setEditingVideoId(null);
    setFormData({
      title: 'নতুন রিল ভিডিও 🔥',
      caption: '#shorts #viral #reels #sniptok',
      url: guideParsedResult.directUrl,
      creator: 'মাহাবুব আহমেদ',
      creatorHandle: '@mahabub_creator',
      creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      audioTrack: 'Original Sound - SnipTok Exclusive',
    });
    setActiveTab('edit');
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
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] shrink-0 ${
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
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] shrink-0 ${
                  activeTab === 'edit'
                    ? 'border-rose-500 text-rose-400 bg-zinc-900/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                {editingVideoId ? 'ভিডিও এডিট' : '+ একক ভিডিও'}
              </button>

              <button
                onClick={() => {
                  setActiveTab('bulk');
                  setBulkImportMsg(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] shrink-0 ${
                  activeTab === 'bulk'
                    ? 'border-rose-500 text-rose-400 bg-zinc-900/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-4 h-4 text-amber-400" />
                ⚡ একসাথে অনেকগুলো যোগ (Bulk)
              </button>

              <button
                onClick={() => setActiveTab('guide')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] shrink-0 ${
                  activeTab === 'guide'
                    ? 'border-rose-500 text-rose-400 bg-zinc-900/80'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <BookOpen className="w-4 h-4 text-rose-400" />
                ফ্রি ভিডিও হোস্টিং গাইড ও টুলস
                <span className="text-[9px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-semibold">
                  ১০০% FREE
                </span>
              </button>

              <button
                onClick={() => setActiveTab('github')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer min-h-[44px] shrink-0 ${
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
                    <span>ভিডিও লিংক (GitHub Releases / Cloudinary / Dropbox / MP4 URL) *</span>
                    <span className="text-rose-400 font-mono text-[11px]">Auto CORS Normalization</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://github.com/mahabubxblog/Snip-newM2/releases/download/.../video.mp4"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono min-h-[44px]"
                      required
                    />
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center justify-between text-[11px] text-zinc-400 gap-1">
                    <span>💡 সেরা পদ্ধতি: <strong>GitHub Releases</strong> এ আপলোড করে লিংক দিন (১০০% ফ্রি, বাফারিং-মুক্ত)।</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('guide')}
                      className="text-rose-400 underline font-medium cursor-pointer"
                    >
                      গাইড ও সাহায্যকারী দেখুন &rarr;
                    </button>
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

            {/* TAB: BULK VIDEO IMPORT */}
            {activeTab === 'bulk' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
                {/* Header Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Layers className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>একসাথে একাধিক ভিডিও যোগ করুন (Bulk Video Importer)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    GitHub Releases বা অন্য যেকোনো হোস্ট থেকে আপলোড করা ভিডিওগুলোর লিংক নিচে পেস্ট করুন (প্রতি লাইনে একটি করে লিংক)। সিস্টেম স্বয়ংক্রিয়ভাবে ভিডিও নাম ও লিংক পরীক্ষা করে এক ক্লিকে ফিডে যুক্ত করে দেবে!
                  </p>
                </div>

                {/* Bulk Status Message */}
                {bulkImportMsg && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                      bulkImportMsg.type === 'success'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {bulkImportMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{bulkImportMsg.text}</span>
                  </div>
                )}

                {/* Batch Settings */}
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>ব্যাচের সাধারণ তথ্য (Default Meta for this Batch)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">ক্রিয়েটরের নাম</label>
                      <input
                        type="text"
                        value={bulkCreatorName}
                        onChange={(e) => setBulkCreatorName(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 min-h-[38px]"
                        placeholder="মাহাবুব আহমেদ"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">হ্যান্ডেল / ইউজারনেম</label>
                      <input
                        type="text"
                        value={bulkCreatorHandle}
                        onChange={(e) => setBulkCreatorHandle(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 min-h-[38px]"
                        placeholder="@mahabub_creator"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">ক্যাপশন / হ্যাশট্যাগ</label>
                      <input
                        type="text"
                        value={bulkCaption}
                        onChange={(e) => setBulkCaption(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 min-h-[38px]"
                        placeholder="#shorts #viral #bangla"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">অডিও ট্র্যাক</label>
                      <input
                        type="text"
                        value={bulkAudioTrack}
                        onChange={(e) => setBulkAudioTrack(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 min-h-[38px]"
                        placeholder="Original Sound - SnipTok Beats"
                      />
                    </div>
                  </div>
                </div>

                {/* URLs Input Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <span>ভিডিও লিংকসমূহ পেস্ট করুন (প্রতি লাইনে ১টি লিংক):</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkUrlsText(
                          `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4\nhttps://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4\nhttps://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4`
                        );
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      নমুনা লিংক দিয়ে দেখুন
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={bulkUrlsText}
                    onChange={(e) => setBulkUrlsText(e.target.value)}
                    placeholder={`https://github.com/${githubConfig.owner}/${githubConfig.repo}/releases/download/v1.0.0/video-01.mp4\nhttps://github.com/${githubConfig.owner}/${githubConfig.repo}/releases/download/v1.0.0/video-02.mp4\nhttps://github.com/${githubConfig.owner}/${githubConfig.repo}/releases/download/v1.0.0/video-03.mp4`}
                    className="w-full p-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>

                {/* Detected Links Preview */}
                {bulkParsedEntries.length > 0 && (
                  <div className="space-y-2 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-zinc-800">
                      <span className="font-semibold text-white">
                        সনাক্তকৃত ভিডিও ({bulkParsedEntries.filter((e) => e.parsed.isValid).length}/{bulkParsedEntries.length})
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        স্লট বাকি: {100 - videos.length} টি
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 no-scrollbar text-xs">
                      {bulkParsedEntries.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-zinc-200 truncate">{entry.title}</p>
                              <p className="text-[10px] text-zinc-500 truncate font-mono">
                                {entry.originalUrl}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {entry.parsed.provider}
                            </span>
                            {entry.parsed.isValid ? (
                              <span className="text-emerald-400 font-bold text-[11px]">✓ প্রস্তুত</span>
                            ) : (
                              <span className="text-red-400 text-[10px]">✕ ত্রুটিপূর্ণ</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkUrlsText('');
                      setActiveTab('list');
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer min-h-[40px]"
                  >
                    ফিরে যান
                  </button>

                  <button
                    type="button"
                    disabled={isImportingBulk || bulkParsedEntries.filter((e) => e.parsed.isValid).length === 0}
                    onClick={handleBulkImport}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[40px]"
                  >
                    {isImportingBulk ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        যুক্ত হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4" />
                        সবগুলো ভিডিও একসাথে যোগ করুন ({bulkParsedEntries.filter((e) => e.parsed.isValid).length} টি)
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: FREE HOSTING GUIDE & TOOLS */}
            {activeTab === 'guide' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
                {/* Header Highlight Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-zinc-900 to-zinc-900 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <Zap className="w-5 h-5 text-rose-400 shrink-0" />
                    <span>১০০% সম্পূর্ণ ফ্রি ভিডিও হোস্টিং সমাধান (Free Video Hosting Guide)</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    ড্রপবক্সের ফ্রি লিংকে কয়েক মিনিট পর পর মেয়াদ ফুরিয়ে যাওয়ার সমস্যা বা রিফ্রেশ দিলে ব্রাউজারে বাফারিং আটকে যাওয়ার সমস্যার <strong>১০০% ফ্রি স্থায়ী সমাধান</strong> নিচে বিস্তারিত দেওয়া হলো। এর জন্য কোনো Student Pack, ক্রেডিট কার্ড বা পেইড সাবস্ক্রিপশন লাগবে না!
                  </p>
                </div>

                {/* Interactive Link Tester & Direct Slot Adder */}
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-rose-400" />
                      <span>ভিডিও লিংক টেস্টার ও রূপান্তরকারী (Test Any URL Live)</span>
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-mono">Instant CORS Checker</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="url"
                      placeholder="এখানে যেকোনো GitHub Release / Cloudinary / Dropbox লিংক পেস্ট করুন..."
                      value={guideTestUrl}
                      onChange={(e) => setGuideTestUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 font-mono min-h-[42px]"
                    />

                    {/* Pre-filled Sample Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-zinc-400">নমুনা লিংক টেস্ট করুন:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setGuideTestUrl(
                            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono cursor-pointer"
                      >
                        Sample Direct MP4
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGuideTestUrl(
                            `https://github.com/${githubConfig.owner}/${githubConfig.repo}/releases/download/v1.0.0/sample.mp4`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono cursor-pointer"
                      >
                        GitHub Release Template
                      </button>
                    </div>

                    {/* Live Test Feedback & Mini Player */}
                    {guideParsedResult && (
                      <div className="mt-3 p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-700 text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            {guideParsedResult.notes}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[10px]">
                            {guideParsedResult.provider.toUpperCase()}
                          </span>
                        </div>

                        <div className="p-2 bg-black/60 rounded-lg text-zinc-300 font-mono text-[11px] break-all border border-zinc-800">
                          {guideParsedResult.directUrl}
                        </div>

                        {guideParsedResult.isValid && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                            <div className="w-36 h-48 bg-black rounded-lg overflow-hidden border border-zinc-700">
                              <video
                                src={guideParsedResult.directUrl}
                                controls
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleApplyGuideUrlToNew}
                              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer flex items-center gap-1.5"
                            >
                              <PlusCircle className="w-4 h-4" />
                              এই ভিডিওটি ফিডে যোগ করুন (Add to Feed)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* METHOD 1: GITHUB RELEASES (THE ULTIMATE FREE SOLUTION) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-emerald-500/30 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        ১
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        পদ্ধতি ১: GitHub Releases (১০০% ফ্রি — চিরস্থায়ী ও সবচেয়ে দ্রুততম)
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      RECOMMENDED
                    </span>
                  </div>

                  <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-1.5">
                    <p className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>গিটহাব কি সম্পূর্ণ ফ্রি? Student Pack বা Pro কি লাগবে?</span>
                    </p>
                    <p className="text-zinc-300 leading-relaxed">
                      <strong>একদমই না!</strong> সাধারণ ফ্রি গিটহাব একাউন্টেই প্রতিটি রিলিজ ফাইলে <strong>সর্বোচ্চ ২ জিবি (2 GB)</strong> পর্যন্ত যেকোনো সাইজের ভিডিও ফাইল ফ্রিতে আপলোড করা যায়। গিটহাব সরাসরি Fastly Global CDN দিয়ে ফুল স্পিড বাফারিং ও CORS সাপোর্ট প্রদান করে। এটি কখনো এক্সপায়ার হয় না!
                    </p>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-4 text-xs text-zinc-300">
                    <p className="font-semibold text-white">ভিডিও আপলোড করার সহজ ধাপসমূহ:</p>

                    <div className="space-y-2 text-zinc-400 pl-1">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 font-bold">১.</span>
                        <span>
                          আপনার GitHub রিপোজিটরির Releases পেজে যান:
                        </span>
                      </div>

                      <div className="pl-5 pb-1">
                        <a
                          href={`https://github.com/${githubConfig.owner}/${githubConfig.repo}/releases/new`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          সরাসরি নতুন রিলিজ পেজ খুলুন (github.com/{githubConfig.owner}/{githubConfig.repo}/releases/new)
                        </a>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 font-bold">২.</span>
                        <span>
                          <strong>"Choose a tag"</strong> এ ক্লিক করে যেকোনো নাম লিখুন (যেমন: <code className="text-white bg-zinc-800 px-1 rounded">v1.0.0</code> বা <code className="text-white bg-zinc-800 px-1 rounded">videos</code>) এবং <em>Create new tag</em> চাপুন।
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 font-bold">৩.</span>
                        <span>
                          নিচে <strong>"Attach binaries by dropping them here"</strong> বক্সে আপনার ফোন বা পিসি থেকে ভিডিও ফাইল (.mp4) ড্র্যাগ করে ছেড়ে দিন।
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 font-bold">৪.</span>
                        <span>
                          সবুজ <strong>"Publish release"</strong> বাটনে ক্লিক করুন।
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-mono text-emerald-400 font-bold">৫.</span>
                        <span>
                          আপলোড হওয়া ফাইলের নামের উপর রাইট-ক্লিক বা লং-প্রেস করে <strong>"Copy link address"</strong> কপি করুন।
                        </span>
                      </div>
                    </div>

                    {/* SUB-SECTION A: BULK / MULTIPLE VIDEOS AT ONCE */}
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <Layers className="w-4 h-4 shrink-0" />
                        <span>১. একসাথে অনেকগুলো (Bulk) ভিডিও আপলোড করার নিয়ম:</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed text-[11px]">
                        GitHub Releases এ কোনো সংখ্যাগত লিমিট নেই! আপনি চাইলে <strong>"Attach binaries"</strong> বক্সে একসাথে ৫টি, ১০টি বা ২০টি ভিডিও ফাইল ড্র্যাগ করে একবারে ড্রপ করে দিতে পারেন। সব ফাইল আপলোড সম্পন্ন হলে <strong>"Publish release"</strong> এ ক্লিক করুন। এরপর ফাইলগুলোর লিংক কপি করে আমাদের অ্যাডমিনের <strong>"⚡ একসাথে অনেকগুলো যোগ (Bulk)"</strong> ট্যাবে পেস্ট করলেই মাত্র ১ ক্লিকে সবগুলো ভিডিও ফিডে যুক্ত হয়ে যাবে!
                      </p>
                    </div>

                    {/* SUB-SECTION B: SUBSEQUENT / ONE BY ONE VIDEOS */}
                    <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                        <RefreshCw className="w-4 h-4 shrink-0" />
                        <span>২. পরবর্তীতে একটার পর একটা (Sequential) নতুন ভিডিও যোগ করার নিয়ম:</span>
                      </div>
                      <div className="text-zinc-300 space-y-2 text-[11px] leading-relaxed">
                        <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800">
                          <p className="text-blue-300 font-semibold mb-0.5">
                            ⚡ উপায় ১ (বিদ্যমান রিলিজ এডিট করা — সবচেয়ে সহজ ও দ্রুত):
                          </p>
                          <p className="text-zinc-400">
                            নতুন রিলিজ বা ট্যাগ তৈরির কোনো দরকার নেই! আপনার আগের রিলিজের পেজে গিয়ে ডানপাশের পেন্সিল আইকন <strong>"Edit release"</strong> এ চাপুন। নতুন ভিডিওটি ড্র্যাগ করে ড্রপ বক্সে ছেড়ে দিন এবং নিচে <strong>"Update release"</strong> চাপুন। নতুন ফাইলের লিংক কপি করে অ্যাডমিনের <strong>"+ একক ভিডিও"</strong> ফর্মে যোগ করে নিন।
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800">
                          <p className="text-emerald-300 font-semibold mb-0.5">
                            📦 উপায় ২ (নতুন ট্যাগ বা রিলিজ তৈরি করা — পর্বভিত্তিক বিন্যাস):
                          </p>
                          <p className="text-zinc-400">
                            আপনি চাইলে প্রতি নতুন ব্যাচ বা পর্বের জন্য নতুন রিলিজ তৈরি করতে পারেন: <strong>"Draft a new release"</strong> এ গিয়ে নতুন ট্যাগ (যেমন: <code className="text-white bg-zinc-800 px-1 rounded">v2.0.0</code> বা <code className="text-white bg-zinc-800 px-1 rounded">batch-2</code>) দিয়ে নতুন ভিডিও আপলোড করে <strong>Publish</strong> করুন।
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* METHOD 2: CLOUDINARY (FREE FOREVER TIER) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        ২
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        পদ্ধতি ২: Cloudinary Free Forever (মাসে ২৫ জিবি ব্যান্ডউইথ)
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                      FAST CDN
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Cloudinary তে কোনো ক্রেডিট কার্ড ছাড়াই সম্পূর্ণ ফ্রি একাউন্ট তৈরি করা যায়। এটি স্বয়ংক্রিয়ভাবে মোবাইল ফোনের জন্য ভিডিও অপটিমাইজ করে।
                  </p>

                  <div className="space-y-1.5 text-xs text-zinc-400 pl-1">
                    <p>• ১. <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">cloudinary.com</a> এ গিয়ে ফ্রি একাউন্ট খুলুন।</p>
                    <p>• ২. <strong>Media Library</strong> তে ভিডিও আপলোড করুন।</p>
                    <p>• ৩. ভিডিওর উপর ক্লিক করে <strong>"Copy URL"</strong> লিংকটি কপি করে SnipTok এ পেস্ট করুন।</p>
                  </div>
                </div>

                {/* METHOD 3: DROPBOX FIX & WHY IT FAILED */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold">
                      ৩
                    </div>
                    <h4 className="font-bold text-sm text-white">
                      ড্রপবক্সে কেন রিফ্রেশ দিলে সমস্যা হতো এবং কীভাবে এড়াবেন?
                    </h4>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
                    <p>
                      <strong>সমস্যার কারণ:</strong> ড্রপবক্স থেকে লগইন অবস্থায় লিংক কপি করলে ড্রপবক্স লিংকের সাথে <code className="text-rose-400 bg-zinc-900 px-1 rounded">&st=xyz</code> এবং <code className="text-rose-400 bg-zinc-900 px-1 rounded">&e=1</code> নামক সাময়িক সেশন টোকেন যুক্ত করে। এই টোকেন ৩-৫ মিনিট পরেই নষ্ট হয়ে যায়! এছাড়া পেজ রিফ্রেশ দিলে ব্রাউজার যখন ভিডিও ফাইলের নির্দিষ্ট অংশ চায় (HTTP 206 Range Request), ড্রপবক্সের ফ্রি সার্ভার তা ব্লক করে দেয়।
                    </p>
                    <p>
                      <strong>আমাদের সমাধান:</strong> SnipTok এ এখন একটি অটোমেটিক সেশন ক্লিনার যুক্ত আছে যা এই মেয়াদোত্তীর্ণ টোকেন স্বয়ংক্রিয়ভাবে মুছে ফেলে। এছাড়া প্লেয়ার এররে <strong>"অফলাইনে সেভ করুন"</strong> বাটনে চাপলে এটি সরাসরি ব্রাউজারের মেমোরিতে (IndexedDB) সম্পূর্ণ ভিডিওটি ক্যাশ করে নেয়, যার ফলে রিফ্রেশ দিলেও আর কখনোই কোনো এরর আসবে না!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: GITHUB LIVE SYNC */}
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
                        placeholder="Snip-newM2"
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

                {/* GitHub Pages Setup & Troubleshooting Guide */}
                <div className="p-4 rounded-xl bg-zinc-950/80 border border-rose-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>GitHub Pages এ হোস্ট করতে সমস্যা হচ্ছে? সমাধান দেখে নিন:</span>
                  </div>

                  <div className="space-y-2.5 text-xs text-zinc-300">
                    <div className="flex items-start gap-2 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="w-5 h-5 rounded-full bg-rose-600/30 text-rose-400 font-bold flex items-center justify-center shrink-0 text-[11px]">১</span>
                      <div>
                        <strong className="text-white">GitHub Pages Source সেটিং "GitHub Actions" করুন:</strong>
                        <p className="text-zinc-400 mt-0.5">
                          আপনার রিপোজিটরির <strong>Settings</strong> &rarr; বামপাশের মেনু থেকে <strong>Pages</strong> এ যান। <strong>Build and deployment</strong> এর নিচে <strong>Source</strong> অপশনে <strong>"Deploy from a branch"</strong> এর বদলে <strong>"GitHub Actions"</strong> সিলেক্ট করুন।
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="w-5 h-5 rounded-full bg-rose-600/30 text-rose-400 font-bold flex items-center justify-center shrink-0 text-[11px]">২</span>
                      <div>
                        <strong className="text-white">অপ্রয়োজনীয় static.yml মুছে ফেলুন:</strong>
                        <p className="text-zinc-400 mt-0.5">
                          GitHub এর স্বয়ংক্রিয়ভাবে তৈরি হওয়া <code className="text-zinc-200 bg-zinc-800 px-1 rounded">.github/workflows/static.yml</code> ফাইলটি মুছে ফেলুন (Delete)। আমাদের অ্যাপে ইতিমধ্যেই পরিপূর্ণ <code className="text-zinc-200 bg-zinc-800 px-1 rounded">.github/workflows/deploy.yml</code> কনফিগার করা আছে যা Vite দিয়ে প্রোডাকশন বিল্ড করে।
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                      <span className="w-5 h-5 rounded-full bg-rose-600/30 text-rose-400 font-bold flex items-center justify-center shrink-0 text-[11px]">৩</span>
                      <div>
                        <strong className="text-white">নতুন কোড এবং package-lock.json পুশ করুন:</strong>
                        <p className="text-zinc-400 mt-0.5">
                          আমরা বিল্ড ফিক্স ও <code className="text-zinc-200 bg-zinc-800 px-1 rounded">package-lock.json</code> জেনারেট করে দিয়েছি। কোড রিপোজিটরির <code className="text-zinc-200 bg-zinc-800 px-1 rounded">main</code> ব্রাঞ্চে পুশ করলে স্বয়ংক্রিয়ভাবে ১০০% সফলভাবে বিল্ড ও হোস্ট হয়ে যাবে!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

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
