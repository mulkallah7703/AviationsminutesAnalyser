import type { ProviderMeta } from "@/lib/providers/types";

/**
 * Two Meta setups are supported:
 * - Unified login (newer apps): Facebook Login for Business with a `config_id`, Meta app ID and secret,
 *   API at graph.facebook.com. Used when a configuration ID is set.
 * - Instagram login (older apps): Business Login for Instagram with scopes, Instagram app ID and secret,
 *   API at graph.instagram.com.
 */
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"] as const;

export const INSTAGRAM_SCOPE = INSTAGRAM_SCOPES.join(",");

export const INSTAGRAM_INSIGHTS_SCOPE = "instagram_business_manage_insights";

/** Unified login permissions the configuration must include for this dashboard. */
export const UNIFIED_REQUIRED_SCOPES = ["instagram_basic", "instagram_manage_insights"] as const;

export const UNIFIED_INSIGHTS_SCOPE = "instagram_manage_insights";

/** Stored as TokenSet.tokenType so a token keeps the setup it was issued for. */
export const UNIFIED_TOKEN_TYPE = "unified_suat";

export const INSTAGRAM_CALLBACK_PATH = "/api/auth/instagram/callback";

/** Latest Graph API version listed in the Instagram Platform reference (v26.0, June 2026). */
export const INSTAGRAM_API_VERSION = "v26.0";

export const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

export const FACEBOOK_GRAPH_BASE = `https://graph.facebook.com/${INSTAGRAM_API_VERSION}`;

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
      href: "https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started",
      labelAr: "دليل Instagram API with Unified Login",
    },
    {
      href: "https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights",
      labelAr: "إحصاءات الحساب",
    },
  ],
  credentialFields: [
    {
      key: "clientId",
      label: "Meta App ID",
      labelAr: "معرّف تطبيق Meta",
      helpAr:
        "مع Unified login: معرّف تطبيق Meta من App settings > Basic. مع الإعداد القديم Instagram login: Instagram App ID من Business login settings. بعد الحفظ يُعرض آخر أربعة أحرف فقط.",
      secret: false,
      placeholder: "1234567890123456",
    },
    {
      key: "clientSecret",
      label: "Meta App Secret",
      labelAr: "سر تطبيق Meta",
      helpAr: "سر التطبيق المقابل للمعرّف أعلاه. يُحفظ مشفّراً ولا يُعرض بعد الحفظ. اتركه فارغاً للإبقاء على السر المحفوظ.",
      secret: true,
      placeholder: "••••••••",
    },
    {
      key: "configId",
      label: "Configuration ID (config_id)",
      labelAr: "معرّف الإعداد config_id",
      helpAr:
        "مطلوب للتطبيقات الجديدة (Unified login). من Use cases > Manage messaging & content on Instagram > Customize > API setup with Unified login، أو من Facebook Login for Business > Configurations. ليس سراً. اتركه فارغاً فقط مع إعداد Instagram login القديم.",
      secret: false,
      optional: true,
      reveal: true,
      placeholder: "1234567890123456",
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
      titleAr: "افتح API setup with Unified login",
      bodyAr:
        "من developers.facebook.com/apps افتح التطبيق، ثم Use cases > Manage messaging & content on Instagram > Customize > API setup with Unified login. يجب أن يملك التطبيقَ business portfolio حتى يظهر التبويب.",
    },
    {
      titleAr: "أضف صلاحية الإحصاءات إلى الإعداد",
      bodyAr:
        "في Configure your app افتح معاينة الإعداد واختر Edit permissions، وتأكد من instagram_basic و instagram_manage_insights (بدونها لا مشاهدات ولا وصول ولا متابعين جدد). الأصل Instagram account مطلوب. ثم Use this configuration.",
    },
    {
      titleAr: "عنوان العودة ومعرّف الإعداد",
      bodyAr:
        "تحت Redirect URL الصق عنوان العودة الظاهر أدناه حرفياً واحفظ. انسخ Configuration ID (config_id) وضعه هنا أو في INSTAGRAM_CONFIG_ID.",
    },
    {
      titleAr: "أضف الحساب التجريبي",
      bodyAr:
        "من Generate access tokens > Add account ادعُ حساب Instagram الاحترافي كـ Instagram Tester، واقبل الدعوة من Instagram على الويب: Settings > Website permissions > Apps and websites > Tester Invites.",
    },
    {
      titleAr: "المعرّف والسر",
      bodyAr:
        "مع Unified login استخدم معرّف تطبيق Meta وسرّه من App settings > Basic. الرمز الناتج System-user access token تابع لـ business portfolio، ومدته حسب إعدادك.",
    },
  ],
  scopes: [
    {
      value: "instagram_basic",
      descriptionAr: "Unified login: الاسم واسم المستخدم والصورة والمتابعون والمنشورات.",
    },
    {
      value: "instagram_manage_insights",
      descriptionAr: "Unified login: المشاهدات والوصول والتفاعل والحفظ والمشاركات والمتابعون الجدد.",
    },
    {
      value: "instagram_business_basic",
      descriptionAr: "الإعداد القديم Instagram login: بيانات الحساب والمنشورات.",
    },
    {
      value: "instagram_business_manage_insights",
      descriptionAr: "الإعداد القديم Instagram login: إحصاءات الحساب والمنشورات.",
    },
  ],
  callbackPath: INSTAGRAM_CALLBACK_PATH,
  pagePath: "/instagram",
  redirectPolicy: "instagram",
  redirectHelpAr:
    "الصق هذا العنوان في Redirect URL داخل API setup with Unified login (أو OAuth redirect URIs في الإعداد القديم). يجب أن يطابق حرفياً، وأي عنوان عام يجب أن يكون https.",
};
