import { OAuthError } from "@/lib/auth/oauth-error";
import { StorageError } from "@/lib/crypto/seal";
import { LinkedInApiError } from "@/lib/providers/linkedin/api";
import type { UserFacingError } from "@/lib/providers/types";

const APPS = {
  href: "https://www.linkedin.com/developers/apps",
  labelAr: "فتح تطبيقات LinkedIn",
};

const SIGN_IN = {
  href: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2",
  labelAr: "دليل Sign in with LinkedIn",
};

const COMMUNITY = {
  href: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview",
  labelAr: "Community Management API",
};

export function explainLinkedInCode(code: string, description = "", redirectUri?: string): UserFacingError {
  const detail = description.trim();
  const blob = `${code} ${detail}`.toLowerCase();
  if (code === "access_denied") {
    return {
      code,
      titleAr: "أُلغي التفويض",
      bodyAr: "لم تكتمل موافقة LinkedIn. اضغط ربط مرة أخرى ووافق على الصلاحيات المطلوبة.",
    };
  }
  if (isProductGap(blob)) return productError();
  if (blob.includes("redirect_uri") || blob.includes("redirect uri") || code === "redirect_uri_mismatch") {
    return {
      code: "redirect_uri_mismatch",
      titleAr: "عنوان العودة غير مطابق",
      bodyAr: redirectUri
        ? `الصق هذا العنوان كما هو في Authorized redirect URLs داخل تبويب Auth: ${redirectUri}`
        : "عنوان إعادة التوجيه لا يطابق ما سُجّل في تطبيق LinkedIn.",
      links: [APPS],
    };
  }
  if (isExpired(blob) || code === "401" || code === "http_401") {
    return expiredError();
  }
  switch (code) {
    case "invalid_client":
    case "unauthorized_client":
      return {
        code,
        titleAr: "معرّف العميل أو سرّه مرفوض",
        bodyAr: "راجع Client ID و Client Secret في إعدادات المسؤول. القيمة القادمة من متغير البيئة تتقدّم على المحفوظة.",
        links: [APPS],
      };
    case "invalid_grant":
    case "invalid_request":
      return {
        code,
        titleAr: "رفض LinkedIn تبادل الرمز",
        bodyAr: detail
          ? `أعاد LinkedIn: ${detail}`
          : "رمز التفويض غير صالح أو انتهت صلاحيته، أو أن عنوان العودة لا يطابق المسجّل.",
        links: [APPS],
      };
    case "needs_credentials":
      return {
        code,
        titleAr: "LinkedIn غير مفعّل",
        bodyAr: "المسؤول لم يحفظ Client ID و Client Secret بعد. البطاقة تبقى «غير مفعّل» حتى يُحفظا.",
      };
    case "not_connected":
      return {
        code,
        titleAr: "الحساب غير مربوط",
        bodyAr: "ادخل بحسابك المحلي ثم اضغط ربط للانتقال إلى موافقة LinkedIn.",
      };
    case "refresh_missing":
    case "refresh_expired":
      return expiredError();
    case "state_mismatch":
      return {
        code,
        titleAr: "انتهت محاولة الربط",
        bodyAr: "حالة الربط غير مطابقة أو انتهت صلاحيتها. ابدأ الربط من جديد.",
      };
    default:
      return {
        code: code || "unknown",
        titleAr: "تعذّر الاتصال بـ LinkedIn",
        bodyAr: detail || "حدث خطأ غير متوقع أثناء الربط أو جلب الملف.",
        links: [APPS],
      };
  }
}

export function explainLinkedInError(error: unknown, redirectUri?: string): UserFacingError {
  if (error instanceof OAuthError) return explainLinkedInCode(error.code, error.description, redirectUri);
  if (error instanceof LinkedInApiError) {
    const blob = `${error.status} ${error.code} ${error.detail}`.toLowerCase();
    if (isProductGap(blob) || (error.status === 403 && isProductGap(blob))) return productError();
    if (error.status === 403 && (blob.includes("access_denied") || blob.includes("permission"))) return productError();
    if (error.status === 401 || isExpired(blob)) return expiredError();
    return explainLinkedInCode(error.code || String(error.status), error.detail, redirectUri);
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
  return explainLinkedInCode("unknown");
}

function productError(): UserFacingError {
  return {
    code: "product_not_enabled",
    titleAr: "منتج LinkedIn غير مفعّل",
    bodyAr:
      "التطبيق لا يملك المنتج الذي يطلبه هذا الاستدعاء. فعّل Sign in with LinkedIn using OpenID Connect، وتأكد أن الصلاحيات openid و profile و email مُنحت للتطبيق، ثم أعد الربط. قراءة المنشورات والتفاعل وعدد المتابعين ومخطط الفترة تحتاج Community Management API بعد موافقة LinkedIn، والصلاحيات r_member_social و r_member_postAnalytics و r_member_profileAnalytics. طلبها قبل الموافقة يُفشل تسجيل الدخول كله.",
    links: [APPS, SIGN_IN, COMMUNITY],
  };
}

function expiredError(): UserFacingError {
  return {
    code: "token_expired",
    titleAr: "انتهت صلاحية الدخول",
    bodyAr:
      "رمز الدخول انتهى. LinkedIn يمنح رمز تحديث فقط إذا كان Programmatic refresh tokens مفعّلاً للتطبيق، ويدوم رمز الدخول نحو ٦٠ يوماً. اقطع الربط ثم اربطه من جديد.",
    links: [
      {
        href: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens",
        labelAr: "شرح رموز التحديث",
      },
    ],
  };
}

function isProductGap(blob: string): boolean {
  return (
    blob.includes("unauthorized_scope") ||
    blob.includes("invalid_scope") ||
    blob.includes("not enough permissions") ||
    blob.includes("not authorized for your application") ||
    (blob.includes("scope") && blob.includes("not authorized")) ||
    blob.includes("partner program") ||
    blob.includes("community management")
  );
}

function isExpired(blob: string): boolean {
  return (
    blob.includes("invalid_token") ||
    blob.includes("expired") ||
    blob.includes("revoked_access_token") ||
    blob.includes("invalid access token")
  );
}
