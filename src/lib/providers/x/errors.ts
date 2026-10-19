import { OAuthError } from "@/lib/auth/oauth-error";
import { StorageError } from "@/lib/crypto/seal";
import type { UserFacingError } from "@/lib/providers/types";
import { XApiError } from "@/lib/providers/x/api";

const PORTAL = {
  href: "https://developer.x.com/en/portal/dashboard",
  labelAr: "فتح بوابة مطوّري X",
};

const PRODUCTS = {
  href: "https://developer.x.com/en/portal/products",
  labelAr: "باقات X API",
};

const BILLING = {
  href: "https://console.x.com",
  labelAr: "فتح فوترة مطوّري X",
};

export function explainXCode(code: string, description = "", redirectUri?: string): UserFacingError {
  const detail = description.trim();
  const blob = `${code} ${detail}`.toLowerCase();
  if (isUsageCap(blob) || code === "402" || code === "http_402") {
    return creditsError();
  }
  if (isAccessTier(blob)) {
    return tierError();
  }
  if (blob.includes("rate limit") || code === "429" || code === "http_429") {
    return {
      code: "rate_limited",
      titleAr: "تجاوز حد الطلبات",
      bodyAr: detail
        ? `X حدّت الطلبات مؤقتاً (429). ${detail}`
        : "X حدّت الطلبات مؤقتاً (429). انتظر قليلاً ثم حدّث الصفحة.",
    };
  }
  if (blob.includes("redirect_uri") || blob.includes("redirect uri") || code === "redirect_uri_mismatch") {
    return {
      code: "redirect_uri_mismatch",
      titleAr: "عنوان العودة غير مطابق",
      bodyAr: redirectUri
        ? `الصق هذا العنوان كما هو في Callback URI: ${redirectUri}`
        : "عنوان إعادة التوجيه لا يطابق ما سُجّل في تطبيق X.",
      links: [PORTAL],
    };
  }
  switch (code) {
    case "access_denied":
      return {
        code,
        titleAr: "أُلغي التفويض",
        bodyAr: "لم تكتمل موافقة X. اضغط ربط مرة أخرى ووافق على الصلاحيات المطلوبة.",
      };
    case "invalid_client":
    case "unauthorized_client":
      return {
        code,
        titleAr: "معرّف العميل أو سرّه مرفوض",
        bodyAr: "راجع Client ID و Client Secret في إعدادات المسؤول. القيمة القادمة من متغير البيئة تتقدّم على المحفوظة.",
        links: [PORTAL],
      };
    case "invalid_grant":
    case "invalid_request":
      return {
        code,
        titleAr: "رفضت X تبادل الرمز",
        bodyAr: detail
          ? `أعادت X: ${detail}`
          : "رمز التفويض غير صالح أو انتهت صلاحيته، أو أن عنوان العودة لا يطابق المسجّل.",
        links: [PORTAL],
      };
    case "needs_credentials":
      return {
        code,
        titleAr: "X غير مفعّل",
        bodyAr: "المسؤول لم يحفظ Client ID و Client Secret بعد. البطاقة تبقى «غير مفعّل» حتى يُحفظا.",
      };
    case "not_connected":
      return {
        code,
        titleAr: "الحساب غير مربوط",
        bodyAr: "ادخل بحسابك المحلي ثم اضغط ربط للانتقال إلى موافقة X.",
      };
    case "refresh_missing":
      return {
        code,
        titleAr: "انتهت الجلسة",
        bodyAr: "لا يوجد رمز تحديث. اقطع الربط ثم اربطه من جديد ووافق على offline.access.",
      };
    case "pkce_unavailable":
      return {
        code,
        titleAr: "تعذّر إكمال PKCE",
        bodyAr: "X يطلب PKCE في كل عملية ربط. أعد المحاولة من زر الربط.",
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
        titleAr: "تعذّر الاتصال بـ X",
        bodyAr: detail || "حدث خطأ غير متوقع أثناء الربط أو جلب البيانات.",
        links: [PORTAL],
      };
  }
}

export function explainXError(error: unknown, redirectUri?: string): UserFacingError {
  if (error instanceof OAuthError) return explainXCode(error.code, error.description, redirectUri);
  if (error instanceof XApiError) {
    const blob = `${error.status} ${error.code} ${error.detail}`.toLowerCase();
    if (error.status === 402 || isUsageCap(blob)) return creditsError();
    if (error.status === 403 || isAccessTier(blob)) return tierError();
    if (error.status === 429) {
      const when = error.resetAt ? ` يمكن المحاولة بعد ${new Date(error.resetAt).toISOString()}.` : "";
      return explainXCode("429", `${error.detail}${when}`.trim(), redirectUri);
    }
    return explainXCode(error.code || String(error.status), error.detail, redirectUri);
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
  return explainXCode("unknown");
}

function tierError(): UserFacingError {
  return {
    code: "access_tier",
    titleAr: "قراءة المنشورات تحتاج باقة أعلى",
    bodyAr:
      "الطبقة المجانية من X API لا تقرأ خطّ الزمن ولا مقاييس المنشورات مثل الظهور. يلزم اشتراك Basic أو أعلى، وتطبيق ضمن مشروع مفعّل بمصادقة المستخدم وصلاحية القراءة، ثم إعادة الربط.",
    links: [PRODUCTS, PORTAL],
  };
}

function creditsError(): UserFacingError {
  return {
    code: "usage_cap",
    titleAr: "نفد رصيد واجهة X",
    bodyAr:
      "حساب المطوّر على X لم يعد فيه رصيد لاستدعاءات الواجهة. اشحن الرصيد أو اشترك من صفحة الفوترة في وحدة تحكم مطوّري X، ثم حدّث الصفحة.",
    links: [BILLING],
  };
}

function isUsageCap(blob: string): boolean {
  return (
    blob.includes("usage-capped") ||
    blob.includes("usage cap") ||
    blob.includes("creditsdepleted") ||
    blob.includes("credits depleted") ||
    blob.includes("credit depleted") ||
    blob.includes("does not have any credits") ||
    blob.includes("no credits") ||
    blob.includes("out of credits") ||
    blob.includes("payment required") ||
    blob.includes("billing")
  );
}

function isAccessTier(blob: string): boolean {
  return (
    blob.includes("client-not-enrolled") ||
    blob.includes("not enrolled") ||
    blob.includes("appropriate level") ||
    blob.includes("client forbidden")
  );
}
