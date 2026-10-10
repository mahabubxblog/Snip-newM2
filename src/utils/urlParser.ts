/**
 * Dropbox & Cloud Video Streaming URL Normalization Engine
 *
 * Requirements & Edge Cases:
 * 1. Standard Dropbox:
 *    https://www.dropbox.com/s/.../video.mp4?dl=0 -> ...video.mp4?raw=1
 * 2. Modern Dropbox SCL:
 *    https://www.dropbox.com/scl/fi/.../video.mp4?rlkey=...&dl=0 -> ...&raw=1
 *    CRITICAL: Preserves 'www.dropbox.com' host! DO NOT change host to dl.dropboxusercontent.com for SCL links.
 * 3. Variant Dropbox Hosts:
 *    dropbox.com or dl.dropbox.com or dl.dropboxusercontent.com -> normalized to www.dropbox.com with raw=1
 * 4. Google Drive:
 *    https://drive.google.com/file/d/{id}/view -> https://drive.google.com/uc?export=download&id={id}
 *    https://drive.google.com/open?id={id} -> https://drive.google.com/uc?export=download&id={id}
 * 5. Direct Video Streams (.mp4, .webm, .m4v, .mov)
 * 6. Social Web Link Warnings (YouTube/Instagram/TikTok page links that require video file bytes)
 */

export interface NormalizedUrlResult {
  directUrl: string;
  provider: 'dropbox' | 'gdrive' | 'direct' | 'unsupported_social' | 'unknown';
  isValid: boolean;
  notes: string;
  originalUrl: string;
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

    // 1. Check for unsupported social web pages (e.g. YouTube watch pages, Instagram post pages)
    const hostLower = parsed.hostname.toLowerCase();
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
          'সোশ্যাল মিডিয়া পেজ লিংক সরাসরি HTML পেইজ লোড করে, ভিডিও ফাইল নয়। অনুগ্রহ করে Dropbox Share লিংক বা সরাসরি .mp4/.webm স্ট্রিমিং লিংক ব্যবহার করুন।',
        originalUrl: trimmed,
      };
    }

    // 2. DROPBOX NORMALIZATION
    if (hostLower.includes('dropbox.com') || hostLower.includes('dropboxusercontent.com')) {
      // Normalize host strictly to www.dropbox.com
      parsed.hostname = 'www.dropbox.com';

      // Set raw=1 and remove dl parameter
      parsed.searchParams.set('raw', '1');
      parsed.searchParams.delete('dl');

      const isScl = parsed.pathname.includes('/scl/fi/');
      const notes = isScl
        ? 'Dropbox SCL লিঙ্ক সফলভাবে raw=1 সরাসরি স্ট্রিমে রূপান্তর করা হয়েছে (CORS সাপোর্টেড)'
        : 'Dropbox লিঙ্ক সফলভাবে raw=1 সরাসরি স্ট্রিমে রূপান্তর করা হয়েছে';

      return {
        directUrl: parsed.toString(),
        provider: 'dropbox',
        isValid: true,
        notes,
        originalUrl: trimmed,
      };
    }

    // 3. GOOGLE DRIVE NORMALIZATION
    if (hostLower.includes('drive.google.com')) {
      // Pattern 1: /file/d/{fileId}/view
      const matchFileId = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (matchFileId && matchFileId[1]) {
        const fileId = matchFileId[1];
        return {
          directUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
          provider: 'gdrive',
          isValid: true,
          notes: `Google Drive ফাইল আইডি (${fileId}) সরাসরি ডাউনলোড স্ট্রিমে রূপান্তর করা হয়েছে`,
          originalUrl: trimmed,
        };
      }

      // Pattern 2: ?id={fileId}
      const queryId = parsed.searchParams.get('id');
      if (queryId) {
        return {
          directUrl: `https://drive.google.com/uc?export=download&id=${queryId}`,
          provider: 'gdrive',
          isValid: true,
          notes: 'Google Drive সরাসরি ডাউনলোড লিংক হিসেবে প্রস্তুত করা হয়েছে',
          originalUrl: trimmed,
        };
      }
    }

    // 4. DIRECT VIDEO EXTENSIONS OR CDNs
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
      };
    }

    // 5. Standard HTTP / HTTPS URL Fallback
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return {
        directUrl: trimmed,
        provider: 'unknown',
        isValid: true,
        notes: 'সাধারণ ওয়েব মিডিয়া লিংক হিসেবে গ্রহণ করা হয়েছে',
        originalUrl: trimmed,
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
 * Test helper to verify conversion against Dropbox / GDrive formats
 */
export function testDropboxConversion(url: string): string {
  const result = normalizeVideoUrl(url);
  return result.directUrl;
}
