import { CloudSyncConfig, VideoItem } from '../types';

const CLOUD_CONFIG_STORAGE_KEY = 'sniptok_cloud_sync_config';

export const DEFAULT_CLOUD_CONFIG: CloudSyncConfig = {
  provider: 'server',
  binId: '',
  apiKey: '',
  customUrl: '',
  autoSync: true,
  syncIntervalSeconds: 30,
};

/**
 * Detect whether the app is running on a static host (GitHub Pages, file protocol, etc.)
 * where server-side Express routes (/api/videos) are unavailable.
 */
export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.includes('github.io') ||
    window.location.protocol === 'file:'
  );
}

/**
 * Get saved Cloud Sync configuration from LocalStorage
 */
export function getStoredCloudConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const isStatic = isStaticHosting();
      // On static hosting (like GitHub Pages), default provider away from non-existent /api server
      const defaultProvider = isStatic ? 'npoint' : 'server';
      return {
        ...DEFAULT_CLOUD_CONFIG,
        provider: defaultProvider,
        ...parsed,
        // Override 'server' on GitHub Pages so users aren't misled into 405 errors
        ...(isStatic && parsed.provider === 'server' ? { provider: 'npoint' } : {}),
      };
    }
  } catch (err) {
    console.warn('Could not read cloud sync config from storage:', err);
  }
  return {
    ...DEFAULT_CLOUD_CONFIG,
    provider: isStaticHosting() ? 'npoint' : 'server',
  };
}

/**
 * Save Cloud Sync configuration to LocalStorage
 */
