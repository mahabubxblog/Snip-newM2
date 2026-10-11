/**
 * Video Streaming URL Normalization & CDN Fallback Engine
 *
 * Supported 100% Free Video Hosting Providers:
 * 1. GitHub Releases (Direct Fastly CDN, 2GB per video, 100% Free without Pro/Student Pack)
 *    https://github.com/{owner}/{repo}/releases/download/{tag}/{file.mp4}
 * 2. GitHub Raw & jsDelivr CDN:
 *    https://github.com/{owner}/{repo}/blob/{branch}/{file.mp4} -> auto-converts to raw or jsdelivr CDN
 * 3. Dropbox (Standard & SCL links):
 *    Auto-converts to raw=1, strips ephemeral session tokens (st, e) that expire upon reload!
 * 4. Cloudinary Free Tier (25GB/month):
 *    https://res.cloudinary.com/{cloud}/video/upload/...
 * 5. Supabase Storage & Direct MP4 / WebM Streams
 * 6. Google Drive direct export
 */

export interface NormalizedUrlResult {
  directUrl: string;
  provider: 'github_release' | 'github_raw' | 'catbox' | 'cloudinary' | 'supabase' | 'dropbox' | 'gdrive' | 'direct' | 'unsupported_social' | 'unknown';
  isValid: boolean;
  notes: string;
  originalUrl: string;
  fallbackUrls?: string[];
}

