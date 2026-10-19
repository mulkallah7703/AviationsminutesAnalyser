import { StorageError } from "@/lib/crypto/seal";
import type { UserFacingError } from "@/lib/providers/types";
import { YouTubeApiError } from "@/lib/providers/youtube/api";
import { YOUTUBE_ANALYTICS_SCOPE, YOUTUBE_SCOPE } from "@/lib/providers/youtube/config";
import { OAuthError } from "@/lib/providers/youtube/oauth";

const API_LINK = {
  href: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  labelAr: "فتح YouTube Data API v3",
};
const ANALYTICS_LINK = {
  href: "https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com",
  labelAr: "تفعيل YouTube Analytics API",
};
const AUDIENCE_LINK = {
  href: "https://console.cloud.google.com/auth/audience",
  labelAr: "فتح Test users",
};
const CLIENTS_LINK = {
  href: "https://console.cloud.google.com/auth/clients",
  labelAr: "فتح عملاء OAuth",
};
const PERMISSIONS_LINK = {
  href: "https://myaccount.google.com/permissions",
  labelAr: "صلاحيات حساب Google",
};

function testingBlocked(description: string): boolean {
  const text = description.toLowerCase();
  return (
    text.includes("verification") ||
    text.includes("being tested") ||
    text.includes("test user") ||
    text.includes("hasn’t been verified") ||
    text.includes("hasn't been verified") ||
    text.includes("not completed the google verification")
  );
}

