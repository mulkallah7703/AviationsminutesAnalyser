import { OAuthError } from "@/lib/auth/oauth-error";
import { StorageError } from "@/lib/crypto/seal";
import { InstagramApiError } from "@/lib/providers/instagram/api";
import type { UserFacingError } from "@/lib/providers/types";

const APPS = {
  href: "https://developers.facebook.com/apps",
  labelAr: "فتح تطبيقات Meta",
};

const LOGIN_GUIDE = {
  href: "https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started",
  labelAr: "دليل Instagram API with Unified Login",
};

const PROFESSIONAL = {
  href: "https://help.instagram.com/502981923235522",
  labelAr: "التحويل إلى حساب احترافي",
};

export function explainInstagramCode(code: string, description = "", redirectUri?: string): UserFacingError {
  const detail = description.trim();
  const blob = `${code} ${detail}`.toLowerCase();
  if (code === "access_denied" || blob.includes("user_denied")) {
    return {
      code: "access_denied",
      titleAr: "أُلغي التفويض",
      bodyAr: "لم تكتمل موافقة Instagram. اضغط ربط مرة أخرى ووافق على الصلاحيات المطلوبة.",
    };
  }
  if (blob.includes("invalid platform app") || code === "invalid_client") {
    return {
      code: "invalid_client",
      titleAr: "Meta رفضت التطبيق في مسار Instagram login",
      bodyAr:
        "Meta أعادت «Invalid platform app». التطبيقات الجديدة تعمل بـ Unified login فقط: أضف Configuration ID (config_id) من API setup with Unified login في الإعدادات أو INSTAGRAM_CONFIG_ID، مع معرّف تطبيق Meta وسرّه، وتأكد أن السر يطابق المعرّف. القيمة القادمة من متغير البيئة تتقدّم على المحفوظة.",
      links: [APPS, LOGIN_GUIDE],
    };
  }
  if (code === "redirect_uri_mismatch" || blob.includes("redirect_uri") || blob.includes("redirect uri")) {
    return {
      code: "redirect_uri_mismatch",
      titleAr: "عنوان العودة غير مطابق",
      bodyAr: redirectUri
        ? `الصق هذا العنوان كما هو في Redirect URL داخل API setup with Unified login (أو Valid OAuth Redirect URIs): ${redirectUri}`
        : "عنوان إعادة التوجيه لا يطابق ما سُجّل في تطبيق Meta.",
      links: [APPS],
    };
  }
  if (blob.includes("tester") || blob.includes("insufficient developer role") || blob.includes("not authorized")) {
    return {
      code: "tester_required",
      titleAr: "الحساب ليس ضمن مختبري التطبيق",
      bodyAr:
        "قبل مراجعة Meta لا يربط إلا حساب له دور في التطبيق. من API setup with Unified login > Generate access tokens > Add account ادعُ الحساب كـ Instagram Tester، واقبل الدعوة من Instagram على الويب: Settings > Website permissions > Apps and websites > Tester Invites، ثم أعد الربط.",
      links: [APPS],
    };
  }
  if (blob.includes("professional") || blob.includes("business account") || blob.includes("creator account")) {
    return notProfessional();
  }
  switch (code) {
    case "invalid_grant":
    case "invalid_request":
    case "OAuthException":
      return {
        code,
        titleAr: "رفضت Instagram تبادل الرمز",
        bodyAr: detail ? `أعادت Instagram: ${detail}` : "رمز التفويض غير صالح أو استُخدم من قبل. ابدأ الربط من جديد.",
        links: [LOGIN_GUIDE],
      };
    case "needs_credentials":
      return {
        code,
        titleAr: "Instagram غير مفعّل",
        bodyAr: "المسؤول لم يحفظ معرّف تطبيق Meta وسرّه بعد (ومعه Configuration ID للتطبيقات الجديدة). البطاقة تبقى «غير مفعّل» حتى يُحفظا.",
      };
    case "not_connected":
      return {
        code,
        titleAr: "الحساب غير مربوط",
        bodyAr: "ادخل بحسابك المحلي ثم اضغط ربط للانتقال إلى تسجيل الدخول في Instagram.",
      };
    case "refresh_missing":
    case "refresh_expired":
    case "token_invalid":
      return {
        code,
        titleAr: "انتهت جلسة Instagram",
        bodyAr: "رمز الدخول انتهى أو أُلغي من إعدادات Instagram. اقطع الربط ثم اربطه من جديد.",
      };
    case "token_http":
    case "token_missing":
      return {
        code,
        titleAr: "تعذّر إصدار رمز الدخول",
        bodyAr: detail ? `تعذّر قراءة رد Instagram. ${detail}` : "تعذّر قراءة رد Instagram أثناء تبادل الرمز.",
      };
    case "state_mismatch":
      return {
        code,
        titleAr: "انتهت محاولة الربط",
        bodyAr: "حالة الربط غير مطابقة أو انتهت صلاحيتها. ابدأ الربط من جديد.",
      };
    case "rate_limited":
      return {
        code,
        titleAr: "تجاوز حد الطلبات",
        bodyAr: "Meta حدّت الطلبات مؤقتاً. انتظر قليلاً ثم حدّث الصفحة.",
      };
    case "permission":
      return {
        code,
        titleAr: "صلاحية غير ممنوحة",
        bodyAr:
          "الربط لا يملك صلاحية القراءة المطلوبة. أضف instagram_basic و instagram_manage_insights إلى إعداد config_id (أو instagram_business_basic و instagram_business_manage_insights في الإعداد القديم)، ثم اقطع الربط واربطه من جديد.",
        links: [APPS],
      };
    case "not_professional":
      return notProfessional();
    case "no_instagram_account":
      return {
        code,
        titleAr: "لم يُشارَك حساب Instagram",
        bodyAr:
          "اكتمل الدخول لكن Meta لم تُعد أي حساب Instagram مشارك مع التطبيق. أعد الربط واختر الـ business portfolio وحساب Instagram الاحترافي في نافذة Meta، وتأكد أن إعداد config_id يطلب الأصل Instagram account.",
        links: [APPS],
      };
    default:
      return {
        code: code || "unknown",
        titleAr: "تعذّر الاتصال بـ Instagram",
        bodyAr: detail || "حدث خطأ غير متوقع أثناء الربط أو جلب البيانات.",
        links: [LOGIN_GUIDE],
      };
  }
}

