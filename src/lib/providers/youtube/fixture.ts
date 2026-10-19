import type { YouTubeAccount } from "@/lib/providers/youtube/api";

const day = 24 * 60 * 60 * 1000;

export const youtubePreviewAccount: YouTubeAccount = {
  channelId: "UCdiwanpreview01",
  title: "ورشة الضوء",
  avatarUrl: null,
  subscriberCount: 128430,
  hiddenSubscriberCount: false,
  viewCount: 5420911,
  videoCount: 86,
  videos: [
    {
      id: "previewlight1",
      title: "كيف أضبط إضاءة المقابلة في غرفة صغيرة",
      publishedAt: new Date(Date.now() - 2 * day).toISOString(),
      thumbnailUrl: null,
      viewCount: 48210,
      likeCount: 3102,
      commentCount: 186,
    },
    {
      id: "previewlight2",
      title: "مقارنة ميكروفونين رخيصين لتسجيل الصوت",
      publishedAt: new Date(Date.now() - 9 * day).toISOString(),
      thumbnailUrl: null,
      viewCount: 22044,
      likeCount: 980,
      commentCount: 74,
    },
    {
      id: "previewlight3",
      title: "ترتيب المكتب قبل تسجيل حلقة طويلة",
      publishedAt: new Date(Date.now() - 21 * day).toISOString(),
      thumbnailUrl: null,
      viewCount: 15320,
      likeCount: 640,
      commentCount: 41,
    },
  ],
};
