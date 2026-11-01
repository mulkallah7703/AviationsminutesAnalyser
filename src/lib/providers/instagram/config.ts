import type { ProviderMeta } from "@/lib/providers/types";

/** Business Login for Instagram (Instagram API with Instagram Login). */
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"] as const;

export const INSTAGRAM_SCOPE = INSTAGRAM_SCOPES.join(",");

export const INSTAGRAM_INSIGHTS_SCOPE = "instagram_business_manage_insights";

export const INSTAGRAM_CALLBACK_PATH = "/api/auth/instagram/callback";

/** Latest Graph API version listed in the Instagram Platform reference (v26.0, June 2026). */
export const INSTAGRAM_API_VERSION = "v26.0";

export const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

export const instagramMeta: ProviderMeta = {
  id: "instagram",
  name: "Instagram",
  summaryAr: "المتابعون والمنشورات، ومشاهدات الحساب ووصوله وتفاعله خلال الفترة. يحتاج حساباً احترافياً (أعمال أو صانع محتوى).",
  availability: "ready",
  accent: "#c13584",
  consoleUrl: "https://developers.facebook.com/apps",
  consoleLinkLabel: "تطبيقات Meta",
  extraLinks: [
    {
      href: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login",
      labelAr: "دليل Business Login for Instagram",
    },
    {
      href: "https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights",
      labelAr: "إحصاءات الحساب",
    },
  ],
  credentialFields: [
    {
      key: "clientId",
      label: "Instagram App ID",
      labelAr: "معرّف تطبيق Instagram",
      helpAr:
        "Instagram App ID من Instagram > API setup with Instagram login > Business login settings. ليس معرّف تطبيق Facebook الظاهر أعلى اللوحة. بعد الحفظ يُعرض آخر أربعة أحرف فقط.",
      secret: false,
      placeholder: "1234567890123456",
    },
    {
      key: "clientSecret",
      label: "Instagram App Secret",
      labelAr: "سر تطبيق Instagram",
      helpAr: "Instagram App Secret من الصفحة نفسها. يُحفظ مشفّراً ولا يُعرض بعد الحفظ. اتركه فارغاً للإبقاء على السر المحفوظ.",
      secret: true,
      placeholder: "••••••••",
    },
    {
      key: "publicBaseUrl",
      label: "HTTPS origin",
      labelAr: "أصل HTTPS العام",
      helpAr:
        "اختياري. ضع الأصل فقط، مثل https://aviationsminuteanalysis.com، بلا مسار. يمكن بدل ذلك ضبط INSTAGRAM_PUBLIC_BASE_URL أو PUBLIC_BASE_URL.",
      secret: false,
      optional: true,
      reveal: true,
      placeholder: "https://aviationsminuteanalysis.com",
    },
  ],
  setupSteps: [
    {
      titleAr: "أضف منتج Instagram",
      bodyAr:
        "من developers.facebook.com/apps افتح التطبيق وأضف منتج Instagram، ثم اختر API setup with Instagram login. هذا المسار لا يحتاج صفحة Facebook.",
    },
    {
      titleAr: "اضبط Business login",
      bodyAr:
        "في Set up Instagram business login > Business login settings الصق عنوان العودة الظاهر أدناه في OAuth redirect URIs. Meta يطابقه حرفياً، وقد يضيف شرطة مائلة في النهاية فراجعها.",
    },
    {
      titleAr: "أضف الحساب التجريبي",
      bodyAr:
        "قبل مراجعة التطبيق لا يربط إلا من له دور في التطبيق. من App roles > Roles أضف حساب Instagram كـ Instagram Tester واقبل الدعوة من إعدادات Instagram > Apps and websites. الحساب يجب أن يكون احترافياً: أعمال أو صانع محتوى.",
    },
    {
      titleAr: "انسخ معرّف Instagram وسرّه",
      bodyAr:
        "انسخ Instagram App ID و Instagram App Secret من Business login settings. معرّف تطبيق Facebook وسرّه لا يعملان هنا ويعيدان «Invalid platform app». رمز الدخول طويل الأمد يدوم ٦٠ يوماً ويُجدَّد تلقائياً عند فتح الصفحة.",
    },
  ],
  scopes: [
    {
      value: "instagram_business_basic",
      descriptionAr: "الاسم واسم المستخدم والصورة وعدد المتابعين والمنشورات وإحصاءات كل منشور العامة.",
    },
    {
      value: "instagram_business_manage_insights",
      descriptionAr: "إحصاءات الحساب والمنشورات: المشاهدات والوصول والحفظ والمشاركات والمتابعون الجدد.",
    },
  ],
  callbackPath: INSTAGRAM_CALLBACK_PATH,
  pagePath: "/instagram",
  redirectPolicy: "instagram",
  redirectHelpAr:
    "الصق هذا العنوان في OAuth redirect URIs داخل Business login settings. يجب أن يطابق ما يرسله التطبيق حرفياً. أي عنوان عام يجب أن يكون https.",
};
