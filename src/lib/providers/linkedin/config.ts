import type { ProviderMeta } from "@/lib/providers/types";

/** Open permissions granted by “Sign in with LinkedIn using OpenID Connect”. */
export const LINKEDIN_SCOPES = ["openid", "profile", "email"] as const;

export const LINKEDIN_SCOPE = LINKEDIN_SCOPES.join(" ");

export const LINKEDIN_CALLBACK_PATH = "/api/auth/linkedin/callback";

export const linkedinMeta: ProviderMeta = {
  id: "linkedin",
  name: "LinkedIn",
  summaryAr: "الاسم والصورة والبريد بعد الربط. منشورات الفترة ومقاييسها تحتاج موافقة Community Management.",
  availability: "ready",
  accent: "#0a66c2",
  consoleUrl: "https://www.linkedin.com/developers/apps",
  consoleLinkLabel: "تطبيقات LinkedIn",
  extraLinks: [
    {
      href: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2",
      labelAr: "دليل Sign in with LinkedIn",
    },
    {
      href: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens",
      labelAr: "رموز التحديث",
    },
  ],
  credentialFields: [
    {
      key: "clientId",
      label: "Client ID",
      labelAr: "معرّف العميل",
      helpAr: "Client ID من تبويب Auth في تطبيق LinkedIn. بعد الحفظ يُعرض آخر أربعة أحرف فقط.",
      secret: false,
      placeholder: "xxxxxxxx",
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      labelAr: "سر العميل",
      helpAr: "Primary Client Secret من تبويب Auth. يُحفظ مشفّراً ولا يُعرض بعد الحفظ. اتركه فارغاً للإبقاء على السر المحفوظ.",
      secret: true,
      placeholder: "••••••••",
    },
    {
      key: "publicBaseUrl",
      label: "HTTPS origin",
      labelAr: "أصل HTTPS العام",
      helpAr:
        "اختياري. اتركه فارغاً على http://localhost. إذا وصلت عبر نفق، ضع الأصل فقط، مثل https://your-name.ngrok-free.app، بلا مسار. يمكن بدل ذلك ضبط LINKEDIN_PUBLIC_BASE_URL أو PUBLIC_BASE_URL.",
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
        "من linkedin.com/developers/apps أنشئ تطبيقاً. في تبويب Auth الصق عنوان العودة الظاهر أدناه في Authorized redirect URLs. LinkedIn يطابقه حرفياً، ويقبل https أو http://localhost.",
    },
    {
      titleAr: "فعّل منتج تسجيل الدخول",
      bodyAr:
        "من تبويب Products أضف Sign in with LinkedIn using OpenID Connect. هذا المنتج يمنح الصلاحيات openid و profile و email. طلب صلاحية لم يُمنحها التطبيق يُفشل الربط كله.",
    },
    {
      titleAr: "ما لا يُفعَّل لتطبيق عادي",
      bodyAr:
        "Share on LinkedIn (w_member_social) ينشر ولا يقرأ. قراءة منشورات العضو وتفاعلها وعدد المتابعين تحتاج Community Management API وموافقة LinkedIn، وصلاحيات r_member_social و r_member_postAnalytics و r_member_profileAnalytics. لا تُطلب هنا حتى تُوافق LinkedIn، وإلا يُرفض تسجيل الدخول.",
    },
    {
      titleAr: "انسخ المعرّف والسر",
      bodyAr:
        "انسخ Client ID و Primary Client Secret إلى هذا النموذج واحفظ. المستخدم يضغط ربط LinkedIn وينتقل إلى موافقة LinkedIn. رمز التحديث يُحفظ إذا أعاده LinkedIn، وذلك عندما يكون Programmatic refresh tokens مفعّلاً للتطبيق. وإلا يدوم رمز الدخول نحو ٦٠ يوماً ثم يُعاد الربط.",
    },
  ],
  scopes: [
    { value: "openid", descriptionAr: "تسجيل الدخول عبر OpenID Connect. منتج Sign in with LinkedIn using OpenID Connect." },
    { value: "profile", descriptionAr: "الاسم والصورة من userinfo. العنوان المهني وعدد المتابعين ليسا في هذا الرد." },
    { value: "email", descriptionAr: "البريد الأساسي إن سمح به العضو." },
  ],
  callbackPath: LINKEDIN_CALLBACK_PATH,
  pagePath: "/linkedin",
  redirectPolicy: "linkedin",
  redirectHelpAr:
    "الصق هذا العنوان في Authorized redirect URLs داخل تبويب Auth. يجب أن يطابق ما يرسله ديوان حرفياً. http مسموح فقط لـ localhost و 127.0.0.1. أي عنوان عام يجب أن يكون https.",
};
