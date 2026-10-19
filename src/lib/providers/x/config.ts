import type { ProviderMeta } from "@/lib/providers/types";

export const X_SCOPES = ["tweet.read", "users.read", "offline.access"] as const;

export const X_SCOPE = X_SCOPES.join(" ");

export const X_CALLBACK_PATH = "/api/auth/x/callback";

export const xMeta: ProviderMeta = {
  id: "x",
  name: "X (Twitter)",
  summaryAr: "الاسم و@المعرّف والمتابعون، وملخص منشورات الفترة: الظهور والإعجاب والرد والمشاركة.",
  availability: "ready",
  accent: "#0f1419",
  consoleUrl: "https://developer.x.com/en/portal/dashboard",
  consoleLinkLabel: "بوابة مطوّري X",
  extraLinks: [
    {
      href: "https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code",
      labelAr: "دليل OAuth 2.0",
    },
    {
      href: "https://developer.x.com/en/portal/products",
      labelAr: "باقات X API",
    },
  ],
  credentialFields: [
    {
      key: "clientId",
      label: "Client ID",
      labelAr: "معرّف العميل",
      helpAr: "OAuth 2.0 Client ID من إعدادات User authentication. بعد الحفظ يُعرض آخر أربعة أحرف فقط.",
      secret: false,
      placeholder: "xxxxxxxx",
    },
    {
      key: "clientSecret",
      label: "Client Secret",
      labelAr: "سر العميل",
      helpAr: "Client Secret للتطبيق السري (confidential client). يُحفظ مشفّراً ولا يُعرض بعد الحفظ. اتركه فارغاً للإبقاء على السر المحفوظ.",
      secret: true,
      placeholder: "••••••••",
    },
    {
      key: "publicBaseUrl",
      label: "HTTPS origin",
      labelAr: "أصل HTTPS العام",
      helpAr:
        "اختياري. اتركه فارغاً على http://localhost. إذا وصلت عبر نفق، ضع الأصل فقط، مثل https://your-name.ngrok-free.app، بلا مسار. يمكن بدل ذلك ضبط X_PUBLIC_BASE_URL أو PUBLIC_BASE_URL.",
      secret: false,
      optional: true,
      reveal: true,
      placeholder: "https://your-name.ngrok-free.app",
    },
  ],
  setupSteps: [
    {
      titleAr: "أنشئ مشروعاً وتطبيقاً",
      bodyAr:
        "من developer.x.com أنشئ مشروعاً ثم تطبيقاً داخله. الطبقة المجانية لا تقرأ خطّ الزمن ولا مقاييس المنشورات. لقراءة منشوراتك والظهور يلزم اشتراك Basic أو أعلى.",
    },
    {
      titleAr: "فعّل مصادقة المستخدم",
      bodyAr:
        "في User authentication settings اختر OAuth 2.0، ونوع التطبيق Web App (Confidential client)، وصلاحية Read. الصلاحيات: tweet.read و users.read و offline.access.",
    },
    {
      titleAr: "الصق عنوان العودة وموقع الويب",
      bodyAr:
        "Callback URI يجب أن يطابق العنوان الظاهر أدناه حرفياً. X يقبل https أو localhost فقط. Website URL هو الأصل نفسه، مثل https://your-name.ngrok-free.app بلا مسار.",
    },
    {
      titleAr: "انسخ المعرّف والسر",
      bodyAr:
        "انسخ Client ID و Client Secret إلى هذا النموذج واحفظ. المستخدم يضغط ربط X وينتقل مباشرة إلى صفحة موافقة X. متغير X_REDIRECT_URI، إن وُجد، يثبت عنوان العودة كما هو.",
    },
  ],
  scopes: [
    { value: "tweet.read", descriptionAr: "قراءة منشورات الحساب. بلا نشر." },
    { value: "users.read", descriptionAr: "الاسم و@المعرّف والصورة وعدد المتابعين والمتابَعين والمنشورات." },
    { value: "offline.access", descriptionAr: "رمز تحديث لإبقاء الربط دون إعادة الموافقة في كل زيارة." },
  ],
  callbackPath: X_CALLBACK_PATH,
  pagePath: "/x",
  redirectPolicy: "x",
  redirectHelpAr:
    "الصق هذا العنوان في Callback URI داخل User authentication settings. يجب أن يطابق ما يرسله ديوان حرفياً. http مسموح فقط لـ localhost و 127.0.0.1. أي عنوان عام يجب أن يكون https.",
};
