import { GitHubSyncConfig, VideoItem } from '../types';

export interface VerifyResult {
  success: boolean;
  message: string;
  repoFullName?: string;
  defaultBranch?: string;
  hasPushAccess?: boolean;
  rateLimitRemaining?: number;
}

export interface CommitResult {
  success: boolean;
  message: string;
  commitSha?: string;
  htmlUrl?: string;
}

/**
 * Modern, robust Unicode UTF-8 Base64 encoding for Bengali script and emojis
 */
function utf8ToBase64(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch {
    // Fallback
    return window.btoa(unescape(encodeURIComponent(str)));
  }
}

/**
 * Decode Base64 to Unicode string
 */
function base64ToUtf8(b64: string): string {
  try {
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return decodeURIComponent(escape(window.atob(b64)));
  }
}

/**
 * Verify GitHub Token and repository access
 */
export async function verifyGitHubRepo(
  config: Pick<GitHubSyncConfig, 'owner' | 'repo' | 'token'>
): Promise<VerifyResult> {
  const { owner, repo, token } = config;

  if (!owner?.trim() || !repo?.trim()) {
    return {
      success: false,
      message: 'GitHub Owner এবং Repository এর নাম প্রদান করুন।',
    };
  }

  if (!token?.trim()) {
    return {
      success: false,
      message: 'GitHub Personal Access Token (PAT) প্রদান করুন।',
    };
  }

  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(
      repo.trim()
    )}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const rateRemainingHeader = response.headers.get('x-ratelimit-remaining');
    const rateLimitRemaining = rateRemainingHeader ? parseInt(rateRemainingHeader, 10) : undefined;

    if (response.status === 401) {
      return {
        success: false,
        message: 'টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ (401 Unauthorized)। অনুগ্রহ করে নতুন Classic Token তৈরি করুন।',
        rateLimitRemaining,
      };
    }

    if (response.status === 403) {
      const errData = await response.json().catch(() => ({}));
      const isRateLimit = errData.message && errData.message.includes('rate limit');
      return {
        success: false,
        message: isRateLimit
          ? 'GitHub API রেট লিমিট শেষ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
          : 'অনুমতি নেই (403 Forbidden)। টোকেনে "repo" স্কোপ আছে কিনা নিশ্চিত করুন।',
        rateLimitRemaining,
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        message: `রিপোজিটরি পাওয়া যায়নি (${owner}/${repo})। নাম অথবা টোকেনে প্রাইভেট রিপো অ্যাক্সেস স্কোপ চেক করুন।`,
        rateLimitRemaining,
      };
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `GitHub API ত্রুটি (${response.status}): ${errData.message || 'অজানা সমস্যা'}`,
        rateLimitRemaining,
      };
    }

    const data = await response.json();
    const hasPushAccess = !!(data.permissions && data.permissions.push);

    return {
      success: true,
      message: hasPushAccess
        ? `সফলভাবে ভেরিফাই হয়েছে! রিপোজিটরি: ${data.full_name} (Write Permission Active)`
        : `রিপোজিটরি পাওয়া গেছে (${data.full_name}), তবে পুশ পারমিশন নেই। টোকেনে 'repo' সিলেক্ট করুন।`,
      repoFullName: data.full_name,
      defaultBranch: data.default_branch || 'main',
      hasPushAccess,
      rateLimitRemaining,
    };
  } catch (err) {
    return {
      success: false,
      message: `নেটওয়ার্ক বা সংযোগ ত্রুটি: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Fetch remote videos.json directly from GitHub repository
 */
export async function fetchRemoteVideosFromGitHub(
  config: GitHubSyncConfig
): Promise<{ success: boolean; data?: VideoItem[]; message: string }> {
  const { owner, repo, token, branch = 'main', filePath = 'public/videos.json' } = config;

  if (!owner?.trim() || !repo?.trim()) {
    return { success: false, message: 'GitHub Owner এবং Repo নাম প্রয়োজন।' };
  }

  try {
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(
      repo.trim()
    )}/contents/${filePath.trim()}?ref=${encodeURIComponent(branch.trim() || 'main')}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (token?.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) {
      return {
        success: false,
        message: `ফাইল রিড করা যায়নি (Status: ${res.status})`,
      };
    }

    const fileData = await res.json();
    if (!fileData.content) {
      return { success: false, message: 'ফাইলের কনটেন্ট ফাঁকা।' };
    }

    const cleanBase64 = fileData.content.replace(/\s/g, '');
    const decodedStr = base64ToUtf8(cleanBase64);
    const parsed = JSON.parse(decodedStr);

    if (Array.isArray(parsed)) {
      return {
        success: true,
        data: parsed,
        message: `${parsed.length} টি ভিডিও GitHub থেকে সফলভাবে লোড হয়েছে।`,
      };
    }

    return { success: false, message: 'JSON ফরম্যাট সঠিক নয়।' };
  } catch (err) {
    return {
      success: false,
      message: `GitHub থেকে লোড করতে ব্যর্থ: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Commits the current videos list directly to public/videos.json in GitHub repo
 */
export async function commitVideosListToGitHub(
  config: GitHubSyncConfig,
  videos: VideoItem[]
): Promise<CommitResult> {
  const { owner, repo, token, branch = 'main', filePath = 'public/videos.json' } = config;

  if (!owner?.trim() || !repo?.trim() || !token?.trim()) {
    return {
      success: false,
      message: 'GitHub সেটিংস অসম্পূর্ণ। Owner, Repo এবং Token প্রদান করুন।',
    };
  }

  try {
    const safeVideos = Array.isArray(videos) ? videos : [];
    // Sanitize items: remove any local memory object URLs before storing to remote JSON
    const cleanVideos = safeVideos.map((v) => {
      const { objectUrl, loadError, ...rest } = v;
      return rest;
    });

    const fileContentStr = JSON.stringify(cleanVideos, null, 2);
    const contentBase64 = utf8ToBase64(fileContentStr);

    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(
      repo.trim()
    )}/contents/${filePath.trim()}`;

    // Step 1: Check if file already exists to get its SHA
    let existingSha: string | undefined = undefined;
    try {
      const getFileRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch.trim() || 'main')}`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (getFileRes.ok) {
        const fileData = await getFileRes.json();
        existingSha = fileData.sha;
      }
    } catch {
      // file might not exist yet, proceed with creation
    }

    // Step 2: PUT commit
    const putPayload: {
      message: string;
      content: string;
      branch: string;
      sha?: string;
    } = {
      message: `Update SnipTok videos feed (${cleanVideos.length} reels) via Admin Studio [skip ci]`,
      content: contentBase64,
      branch: branch.trim() || 'main',
    };

    if (existingSha) {
      putPayload.sha = existingSha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(putPayload),
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      return {
        success: false,
        message: `GitHub Commit ব্যর্থ হয়েছে (${putRes.status}): ${errData.message || putRes.statusText}`,
      };
    }

    const resultData = await putRes.json();

    return {
      success: true,
      message: `সফলভাবে GitHub এ সরাসরি আপডেট হয়েছে! (${filePath} - Commit SHA: ${
        resultData.commit?.sha?.substring(0, 7) || 'OK'
      })`,
      commitSha: resultData.commit?.sha,
      htmlUrl: resultData.commit?.html_url,
    };
  } catch (err) {
    return {
      success: false,
      message: `GitHub সিঙ্ক করতে সমস্যা হয়েছে: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