export function normalizeVideoUrl(rawInput: string): NormalizedUrlResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      directUrl: '',
      provider: 'unknown',
      isValid: false,
      notes: 'কোনো ভিডিও লিংক প্রদান করা হয়নি।',
      originalUrl: '',
    };
  }

  const trimmed = rawInput.trim();

  try {
    const parsed = new URL(trimmed);
    const hostLower = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // 1. Check for unsupported social web pages (HTML page, not direct media stream)
    if (
      hostLower.includes('youtube.com') ||
      hostLower.includes('youtu.be') ||
      hostLower.includes('instagram.com') ||
      hostLower.includes('tiktok.com')
    ) {
      return {
        directUrl: trimmed,
        provider: 'unsupported_social',
        isValid: false,
        notes:
          'সোশ্যাল মিডিয়া পেজ লিংক সরাসরি HTML পেজ রিটার্ন করে। অনুগ্রহ করে GitHub Releases, Cloudinary বা সরাসরি .mp4 স্ট্রিমিং লিংক ব্যবহার করুন।',
        originalUrl: trimmed,
      };
    }

    // 2. GITHUB RELEASES (BEST 100% FREE STREAMING METHOD)
    // Matches: https://github.com/{owner}/{repo}/releases/download/{tag}/{filename.mp4}
    if (hostLower.includes('github.com') && pathname.includes('/releases/download/')) {
      const fallbackUrls: string[] = [trimmed];
      return {
        directUrl: trimmed,
        provider: 'github_release',
        isValid: true,
        notes: 'GitHub Releases হাই-স্পিড Fastly CDN লিংক শনাক্ত হয়েছে (সম্পূর্ণ ফ্রি, CORS সক্রিয়, বাফারিং-মুক্ত)।',
        originalUrl: trimmed,
        fallbackUrls,
      };
    }

    // GITHUB USER ATTACHMENTS & OBJECTS CDN (often generated when uploading video via GitHub mobile/web UI)
    if (
      (hostLower.includes('github.com') && pathname.includes('/user-attachments/assets/')) ||
      hostLower.includes('objects.githubusercontent.com') ||
      hostLower.includes('github-production-user-asset')
    ) {
      return {
        directUrl: trimmed,
        provider: 'github_release',
        isValid: true,
        notes: 'GitHub User Attachment সরাসরি ভিডিও স্ট্রিম শনাক্ত হয়েছে (সম্পূর্ণ ফ্রি ও উচ্চগতির CDN)।',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // GITHUB BLOB TO RAW / CDN CONVERSION:
    // Matches: https://github.com/{owner}/{repo}/blob/{branch}/{path.mp4}
    if (hostLower.includes('github.com') && pathname.includes('/blob/')) {
      const parts = pathname.split('/blob/');
      if (parts.length === 2) {
        const repoPath = parts[0].replace(/^\//, ''); // owner/repo
        const branchAndFile = parts[1]; // branch/file.mp4
        const [branch, ...fileParts] = branchAndFile.split('/');
        const filePath = fileParts.join('/');

        const rawUrl = `https://raw.githubusercontent.com/${repoPath}/${branch}/${filePath}`;
        const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${repoPath}@${branch}/${filePath}`;

        return {
          directUrl: rawUrl,
          provider: 'github_raw',
          isValid: true,
          notes: 'GitHub Blob লিংক সফলভাবে সরাসরি Raw CDN স্ট্রিমে রূপান্তর করা হয়েছে!',
          originalUrl: trimmed,
          fallbackUrls: [jsdelivrUrl, rawUrl],
        };
      }
    }

    // GITHUB RAW USER CONTENT
    if (hostLower.includes('raw.githubusercontent.com')) {
      return {
        directUrl: trimmed,
        provider: 'github_raw',
        isValid: true,
        notes: 'GitHub Raw সরাসরি স্ট্রিমিং লিংক শনাক্ত হয়েছে।',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // JSDELIVR GITHUB CDN
    if (hostLower.includes('jsdelivr.net') && pathname.includes('/gh/')) {
      return {
        directUrl: trimmed,
        provider: 'github_raw',
        isValid: true,
        notes: 'jsDelivr Global Edge CDN ভিডিও স্ট্রিম শনাক্ত হয়েছে।',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // 3. CATBOX.MOE / LITTERBOX (BEST ZERO-CONFIG 100% FREE NO-ACCOUNT MEDIA HOST)
    // Matches: https://files.catbox.moe/{filename.mp4} or https://litterbox.catbox.moe/{...}
    if (hostLower.includes('catbox.moe')) {
      return {
        directUrl: trimmed,
        provider: 'catbox',
        isValid: true,
        notes: 'Catbox.moe আল্ট্রা-ফাস্ট ভিডিও CDN শনাক্ত হয়েছে (১০০% ফ্রি, নো-লগইন, ফুল CORS ও বাফারিং-মুক্ত)।',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // 4. CLOUDINARY MEDIA
    if (hostLower.includes('cloudinary.com')) {
      return {
        directUrl: trimmed,
        provider: 'cloudinary',
        isValid: true,
        notes: 'Cloudinary আল্ট্রা-ফাস্ট ভিডিও CDN শনাক্ত হয়েছে (অটো অপটিমাইজড ও CORS সক্রিয়)।',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // 4. SUPABASE STORAGE
    if (hostLower.includes('supabase.co') && pathname.includes('/storage/v1/object/public/')) {
      return {
        directUrl: trimmed,
        provider: 'supabase',
        isValid: true,
        notes: 'Supabase Public Storage সরাসরি ভিডিও লিংক শনাক্ত হয়েছে।',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // 5. DROPBOX NORMALIZATION WITH EPHEMERAL TOKEN CLEANING
    if (hostLower.includes('dropbox.com') || hostLower.includes('dropboxusercontent.com')) {
      // Normalize host strictly to www.dropbox.com
      parsed.hostname = 'www.dropbox.com';

      // Set raw=1 and remove dl parameter
      parsed.searchParams.set('raw', '1');
      parsed.searchParams.delete('dl');

      // CRITICAL FIX FOR DROPBOX REFRESH ISSUE:
      // When users copy links from Dropbox while logged in, Dropbox often appends:
      // &st=xyz (session token), &e=1 (ephemeral timestamp), &preview=..., &subfolder_nav_tracking=...
      // These temporary tokens expire in a few minutes, causing "video format or CORS not supported" upon page refresh!
      parsed.searchParams.delete('st');
      parsed.searchParams.delete('e');
      parsed.searchParams.delete('subfolder_nav_tracking');
      parsed.searchParams.delete('preview');

      // Generate fallback URLs for resilient multi-try playback
      const fallbackUrls: string[] = [];

      // Fallback 1: Force dl=1 (forces browser download stream)
      try {
        const dl1Url = new URL(parsed.toString());
        dl1Url.searchParams.set('dl', '1');
        dl1Url.searchParams.delete('raw');
        fallbackUrls.push(dl1Url.toString());
      } catch {
        // ignore
      }

      // Fallback 2: For standard /s/ links, dl.dropboxusercontent.com
      if (parsed.pathname.startsWith('/s/')) {
        try {
          const directDl = new URL(parsed.toString());
          directDl.hostname = 'dl.dropboxusercontent.com';
          directDl.search = '';
          fallbackUrls.push(directDl.toString());
        } catch {
          // ignore
        }
      }

      const isScl = parsed.pathname.includes('/scl/fi/');
      const notes = isScl
        ? 'Dropbox SCL লিঙ্ক সফলভাবে স্থায়ী raw=1 স্ট্রিমে রূপান্তর করা হয়েছে (মেয়াদোত্তীর্ণ টোকেন ক্লিনড)'
        : 'Dropbox লিঙ্ক সফলভাবে raw=1 সরাসরি স্ট্রিমে রূপান্তর করা হয়েছে';

      return {
        directUrl: parsed.toString(),
        provider: 'dropbox',
        isValid: true,
        notes,
        originalUrl: trimmed,
        fallbackUrls,
      };
    }

    // 6. GOOGLE DRIVE NORMALIZATION
    if (hostLower.includes('drive.google.com')) {
      const matchFileId = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (matchFileId && matchFileId[1]) {
        const fileId = matchFileId[1];
        return {
          directUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
          provider: 'gdrive',
          isValid: true,
          notes: `Google Drive ফাইল আইডি (${fileId}) সরাসরি ডাউনলোড স্ট্রিমে রূপান্তর করা হয়েছে`,
          originalUrl: trimmed,
          fallbackUrls: [`https://docs.google.com/uc?export=download&id=${fileId}`],
        };
      }

      const queryId = parsed.searchParams.get('id');
      if (queryId) {
        return {
          directUrl: `https://drive.google.com/uc?export=download&id=${queryId}`,
          provider: 'gdrive',
          isValid: true,
          notes: 'Google Drive সরাসরি ডাউনলোড লিংক হিসেবে প্রস্তুত করা হয়েছে',
          originalUrl: trimmed,
          fallbackUrls: [`https://docs.google.com/uc?export=download&id=${queryId}`],
        };
      }
    }

    // 7. DIRECT VIDEO EXTENSIONS OR CDNs (.mp4, .webm, .m4v, etc.)
    const pathnameLower = parsed.pathname.toLowerCase();
    const isVideoExtension = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].some((ext) =>
      pathnameLower.endsWith(ext)
    );

    if (
      isVideoExtension ||
      pathnameLower.includes('.mp4') ||
      pathnameLower.includes('.webm') ||
      parsed.search.includes('.mp4')
    ) {
      return {
        directUrl: trimmed,
        provider: 'direct',
        isValid: true,
        notes: 'সরাসরি MP4 / WebM ভিডিও স্ট্রিম লিংক শনাক্ত হয়েছে',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }

    // 8. Standard HTTP / HTTPS URL Fallback
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return {
        directUrl: trimmed,
        provider: 'unknown',
        isValid: true,
        notes: 'সাধারণ ওয়েব মিডিয়া লিংক হিসেবে গ্রহণ করা হয়েছে',
        originalUrl: trimmed,
        fallbackUrls: [trimmed],
      };
    }
  } catch {
    return {
      directUrl: trimmed,
      provider: 'unknown',
      isValid: false,
      notes: 'অবৈধ URL ফরম্যাট! অনুগ্রহ করে একটি সঠিক লিঙ্ক (http:// বা https://) প্রদান করুন।',
      originalUrl: trimmed,
    };
  }

  return {
    directUrl: trimmed,
    provider: 'unknown',
    isValid: false,
    notes: 'URL বিশ্লেষণ করা সম্ভব হয়নি',
    originalUrl: trimmed,
  };
}

