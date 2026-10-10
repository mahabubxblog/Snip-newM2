# SnipTok 100% Free Video Hosting & Auto-Recovery Plan (Revised)

Detailed breakdown and permanent code implementation providing **100% FREE video hosting** without Student Pack or Premium requirements, plus auto-recovery to permanently fix CORS errors on Vercel.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Cost & Account Verification for Method 1 & Method 2:**
> 
> 1. **Method 1: GitHub Releases (১০০% ফ্রি — কোনো Student Pack বা Premium দরকার নেই)**
>    - **খরচ**: $0.00 (সম্পূর্ণ ফ্রি)।
>    - **প্রয়োজনীয়তা**: একটি সাধারণ ফ্রি GitHub একাউন্ট (যেটি আপনি ইতিমধ্যে ব্যবহার করছেন)। কোনো Student Developer Pack, কোনো Pro সাবস্ক্রিপশন বা ক্রেডিট কার্ডের প্রয়োজন নেই।
>    - **সুবিধা**:
>      - প্রতিটি ভিডিও সর্বোচ্চ **2 GB** পর্যন্ত হতে পারে।
>      - ফাইল সরাসরি GitHub / Fastly গ্লোবাল সিডিএন থেকে ক্যাশ হয়ে আসে।
>      - ১০০% **CORS হেডার সাপোর্ট** করে, তাই Brave ব্রাউজার বা মোবাইলে কখনো ব্লক হয় না।
>    - **কীভাবে আপলোড করবেন (৩টি সহজ ধাপ)**:
>      1. আপনার GitHub রিপোজিটরির **"Releases"** অপশনে যান (ডানপাশে দেখতে পাবেন) অথবা `github.com/<username>/<repo>/releases/new` এ যান।
>      2. একটি ট্যাগ নাম দিন (যেমন `v1.0`) এবং আপনার MP4 ভিডিওটি ড্র্যাগ-অ্যান্ড-ড্রপ করে ছেড়ে দিন।
>      3. "Publish release" এ ক্লিক করুন। আপলোড করা ফাইলের ওপর রাইট ক্লিক করে "Copy link address" নিন। লিঙ্কটি দেখতে হবে:  
>         `https://github.com/<user>/<repo>/releases/download/v1.0/myvideo.mp4`
> 
> 2. **Method 2: Cloudinary Free Tier (১০০% ফ্রি — নো ক্রেডিট কার্ড)**
>    - **খরচ**: $0.00 (ফ্রি ফরএভার)।
>    - **প্রয়োজনীয়তা**: cloudinary.com-এ সাধারণ ইমেইল দিয়ে সাইন আপ (কোনো ক্রেডিট কার্ড চায় না)।
>    - **সুবিধা**:
>      - প্রতি মাসে ২৫ ক্রেডিট (২৫ জিবি ব্যান্ডউইথ এবং ভিডিও স্টোরেজ) আজীবন ফ্রি।
>      - স্বয়ংক্রিয় মোবাইল ভিডিও অপ্টিমাইজেশন (H.264 / WebM)।
>      - বিশ্বমানের গ্লোবাল ভিডিও সিডিএন ও ফুল CORS সাপোর্ট।
>    - **কীভাবে ব্যবহার করবেন**:
>      1. cloudinary.com এ লগইন করে Media Explorer-এ আপনার ভিডিও আপলোড করুন।
>      2. ভিডিও লিঙ্কের পাশে "Copy URL" চাপুন।
>      3. সরাসরি সেই লিঙ্ক SnipTok এডমিন স্টুডিওতে পেস্ট করলেই স্মুথলি প্লে হবে।

---

### 1. Overview & Core Concept

- **Core Deliverable**: 
  1. Admin Studio-তে একটি পূর্ণাঙ্গ **"ফ্রি ভিডিও হোস্টিং গাইড"** ট্যাব যুক্ত করা যাতে GitHub Releases ও Cloudinary-র লাইভ উদাহরণ ও টেস্ট বোতাম থাকে।
  2. `ReelPlayer` কম্পোনেন্টে স্মার্ট অটো-রিকভারি ও অটো-স্কিপ চালু করা যাতে কোনো ভিডিও সাময়িকভাবে ফেইল করলে পুরো স্ক্রিন আটকে না থাকে, স্বয়ংক্রিয়ভাবে পরবর্তী ভিডিও প্লে হয়।
  3. `public/videos.json`-এর ডিফল্ট লিঙ্কগুলো ভেরিফায়েড হাই-স্পিড সিডিএন স্ট্রিমে রূপান্তর করা।
- **টোটাল কস্ট**: **$0.00 (শূন্য টাকা/ডলার)**।

---

### 2. User Experience & Visual Design

- **স্মার্ট প্লেয়ার রেজিলিয়েন্স**:
  - কোনো লিঙ্ক ব্লকড বা ব্রোকেন হলে কালো এরর স্ক্রিনের পরিবর্তে ২ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে পরবর্তী ভিডিওতে চলে যাবে।
  - ইউজারকে একটি সুন্দর নোটিফিকেশন দেওয়া হবে: *"ভিডিও লোড হতে সমস্যা হওয়ায় পরবর্তী ভিডিও চালু করা হয়েছে"*।
- **এডমিন স্টুডিও ইন্টিগ্রেটেড গাইড**:
  - এডমিন মডালে GitHub Releases এবং Cloudinary ব্যবহারের সহজ বাংলা টিউটোরিয়াল ও সরাসরি লিঙ্কের স্যাম্পল ফরম্যাট প্রিভিউ।

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: GitHub Releases কে প্রধান ফ্রি স্টোরেজ হিসেবে অগ্রাধিকার দেওয়া**:
  - *Chosen Approach*: যেহেতু আপনার ইতিমধ্যে GitHub রিপোজিটরি আছে, GitHub Releases ব্যবহার করা সবচেয়ে সুবিধাজনক কারণ এতে নতুন কোনো থার্ড-পার্টি সার্ভিস খুলতে হয় না।
  - *Alternative*: Dropbox ব্যবহার করলে ব্রাউজার ক্যাশে (IndexedDB) অটো-ডাউনলোড করে লোকাল ব্লব তৈরি করা হবে।

---

### 4. Technical Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   Zero-Cost Video Streaming Architecture         │
└──────────────────────────────────────────────────────────────────┘
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     ▼                                                       ▼
[ GitHub Releases CDN ]                                 [ Cloudinary Free ]
• 100% Free (No Student Pack/Pro)                       • 25GB/mo Free
• 2GB per video, Full CORS                              • Auto-transcode, CORS
     │                                                       │
     └───────────────────────────┬───────────────────────────┘
                                 ▼
                     [ ReelPlayer Stream Engine ]
                                 │
                 ┌───────────────┴───────────────┐
                 ▼ (Success)                     ▼ (CORS / Network Error)
          [ Smooth Play ]               [ Auto-Recovery Pipeline ]
                                        ├── 1. Try Blob/Cache
                                        ├── 2. Show Bengali Alert
                                        └── 3. Auto-Advance to Next Reel
```
