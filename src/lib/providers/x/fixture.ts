import type { XAccount } from "@/lib/providers/x/api";

export const xPreviewAccount: XAccount = {
  id: "preview-user",
  name: "ديوان للتجربة",
  username: "diwan_preview",
  avatarUrl: null,
  description: "معاينة محلية لصفحة X قبل ربط حساب حقيقي.",
  verified: false,
  followersCount: 4820,
  followingCount: 140,
  tweetCount: 86,
  tweets: [
    {
      id: "preview-post-1",
      text: "ملاحظة قصيرة عن المطبخ والموسم.",
      createdAt: "2026-09-28T10:00:00.000Z",
      impressionCount: 12040,
      likeCount: 860,
      replyCount: 42,
      repostCount: 30,
      quoteCount: 6,
      bookmarkCount: 18,
    },
    {
      id: "preview-post-2",
      text: "رابط لقراءة أطول.",
      createdAt: "2026-09-12T15:30:00.000Z",
      impressionCount: 4300,
      likeCount: 210,
      replyCount: 11,
      repostCount: 8,
      quoteCount: 2,
      bookmarkCount: 7,
    },
  ],
};
