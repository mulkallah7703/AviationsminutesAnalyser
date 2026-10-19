import type { ProviderMeta } from "@/lib/providers/types";

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
] as const;

export const TIKTOK_SCOPE = TIKTOK_SCOPES.join(",");

export const TIKTOK_CALLBACK_PATH = "/api/auth/tiktok/callback";

export const tiktokMeta: ProviderMeta = {
  id: "tiktok",
  name: "TikTok",
  summaryAr: "اسم العرض، المتابعون، الإعجابات، وآخر المقاطع مع المشاهدات والمشاركات.",
  availability: "ready",
  accent: "#111111",
  consoleUrl: "https://developers.tiktok.com/apps",
  consoleLinkLabel: "TikTok for Developers",
  extraLinks: [
    {
      href: "https://developers.tiktok.com/doc/login-kit-web",
      labelAr: "دليل Login Kit للويب",
    },
    {
      href: "https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info",
      labelAr: "بيانات المستخدم",
    },
  ],
  credentialFields: [
    {
      key: "clientKey",
      label: "Client Key",
      labelAr: "مفتاح العميل",
      helpAr: "Client Key من صفحة التطبيق في TikTok for Developers. بعد الحفظ يُعرض آخر أربعة أحرف فقط.",
      secret: false,
      placeholder: "awxxxxxxxxxxxxxxxx",
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      labelAr: "سر العميل",
      helpAr: "Client Secret من التطبيق نفسه. يُحفظ مشفّراً ولا يُعرض بعد الحفظ. اتركه فارغاً للإبقاء على السر المحفوظ.",
      secret: true,
      placeholder: "••••••••",
    },
    {
      key: "publicBaseUrl",
      label: "HTTPS origin",
      labelAr: "أصل HTTPS العام",
      helpAr:
        "اختياري. اتركه فارغاً إذا فتحت ديوان على http://localhost أو http://127.0.0.1. إذا وصلت عبر نفق مثل ngrok، ضع الأصل فقط، مثل https://your-name.ngrok-free.app، بلا مسار.",
      secret: false,
      optional: true,
      reveal: true,
      placeholder: "https://your-name.ngrok-free.app",
    },
  ],
  setupSteps: [
    {
      titleAr: "أنشئ تطبيقاً",
      bodyAr:
        "من developers.tiktok.com سجّل الدخول وأنشئ تطبيقاً. أضف منتج Login Kit، ثم أضف المنتجات التي تمنح user info و video.list إن طُلبت بشكل منفصل.",
    },
    {
      titleAr: "أضف عنوان العودة والمستخدمين التجريبيين",
      bodyAr:
        "في إعدادات Login Kit الصق عنوان إعادة التوجيه الظاهر أدناه كما هو. التطبيق يبدأ في وضع Sandbox: أضف حساب TikTok الذي ستجرب به ضمن Target users، ثم اقبل الدعوة من ذلك الحساب.",
    },
    {
      titleAr: "انسخ المفتاح والسر",
      bodyAr:
        "من بيانات التطبيق انسخ Client Key و Client Secret إلى هذا النموذج واحفظ. المستخدمون بعدها يضغطون ربط وينتقلون مباشرة إلى شاشة موافقة TikTok.",
    },
    {
      titleAr: "العنوان العام يحتاج HTTPS",
      bodyAr:
        "TikTok يقبل http://localhost و http://127.0.0.1، ويرفض عناوين الشبكة المحلية الأخرى. للوصول من جهاز آخر استخدم نفقاً عاماً بـ https وضع أصله في الحقل الاختياري. في هذه الحالة يُرسل PKCE تلقائياً لعناوين الاسترجاع فقط، ولكل عمليات TikTok يُستخدم تحدّي SHA-256 بصيغة hex.",
    },
  ],
  scopes: [
    {
      value: "user.info.basic",
      descriptionAr: "الاسم المعروض والصورة والمعرّف المفتوح.",
    },
    {
      value: "user.info.profile",
      descriptionAr: "اسم المستخدم والنبذة ورابط الملف.",
    },
    {
      value: "user.info.stats",
      descriptionAr: "عدد المتابعين ومن تتابعهم والإعجابات والمقاطع.",
    },
    {
      value: "video.list",
      descriptionAr: "قراءة المقاطع العامة: المشاهدات والإعجابات والتعليقات والمشاركات. بلا نشر.",
    },
  ],
  callbackPath: TIKTOK_CALLBACK_PATH,
  pagePath: "/tiktok",
  redirectPolicy: "tiktok",
  redirectHelpAr:
    "الصق هذا العنوان في Redirect URI داخل Login Kit. يجب أن يطابق ما يرسله ديوان حرفياً. http مسموح فقط لـ localhost و 127.0.0.1. أي عنوان آخر يجب أن يكون https.",
};