/**
 * Generate candidate fallback URLs for auto-reloading if a stream fails
 */
export function getAlternativeVideoUrls(url: string): string[] {
  if (!url) return [];
  const result: string[] = [url];
  try {
    const parsed = new URL(url);
    const hostLower = parsed.hostname.toLowerCase();

    // Dropbox candidates
    if (hostLower.includes('dropbox.com') || hostLower.includes('dropboxusercontent.com')) {
      // 1. raw=1
      const u1 = new URL(url);
      u1.hostname = 'www.dropbox.com';
      u1.searchParams.set('raw', '1');
      u1.searchParams.delete('dl');
      u1.searchParams.delete('st');
      u1.searchParams.delete('e');
      u1.searchParams.delete('subfolder_nav_tracking');
      u1.searchParams.delete('preview');
      if (u1.toString() !== url) result.push(u1.toString());

      // 2. dl=1
      const u2 = new URL(url);
      u2.hostname = 'www.dropbox.com';
      u2.searchParams.set('dl', '1');
      u2.searchParams.delete('raw');
      u2.searchParams.delete('st');
      u2.searchParams.delete('e');
      u2.searchParams.delete('subfolder_nav_tracking');
      result.push(u2.toString());

      // 3. For legacy /s/ links
      if (parsed.pathname.startsWith('/s/')) {
        const u3 = new URL(url);
        u3.hostname = 'dl.dropboxusercontent.com';
        u3.search = '';
        result.push(u3.toString());
      }
    }

    // GitHub Blob candidates
    if (hostLower.includes('github.com') && parsed.pathname.includes('/blob/')) {
      const parts = parsed.pathname.split('/blob/');
      if (parts.length === 2) {
        const repoPath = parts[0].replace(/^\//, '');
        const branchAndFile = parts[1];
        const [branch, ...fileParts] = branchAndFile.split('/');
        const filePath = fileParts.join('/');
        result.push(`https://raw.githubusercontent.com/${repoPath}/${branch}/${filePath}`);
        result.push(`https://cdn.jsdelivr.net/gh/${repoPath}@${branch}/${filePath}`);
      }
    }
  } catch {
    // ignore
  }

  return Array.from(new Set(result));
}

/**
 * Test helper to verify conversion against supported formats
 */
export function testConversion(url: string): string {
  const result = normalizeVideoUrl(url);
  return result.directUrl;
}
