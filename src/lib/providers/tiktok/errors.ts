import { OAuthError } from "@/lib/auth/oauth-error";
import { StorageError } from "@/lib/crypto/seal";
import type { UserFacingError } from "@/lib/providers/types";
import { TikTokApiError } from "@/lib/providers/tiktok/api";

const DOCS = {
  href: "https://developers.tiktok.com/apps",
  labelAr: "فتح TikTok for Developers",
};

export function explainTikTokCode(code: string, description = "", redirectUri?: string): UserFacingError {
  const detail = description.trim();
  const lower = `${code} ${detail}`.toLowerCase();
  if (lower.includes("redirect_uri") || lower.includes("redirect uri")) {
    return {
      code: "redirect_uri_mismatch",
      titleAr: "عنوان العودة غير مطابق",
      bodyAr: redirectUri
        ? `الصق هذا العنوان كما هو في Login Kit: ${redirectUri}`
        : "عنوان إعادة التوجيه المرسل لا يطابق ما سُجّل في تطبيق TikTok.",
      links: [DOCS],
    };
  }
  if (lower.includes("sandbox") || lower.includes("target user") || lower.includes("test user")) {
    return {
      code: "sandbox_user",
      titleAr: "الحساب ليس ضمن المستخدمين التجريبيين",
      bodyAr:
        "تطبيق Sandbox لا يعيد بيانات إلا لحساب أُضيف في Target users وقبل الدعوة. أضف الحساب من لوحة TikTok ثم أعد الربط.",
      links: [DOCS],
    };
  }
  switch (code) {
    case "access_denied":
      return {
        code,
        titleAr: "أُلغي التفويض",
        bodyAr: "لم تكتمل موافقة TikTok. اضغط ربط مرة أخرى ووافق على الصلاحيات المطلوبة.",
      };
    case "invalid_client":
    case "invalid_client_key":
      return {
        code,
        titleAr: "مفتاح العميل أو سرّه مرفوض",
        bodyAr: "راجع Client Key و Client Secret في إعدادات المسؤول. القيمة القادمة من متغير البيئة تتقدّم على المحفوظة.",
        links: [DOCS],
      };
    case "invalid_grant":
    case "invalid_request":
      return {
        code,
        titleAr: "رفضت TikTok تبادل الرمز",
        bodyAr: detail
          ? `أعادت TikTok: ${detail}`
          : "رمز التفويض غير صالح أو انتهت صلاحيته، أو أن عنوان العودة لا يطابق المسجّل.",
        links: [DOCS],
      };
    case "scope_not_authorized":
    case "scope_permission_missed":
      return {
        code,
        titleAr: "صلاحية غير مفعّلة",
        bodyAr:
          "فعّل Login Kit والصلاحيات user.info.basic و user.info.profile و user.info.stats و video.list، ثم اقطع الربط وأعده.",
        links: [DOCS],
      };
    case "rate_limit_exceeded":
      return {
        code,
        titleAr: "تجاوز حد الطلبات",
        bodyAr: "TikTok حدّت الطلبات مؤقتاً. انتظر قليلاً ثم حدّث الصفحة.",
      };
    case "needs_credentials":
      return {
        code,
        titleAr: "TikTok غير مفعّل",
        bodyAr: "المسؤول لم يحفظ Client Key و Client Secret بعد. البطاقة تبقى «غير مفعّل» حتى يُحفظا.",
      };
    case "not_connected":
      return {
        code,
        titleAr: "الحساب غير مربوط",
        bodyAr: "ادخل بحسابك المحلي ثم اضغط ربط للانتقال إلى موافقة TikTok.",
      };
    case "refresh_missing":
      return {
        code,
        titleAr: "انتهت الجلسة",
        bodyAr: "لا يوجد رمز تحديث. اقطع الربط ثم اربطه من جديد.",
      };
    case "token_http":
    case "token_missing":
      return {
        code,
        titleAr: "تعذّر إصدار رمز الدخول",
        bodyAr: detail ? `تعذّر قراءة رد TikTok. ${detail}` : "تعذّر قراءة رد TikTok أثناء تبادل الرمز.",
      };
    case "state_mismatch":
      return {
        code,
        titleAr: "انتهت محاولة الربط",
        bodyAr: "حالة الربط غير مطابقة أو انتهت صلاحيتها. ابدأ الربط من جديد.",
      };
    default:
      return {
        code: code || "unknown",
        titleAr: "تعذّر الاتصال بـ TikTok",
        bodyAr: detail || "حدث خطأ غير متوقع أثناء الربط أو جلب البيانات.",
        links: [DOCS],
      };
  }
}

export function explainTikTokError(error: unknown, redirectUri?: string): UserFacingError {
  if (error instanceof OAuthError) return explainTikTokCode(error.code, error.description, redirectUri);
  if (error instanceof TikTokApiError) return explainTikTokCode(error.code || String(error.status), error.message, redirectUri);
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
  return explainTikTokCode("unknown");
}