export function explainYouTubeCode(
  code: string,
  description = "",
  redirectUri?: string,
): UserFacingError {
  const uriNote = redirectUri
    ? ` العنوان الذي يجب تسجيله هو: ${redirectUri}`
    : " انسخ العنوان من نموذج بيانات الاعتماد كما هو.";

  switch (code) {
    case "access_denied":
      if (testingBlocked(description)) {
        return {
          code,
          titleAr: "التطبيق في وضع الاختبار وحسابك غير مضاف",
          bodyAr:
            "Google منعت الدخول لأن التطبيق لم يُعتمد بعد، وحسابك ليس ضمن المستخدمين التجريبيين. افتح شاشة موافقة OAuth، ثم Audience، ثم Test users، وأضف بريد Google الذي تدخل به. بعدها أعد الربط ووافق على الصلاحية.",
          links: [AUDIENCE_LINK],
        };
      }
      return {
        code,
        titleAr: "تم رفض الوصول",
        bodyAr:
          "إما أنك ألغيت الموافقة في صفحة Google، أو أن التطبيق ما زال في وضع Testing ولم يُضف بريدك كمستخدم تجريبي. للحل: أعد الربط واختر السماح، أو افتح Audience ثم Test users وأضف البريد الذي تدخل به ثم أعد المحاولة.",
        links: [AUDIENCE_LINK],
      };
    case "invalid_client":
      return {
        code,
        titleAr: "معرّف العميل أو السر غير مقبول",
        bodyAr:
          "رفضت Google قيمة Client ID أو Client Secret. تأكد أن العميل من نوع Web application، ثم انسخ القيمتين من جديد من صفحة العميل والصقهما في النموذج واحفظ. لا تستخدم معرّف المشروع ولا مفتاح API.",
        links: [CLIENTS_LINK],
      };
    case "redirect_uri_mismatch":
      return {
        code,
        titleAr: "عنوان إعادة التوجيه غير مطابق",
        bodyAr: `العنوان الذي أرسله التطبيق غير موجود في Authorized redirect URIs لهذا العميل. الصقه كما هو في عميل من نوع Web application، واحفظ، ثم أعد الربط.${uriNote}`,
        links: [CLIENTS_LINK],
      };
    case "invalid_grant":
      return {
        code,
        titleAr: "انتهت صلاحية الربط",
        bodyAr:
          "رمز التحديث لم يعد صالحاً. يحدث هذا إذا أزلت صلاحية التطبيق من حساب Google، أو غيّرت سر العميل، أو أُلغي الرمز. اقطع الاتصال ثم اربطه من جديد. إذا استمر الرفض، أزل التطبيق من صلاحيات حساب Google ثم أعد الربط.",
        links: [PERMISSIONS_LINK],
      };
    case "missing_refresh_token":
      return {
        code,
        titleAr: "لم يصل رمز التحديث",
        bodyAr:
          "وافقت Google على الدخول لكنها لم تُرجع رمز تحديث، لذلك لا يمكن تجديد الجلسة تلقائياً. أزل صلاحية التطبيق من حساب Google ثم أعد الربط. التطبيق يطلب الوصول دون اتصال (offline) مع prompt=consent في كل مرة.",
        links: [PERMISSIONS_LINK],
      };
    case "invalid_scope":
      return {
        code,
        titleAr: "الصلاحية غير مسموحة في شاشة الموافقة",
        bodyAr: `أضف النطاقين ${YOUTUBE_SCOPE} و ${YOUTUBE_ANALYTICS_SCOPE} ضمن Data Access في شاشة موافقة OAuth، ثم أعد الربط ووافق على الصلاحيتين.`,
        links: [
          {
            href: "https://console.cloud.google.com/auth/scopes",
            labelAr: "صلاحيات شاشة الموافقة",
          },
        ],
      };
    case "admin_policy_enforced":
    case "org_internal":
      return {
        code,
        titleAr: "سياسة الحساب تمنع الربط",
        bodyAr:
          "حساب Google هذا، وغالباً ما يكون حساب عمل أو مدرسة، يمنع التطبيقات الخارجية. جرّب حساباً شخصياً، أو اطلب من مشرف النطاق السماح للتطبيق.",
      };
    case "state_mismatch":
      return {
        code,
        titleAr: "جلسة الربط غير صالحة",
        bodyAr:
          "انتهت مهلة الربط أو أُعيد استخدام رابط العودة. ابدأ من زر ربط في اللوحة من جديد، ولا تفتح صفحة العودة يدوياً.",
      };
    case "needs_credentials":
      return {
        code,
        titleAr: "YouTube غير مفعّل",
        bodyAr: "المسؤول لم يحفظ بيانات تطبيق Google بعد. الربط يبقى مغلقاً حتى يفعّله من إعدادات المسؤول.",
      };
    case "not_connected":
      return {
        code,
        titleAr: "الحساب غير مربوط",
        bodyAr: "اربط YouTube لعرض إحصاءات القناة وآخر المقاطع.",
      };
    case "analyticsNotConfigured":
      return {
        code,
        titleAr: "YouTube Analytics API غير مفعّلة",
        bodyAr:
          "مشروع Google Cloud لا يستخدم YouTube Analytics API. من مكتبة الواجهات افتح YouTube Analytics API واضغط Enable، في نفس المشروع الذي فعّلت فيه YouTube Data API v3. ثم أعد تحميل الصفحة.",
        links: [ANALYTICS_LINK],
      };
    case "accessNotConfigured":
    case "SERVICE_DISABLED":
      return {
        code: "accessNotConfigured",
        titleAr: "YouTube Data API v3 غير مفعّلة",
        bodyAr:
          "مشروع Google Cloud لا يستخدم الواجهة بعد. افتح مكتبة الواجهات، اختر YouTube Data API v3، واضغط Enable. بعد التفعيل أعد تحميل هذه الصفحة.",
        links: [API_LINK],
      };
    case "quotaExceeded":
    case "dailyLimitExceeded":
    case "rateLimitExceeded":
      return {
        code,
        titleAr: "استُهلكت حصة الواجهة",
        bodyAr:
          "تجاوز المشروع حد طلبات YouTube Data API. انتظر حتى تتجدد الحصة، أو اطلب زيادتها من Google Cloud، ثم حدّث الصفحة.",
      };
    case "insufficientPermissions":
    case "forbidden":
      return {
        code,
        titleAr: "الصلاحيات لا تكفي لقراءة القناة",
        bodyAr:
          "الرمز المحفوظ لا يتضمن صلاحية القراءة. اقطع الاتصال، ثم اربطه من جديد ووافق على صلاحية youtube.readonly.",
      };
    case "noChannel":
      return {
        code,
        titleAr: "لا توجد قناة على هذا الحساب",
        bodyAr:
          "حساب Google الذي وافقت به لا يملك قناة YouTube. أنشئ قناة من إعدادات YouTube، أو ادخل بحساب يملك قناة، ثم أعد الربط.",
      };
    case "network":
      return {
        code,
        titleAr: "تعذّر الاتصال بـ Google",
        bodyAr: "تحقق من اتصال الجهاز بالإنترنت ثم أعد المحاولة.",
      };
    case "server_error":
    case "temporarily_unavailable":
      return {
        code,
        titleAr: "Google غير متاحة مؤقتاً",
        bodyAr: "تعذّر إكمال الطلب من طرف Google. انتظر قليلاً ثم أعد الربط أو حدّث الصفحة.",
      };
    case "master_key_missing":
    case "master_key_invalid":
    case "decrypt_failed":
      return {
        code,
        titleAr: "تعذّر قراءة البيانات المحفوظة",
        bodyAr:
          "مفتاح التشفير المحلي مفقود أو لا يطابق قاعدة البيانات. إذا حُذف الملف data/master.key فلا يمكن فك تشفير الأسرار. أعد ملف المفتاح، أو احذف مجلد data ثم أدخل بيانات الاعتماد من جديد.",
      };
    default:
      return {
        code: code || "unknown",
        titleAr: "تعذّر إكمال الطلب",
        bodyAr:
          "حدث خطأ غير متوقع أثناء التواصل مع Google أو YouTube. أعد المحاولة. إذا استمر، افتح نموذج بيانات الاعتماد وتأكد من Client ID و Client Secret وعنوان إعادة التوجيه.",
      };
  }
}

