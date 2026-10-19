import type { ProviderMeta } from "@/lib/providers/types";

export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export const YOUTUBE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

export const YOUTUBE_SCOPES = `${YOUTUBE_SCOPE} ${YOUTUBE_ANALYTICS_SCOPE}`;

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

/** Previous path. The dynamic auth route still accepts it. */
export const YOUTUBE_CALLBACK_PATH = "/api/auth/youtube/callback";

export const DEFAULT_GOOGLE_REDIRECT_URI = "http://localhost:5050/api/auth/google/callback";

export function youtubeRedirectUri(): string {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
  return fromEnv || DEFAULT_GOOGLE_REDIRECT_URI;
}

export const youtubeMeta: ProviderMeta = {
  id: "youtube",
  name: "YouTube",
  summaryAr: "اسم القناة، المشتركين، المشاهدات، وآخر المقاطع مع أرقام التفاعل.",
  availability: "ready",
  accent: "#d0121a",
  consoleUrl: "https://console.cloud.google.com/apis/credentials",
  consoleLinkLabel: "Google Cloud Credentials",
  redirectHelpAr:
    "الصق هذا العنوان كما هو في Authorized redirect URIs. الافتراضي هو http://localhost:5050/api/auth/google/callback. إذا ضُبط GOOGLE_REDIRECT_URI فهو الذي يُرسل إلى Google.",
  extraLinks: [
    {
      href: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
      labelAr: "تفعيل YouTube Data API v3",
    },
    {
      href: "https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com",
      labelAr: "تفعيل YouTube Analytics API",
    },
    {
      href: "https://console.cloud.google.com/auth/audience",
      labelAr: "المستخدمون التجريبيون (Test users)",
    },
    {
      href: "https://console.cloud.google.com/auth/clients",
      labelAr: "عملاء OAuth",
    },
  ],
  credentialFields: [
    {
      key: "clientId",
      label: "Client ID",
      labelAr: "معرّف العميل",
      helpAr:
        "المعرّف العام لعميل OAuth من نوع Web application. ينتهي عادةً بـ .apps.googleusercontent.com. بعد الحفظ يُعرض آخر أربعة أحرف فقط.",
      secret: false,
      placeholder: "1234567890-abc.apps.googleusercontent.com",
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      labelAr: "سر العميل",
      helpAr:
        "السر الخاص بالعميل نفسه. يُحفظ مشفّراً على هذا الجهاز ولا يُعرض بعد الحفظ. اترك الحقل فارغاً إذا أردت الإبقاء على السر المحفوظ.",
      secret: true,
      placeholder: "GOCSPX-…",
    },
  ],
  setupSteps: [
    {
      titleAr: "أنشئ مشروعاً وفعّل الواجهة",
      bodyAr:
        "في Google Cloud Console اختر مشروعاً أو أنشئ واحداً، ثم فعّل YouTube Data API v3 و YouTube Analytics API من مكتبة الواجهات. تفعيل الواجهة الأولى وحدها لا يكفي لملخص الفترة.",
    },
    {
      titleAr: "اضبط شاشة الموافقة وأضف نفسك",
      bodyAr:
        "من Google Auth Platform اجعل نوع الجمهور External، واترك التطبيق في وضع Testing. في Audience أضف بريد Google الذي ستدخل به ضمن Test users. بدون هذه الخطوة ترفض Google الدخول برسالة أن التطبيق قيد الاختبار.",
    },
    {
      titleAr: "أنشئ عميل ويب والصق عنوان العودة",
      bodyAr:
        "من Clients أو Credentials أنشئ OAuth client ID بنوع Web application. في Authorized redirect URIs الصق عنوان إعادة التوجيه الظاهر أدناه كما هو، بلا مسافة زائدة وبلا شرطة مائلة في النهاية.",
    },
    {
      titleAr: "انسخ الحقلين إلى هذا النموذج",
      bodyAr:
        "انسخ Client ID و Client Secret من صفحة العميل والصقهما هنا ثم احفظ. لا حاجة لتعديل أي ملف في المشروع.",
    },
  ],
  scopes: [
    {
      value: YOUTUBE_SCOPE,
      descriptionAr: "قراءة بيانات القناة وقائمة الرفع. لا تسمح بالنشر أو التعديل أو الحذف.",
    },
    {
      value: YOUTUBE_ANALYTICS_SCOPE,
      descriptionAr:
        "قراءة تقارير الفترة: المشاهدات والإعجابات والتعليقات والمشاركات والمشتركون المكتسبون والمفقودون. بلا تعديل على القناة.",
    },
  ],
  callbackPath: GOOGLE_CALLBACK_PATH,
  pagePath: "/youtube",
};