export function saveCloudConfig(config: CloudSyncConfig): void {
  try {
    localStorage.setItem(CLOUD_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Could not save cloud sync config to storage:', err);
  }
}

/**
 * Clean VideoItem array so that in-memory ObjectURLs or temporary errors
 * are not pushed to the cloud.
 */
export function sanitizeVideosForCloud(videos: VideoItem[]): VideoItem[] {
  if (!Array.isArray(videos)) return [];
  return videos.map((v) => {
    const { objectUrl, loadError, ...rest } = v;
    return rest;
  });
}

/**
 * Test a Cloud Endpoint (jsonbin, npoint, server, or custom)
 */
export async function testCloudEndpoint(config: CloudSyncConfig): Promise<{
  success: boolean;
  message: string;
  videosCount?: number;
}> {
  try {
    if (config.provider === 'server') {
      if (isStaticHosting()) {
        return {
          success: false,
          message: 'GitHub Pages বা স্ট্যাটিক হোস্টিং-এ এক্সপ্রেস ব্যাকএন্ড সক্রিয় থাকে না। আপনার আসল ডেটাবেজ হলো GitHub Repository (public/videos.json)। অনুগ্রহ করে "GitHub লাইভ সিঙ্ক" ট্যাব ব্যবহার করুন!',
        };
      }
      const res = await fetch('/api/videos', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          message: 'সার্ভার থেকে JSON এর পরিবর্তে স্ট্যাটিক ওয়েবপেজ পাওয়া গেছে (API সক্রিয় নয়)। অনুগ্রহ করে "GitHub লাইভ সিঙ্ক" বা npoint.io ব্যবহার করুন।',
        };
      }
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        return {
          success: true,
          message: `সার্ভার সংযোগ সফল! বর্তমানে ${count}টি ভিডিও লোড হয়েছে।`,
          videosCount: count,
        };
      } else {
        return {
          success: false,
          message: `সার্ভার সংযোগে ত্রুটি (স্ট্যাটাস: ${res.status})`,
        };
      }
    }

    if (config.provider === 'npoint') {
      if (!config.binId.trim()) {
        return { success: false, message: 'npoint বিন আইডি দিন (যেমন: a1b2c3d4)' };
      }
      const cleanBin = config.binId.trim().replace(/^https:\/\/api\.npoint\.io\//, '');
      const res = await fetch(`https://api.npoint.io/${cleanBin}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        return {
          success: true,
          message: `npoint.io বিন সংযোগ সফল! ${count}টি ভিডিও পাওয়া গেছে।`,
          videosCount: count,
        };
      } else {
        return {
          success: false,
          message: `npoint বিন পাওয়া যায়নি বা এক্সেস নেই (স্ট্যাটাস: ${res.status})`,
        };
      }
    }

    if (config.provider === 'jsonbin') {
      if (!config.binId.trim()) {
        return { success: false, message: 'JSONBin বিন আইডি দিন' };
      }
      const cleanBin = config.binId.trim().replace(/^https:\/\/api\.jsonbin\.io\/v3\/b\//, '').replace(/\/latest$/, '');
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
      };
      if (config.apiKey?.trim()) {
        headers['X-Master-Key'] = config.apiKey.trim();
      }

      const res = await fetch(`https://api.jsonbin.io/v3/b/${cleanBin}/latest?t=${Date.now()}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        let list: unknown = data;
        if (data && typeof data === 'object' && 'record' in data) {
          list = data.record;
        }
        const count = Array.isArray(list) ? list.length : 0;
        return {
          success: true,
          message: `JSONBin.io সংযোগ সফল! ${count}টি ভিডিও রেকর্ড পাওয়া গেছে।`,
          videosCount: count,
        };
      } else {
        return {
          success: false,
          message: `JSONBin সংযোগ ত্রুটি (${res.status})। বিন আইডি বা মাস্টার কি চেক করুন।`,
        };
      }
    }

    if (config.provider === 'custom') {
      if (!config.customUrl?.trim()) {
        return { success: false, message: 'কাস্টম JSON URL প্রদান করুন' };
      }
      const res = await fetch(`${config.customUrl.trim()}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        return {
          success: true,
          message: `কাস্টম URL সংযোগ সফল! ${count}টি ভিডিও পাওয়া গেছে।`,
          videosCount: count,
        };
      } else {
        return {
          success: false,
          message: `কাস্টম URL সংযোগ ব্যর্থ (স্ট্যাটাস: ${res.status})`,
        };
      }
    }

    return { success: false, message: 'অজানা ক্লাউড প্রোভাইডার' };
  } catch (err) {
    return {
      success: false,
      message: `সংযোগ পরীক্ষা ব্যর্থ: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Fetch video list from the active Cloud configuration
 */
export async function fetchVideosFromCloud(config?: CloudSyncConfig): Promise<{
  success: boolean;
  videos?: VideoItem[];
  message: string;
}> {
  const activeConfig = config || getStoredCloudConfig();

  try {
    // 1. Try Server Endpoint if configured or fallback
    if (activeConfig.provider === 'server') {
      if (isStaticHosting()) {
        return {
          success: false,
          message: 'GitHub Pages এ লোকাল এক্সপ্রেস সার্ভার নিষ্ক্রিয়',
        };
      }
      try {
        const res = await fetch('/api/videos', {
          headers: { 'Cache-Control': 'no-cache, no-store' },
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            return {
              success: true,
              videos: list as VideoItem[],
              message: `সার্ভার থেকে ${list.length}টি ভিডিও সফলভাবে লোড হয়েছে`,
            };
          }
        }
      } catch (err) {
        console.warn('Server fetch error:', err);
      }
    }

    // 2. npoint.io
    if (activeConfig.provider === 'npoint' && activeConfig.binId.trim()) {
      const cleanBin = activeConfig.binId.trim().replace(/^https:\/\/api\.npoint\.io\//, '');
      const res = await fetch(`https://api.npoint.io/${cleanBin}?t=${Date.now()}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          return {
            success: true,
            videos: list as VideoItem[],
            message: `npoint.io থেকে ${list.length}টি ভিডিও সিঙ্ক হয়েছে`,
          };
        }
      }
    }

    // 3. JSONBin.io
    if (activeConfig.provider === 'jsonbin' && activeConfig.binId.trim()) {
      const cleanBin = activeConfig.binId.trim().replace(/^https:\/\/api\.jsonbin\.io\/v3\/b\//, '').replace(/\/latest$/, '');
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
      };
      if (activeConfig.apiKey?.trim()) {
        headers['X-Master-Key'] = activeConfig.apiKey.trim();
      }

      const res = await fetch(`https://api.jsonbin.io/v3/b/${cleanBin}/latest?t=${Date.now()}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        let list: unknown = data;
        if (data && typeof data === 'object' && 'record' in data) {
          list = data.record;
        }
        if (Array.isArray(list)) {
          return {
            success: true,
            videos: list as VideoItem[],
            message: `JSONBin থেকে ${list.length}টি ভিডিও সিঙ্ক হয়েছে`,
          };
        }
      }
    }

    // 4. Custom URL
    if (activeConfig.provider === 'custom' && activeConfig.customUrl?.trim()) {
      const res = await fetch(`${activeConfig.customUrl.trim()}?t=${Date.now()}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          return {
            success: true,
            videos: list as VideoItem[],
            message: `কাস্টম ক্লাউড থেকে ${list.length}টি ভিডিও সিঙ্ক হয়েছে`,
          };
        }
      }
    }

    return {
      success: false,
      message: 'ক্লাউড থেকে কোনো ভিডিও লোড করা যায়নি',
    };
  } catch (err) {
    return {
      success: false,
      message: `ক্লাউড ফেচ ত্রুটি: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Push updated videos list to the configured Cloud Provider
 */
export async function pushVideosToCloud(
  videos: VideoItem[],
  config?: CloudSyncConfig,
  adminPassword = 'Ma44332211'
): Promise<{
  success: boolean;
  message: string;
  count?: number;
}> {
  const activeConfig = config || getStoredCloudConfig();
  const sanitized = sanitizeVideosForCloud(videos);

  try {
    // 1. Built-in Server route
    if (activeConfig.provider === 'server') {
      if (isStaticHosting()) {
        return {
          success: false,
          message: 'GitHub Pages বা স্ট্যাটিক হোস্টিং-এ এক্সপ্রেস ব্যাকএন্ড সক্রিয় থাকে না। আপনার আসল ডেটাবেজ হলো GitHub Repository (public/videos.json)। অনুগ্রহ করে "GitHub লাইভ সিঙ্ক" ট্যাব ব্যবহার করে আপনার গিটহাবে অটো-কমিট করুন!',
        };
      }

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: adminPassword,
          videos: sanitized,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return {
          success: false,
          message: `সার্ভার এরর (স্ট্যাটাস: ${res.status}): এই হোস্টিংয়ে এক্সপ্রেস ব্যাকএন্ড সক্রিয় নয়। অনুগ্রহ করে "GitHub লাইভ সিঙ্ক" ব্যবহার করুন।`,
        };
      }

      if (res.ok) {
        const data = await res.json();
        // Update last sync time
        saveCloudConfig({
          ...activeConfig,
          lastSyncedAt: new Date().toISOString(),
        });
        return {
          success: true,
          count: sanitized.length,
          message: data.message || `সার্ভারে ${sanitized.length}টি ভিডিও সফলভাবে আপডেট হয়েছে!`,
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errData.message || `সার্ভার আপডেট ব্যর্থ হয়েছে (স্ট্যাটাস: ${res.status})`,
        };
      }
    }

    // 2. npoint.io
    if (activeConfig.provider === 'npoint') {
      if (!activeConfig.binId.trim()) {
        return { success: false, message: 'npoint বিন আইডি প্রদান করুন' };
      }
      const cleanBin = activeConfig.binId.trim().replace(/^https:\/\/api\.npoint\.io\//, '');
      const res = await fetch(`https://api.npoint.io/${cleanBin}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitized),
      });

      if (res.ok) {
        saveCloudConfig({
          ...activeConfig,
          lastSyncedAt: new Date().toISOString(),
        });
        return {
          success: true,
          count: sanitized.length,
          message: `npoint.io তে ${sanitized.length}টি ভিডিও সফলভাবে সেভ হয়েছে! সকল ফোনে ইনস্ট্যান্ট সিঙ্ক হবে।`,
        };
      } else {
        return {
          success: false,
          message: `npoint.io সেভ ব্যর্থ (স্ট্যাটাস: ${res.status})`,
        };
      }
    }

    // 3. JSONBin.io
    if (activeConfig.provider === 'jsonbin') {
      if (!activeConfig.binId.trim()) {
        return { success: false, message: 'JSONBin বিন আইডি দিন' };
      }
      if (!activeConfig.apiKey?.trim()) {
        return { success: false, message: 'JSONBin Master-Key প্রয়োজন (রাইট পারমিশনের জন্য)' };
      }

      const cleanBin = activeConfig.binId.trim().replace(/^https:\/\/api\.jsonbin\.io\/v3\/b\//, '').replace(/\/latest$/, '');
      const res = await fetch(`https://api.jsonbin.io/v3/b/${cleanBin}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': activeConfig.apiKey.trim(),
        },
        body: JSON.stringify(sanitized),
      });

      if (res.ok) {
        saveCloudConfig({
          ...activeConfig,
          lastSyncedAt: new Date().toISOString(),
        });
        return {
          success: true,
          count: sanitized.length,
          message: `JSONBin এ ${sanitized.length}টি ভিডিও সংরক্ষিত হয়েছে! লাইভ আপডেট একটিভ।`,
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          message: `JSONBin আপডেট ব্যর্থ (${res.status}): ${errJson.message || 'অননুমোদিত বা ভুল কি'}`,
        };
      }
    }

    return {
      success: false,
      message: 'নির্বাচিত প্রোভাইডারের জন্য পুশ মেথড পাওয়া যায়নি',
    };
  } catch (err) {
    return {
      success: false,
      message: `ক্লাউড পুশ ব্যর্থ হয়েছে: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