export function explainYouTubeError(error: unknown, redirectUri?: string): UserFacingError {
  if (error instanceof OAuthError) {
    return explainYouTubeCode(error.code, error.description, redirectUri);
  }
  if (error instanceof YouTubeApiError) {
    const message = `${error.reason} ${error.description}`;
    if (/youtube analytics api/i.test(message)) {
      return explainYouTubeCode("analyticsNotConfigured", error.description, redirectUri);
    }
    if (
      /youtube data api v3 has not been used/i.test(message) ||
      /is disabled/i.test(message) ||
      error.reason === "accessNotConfigured" ||
      error.reason === "SERVICE_DISABLED"
    ) {
      return explainYouTubeCode("accessNotConfigured", error.description, redirectUri);
    }
    if (error.status === 401 || error.reason === "authError") {
      return explainYouTubeCode("invalid_grant", error.description, redirectUri);
    }
    if (error.reason) {
      const known = explainYouTubeCode(error.reason, error.description, redirectUri);
      if (known.code !== "unknown" && known.titleAr !== "تعذّر إكمال الطلب") return known;
    }
    if (error.status === 403) {
      return explainYouTubeCode("forbidden", error.description, redirectUri);
    }
    return {
      code: error.reason || `http_${error.status}`,
      titleAr: "تعذّرت قراءة بيانات YouTube",
      bodyAr:
        "رفضت الواجهة الطلب. تحقق من تفعيل YouTube Data API v3 ومن أن الحساب مربوط بصلاحية القراءة، ثم حدّث الصفحة.",
      links: [API_LINK],
    };
  }
  if (error instanceof StorageError) {
    return explainYouTubeCode(error.code, "", redirectUri);
  }
  return explainYouTubeCode("unknown", "", redirectUri);
}