function notProfessional(): UserFacingError {
  return {
    code: "not_professional",
    titleAr: "الحساب ليس احترافياً",
    bodyAr: "Instagram API يعمل مع حسابات الأعمال وصنّاع المحتوى فقط. حوّل الحساب من إعدادات Instagram ثم أعد الربط.",
    links: [PROFESSIONAL],
  };
}

export function explainInstagramError(error: unknown, redirectUri?: string): UserFacingError {
  if (error instanceof OAuthError) return explainInstagramCode(error.code, error.description, redirectUri);
  if (error instanceof InstagramApiError) {
    if (error.tokenInvalid) return explainInstagramCode("token_invalid", error.message, redirectUri);
    if (error.rateLimited) return explainInstagramCode("rate_limited", error.message, redirectUri);
    if (error.permissionMissing) return explainInstagramCode("permission", error.message, redirectUri);
    return explainInstagramCode(error.type || "unknown", error.message, redirectUri);
  }
  if (error instanceof StorageError) {
    if (error.code === "master_key_missing") {
      return {
        code: error.code,
        titleAr: "مفتاح التشفير مفقود",
        bodyAr: "قاعدة البيانات موجودة لكن ملف المفتاح غير موجود. أعد ملف data/master.key أو ابدأ بمجلد بيانات جديد.",
      };
    }
    return {
      code: error.code,
      titleAr: "تعذّر فتح التخزين المحلي",
      bodyAr: "تعذّر فك تشفير البيانات المحفوظة على هذا الجهاز.",
    };
  }
  return explainInstagramCode("unknown");
}
