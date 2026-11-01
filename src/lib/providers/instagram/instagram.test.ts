import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { beginOAuth, completeOAuthCallback } from "@/lib/auth/service";
import { readTokens, upsertCredentials } from "@/lib/store";
import { periodRange } from "@/lib/providers/youtube/analytics";
import { appSecretProof, fetchInstagramAccount, fetchMediaPage, InstagramApiError } from "@/lib/providers/instagram/api";
import {
  buildInstagramPeriodSummary,
  classifyInsightError,
  fetchAccountInsights,
  insightWindows,
  parseDailySeries,
  parseFollowBreakdown,
  parseTotalValues,
} from "@/lib/providers/instagram/analytics";
import { instagramMeta, UNIFIED_TOKEN_TYPE } from "@/lib/providers/instagram/config";
import { explainInstagramCode } from "@/lib/providers/instagram/errors";
import {
  cleanAuthorizationCode,
  ensureFreshToken,
  LONG_LIVED_TTL_SEC,
  oauthErrorFrom,
  parseShortLivedToken,
} from "@/lib/providers/instagram/oauth";
import { prepareInstagramCredentials, previewInstagramRedirect, resolveInstagramRedirectUri } from "@/lib/providers/instagram/redirect";
import { hasInsightsScope } from "@/lib/providers/instagram/session";
import { useTempDataDir } from "@/test/temp-data";

const APP_ID = "1234567890123456";
const SECRET = "instagram-app-secret";
const ENV_KEYS = [
  "INSTAGRAM_CLIENT_ID",
  "INSTAGRAM_CLIENT_SECRET",
  "INSTAGRAM_CONFIG_ID",
  "INSTAGRAM_LOGIN_DIALOG",
  "INSTAGRAM_PUBLIC_BASE_URL",
  "PUBLIC_BASE_URL",
];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function saveInstagram(fields: Record<string, string> = {}) {
  const saved = upsertCredentials(
    "instagram",
    { clientId: APP_ID, clientSecret: SECRET, ...fields },
    instagramMeta.credentialFields,
    prepareInstagramCredentials,
  );
  expect(saved.ok).toBe(true);
}

describe("Instagram redirect", () => {
  it("prefers the saved base, then INSTAGRAM_PUBLIC_BASE_URL, then PUBLIC_BASE_URL, then the origin", () => {
    const origin = "http://localhost:5050";
    expect(resolveInstagramRedirectUri({ credentials: {}, origin })).toBe("http://localhost:5050/api/auth/instagram/callback");
    process.env.PUBLIC_BASE_URL = "https://shared.example";
    expect(resolveInstagramRedirectUri({ credentials: {}, origin })).toBe("https://shared.example/api/auth/instagram/callback");
    process.env.INSTAGRAM_PUBLIC_BASE_URL = "https://aviationsminuteanalysis.com";
    expect(resolveInstagramRedirectUri({ credentials: {}, origin })).toBe(
      "https://aviationsminuteanalysis.com/api/auth/instagram/callback",
    );
    expect(resolveInstagramRedirectUri({ credentials: { publicBaseUrl: "https://saved.example" }, origin })).toBe(
      "https://saved.example/api/auth/instagram/callback",
    );
  });

  it("rejects plain http outside localhost", () => {
    expect(previewInstagramRedirect({ origin: "http://10.0.0.5:5050", callbackPath: "/cb" }).error).toBeTruthy();
    expect(previewInstagramRedirect({ origin: "http://127.0.0.1:5050", callbackPath: "/cb" }).error).toBeNull();
  });

  it("validates the app id and public base", () => {
    expect(prepareInstagramCredentials({ clientId: "abc", clientSecret: SECRET }).ok).toBe(false);
    expect(prepareInstagramCredentials({ clientId: APP_ID, clientSecret: SECRET, publicBaseUrl: "http://x.example" }).ok).toBe(false);
    expect(prepareInstagramCredentials({ clientId: APP_ID, clientSecret: SECRET, publicBaseUrl: "https://x.example" }).ok).toBe(true);
  });
});

describe("Instagram OAuth", () => {
  useTempDataDir();

  it("sends the user straight to Instagram login with both scopes", () => {
    saveInstagram();
    process.env.INSTAGRAM_PUBLIC_BASE_URL = "https://aviationsminuteanalysis.com";
    const started = beginOAuth("instagram", "http://localhost:5050", "user-a");
    if (started.type !== "redirect") throw new Error(JSON.stringify(started));
    const url = new URL(started.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(APP_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("https://aviationsminuteanalysis.com/api/auth/instagram/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_manage_insights");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(started.url).not.toContain(SECRET);
  });

  it("exchanges the code, then swaps for a long-lived token and keeps the full user id", async () => {
    saveInstagram();
    const started = beginOAuth("instagram", "http://localhost:5050", "user-a");
    if (started.type !== "redirect") throw new Error("expected redirect");
    const calls: { url: string; body: string }[] = [];
    await completeOAuthCallback({
      platform: "instagram",
      code: "auth-code#_",
      state: new URL(started.url).searchParams.get("state"),
      fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, body: init?.body ? String(init.body) : "" });
        if (url.startsWith("https://api.instagram.com/oauth/access_token")) {
          return jsonResponse(
            '{"data":[{"access_token":"short-token","user_id":17841477653344396,"permissions":"instagram_business_basic,instagram_business_manage_insights"}]}',
          );
        }
        if (url.startsWith("https://graph.instagram.com/access_token")) {
          return jsonResponse({ access_token: "long-token", token_type: "bearer", expires_in: 5_183_944 });
        }
        return jsonResponse({ error: "unexpected" }, 500);
      },
    });
    expect(calls).toHaveLength(2);
    const form = new URLSearchParams(calls[0]!.body);
    expect(form.get("code")).toBe("auth-code");
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("redirect_uri")).toBe("http://localhost:5050/api/auth/instagram/callback");
    const exchange = new URL(calls[1]!.url);
    expect(exchange.searchParams.get("grant_type")).toBe("ig_exchange_token");
    expect(exchange.searchParams.get("access_token")).toBe("short-token");
    const tokens = readTokens("user-a", "instagram");
    expect(tokens?.accessToken).toBe("long-token");
    expect(tokens?.openId).toBe("17841477653344396");
    expect(tokens?.scope).toContain("instagram_business_manage_insights");
  });

  it("refreshes a token older than a day with ig_refresh_token", async () => {
    const now = Date.now();
    const tokens = {
      accessToken: "old",
      refreshToken: null,
      expiresAt: now + (LONG_LIVED_TTL_SEC - 2 * 86_400) * 1000,
      scope: "instagram_business_basic",
      tokenType: "bearer",
    };
    let seen = "";
    const result = await ensureFreshToken({
      credentials: { clientId: APP_ID, clientSecret: SECRET },
      tokens,
      now,
      fetchImpl: async (input: RequestInfo | URL) => {
        seen = String(input);
        return jsonResponse({ access_token: "new", token_type: "bearer", expires_in: 5_184_000 });
      },
    });
    expect(new URL(seen).searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(result.refreshed).toBe(true);
    expect(result.tokens.accessToken).toBe("new");

    const fresh = await ensureFreshToken({
      credentials: {},
      tokens: { ...tokens, expiresAt: now + LONG_LIVED_TTL_SEC * 1000 },
      now,
      fetchImpl: async () => {
        throw new Error("should not refresh");
      },
    });
    expect(fresh.refreshed).toBe(false);
    await expect(ensureFreshToken({ credentials: {}, tokens: { ...tokens, expiresAt: now - 1 }, now })).rejects.toThrow();
  });
});

describe("Instagram parsing", () => {
  it("cleans the code and reads flat or wrapped token payloads", () => {
    expect(cleanAuthorizationCode("abc#_")).toBe("abc");
    expect(parseShortLivedToken('{"access_token":"t","user_id":17841477653344396}')).toMatchObject({
      accessToken: "t",
      userId: "17841477653344396",
    });
    expect(parseShortLivedToken("{}")).toBeNull();
  });

  it("maps token errors", () => {
    expect(oauthErrorFrom(400, '{"error_type":"OAuthException","code":400,"error_message":"Invalid platform app"}').code).toBe(
      "invalid_client",
    );
    expect(oauthErrorFrom(400, '{"error_message":"Error validating verification code. Please make sure your redirect_uri is identical"}').code).toBe(
      "redirect_uri_mismatch",
    );
    expect(oauthErrorFrom(400, '{"error_message":"This authorization code has been used"}').code).toBe("invalid_grant");
    expect(explainInstagramCode("invalid_client").titleAr).toBeTruthy();
  });

  it("reads profile ids from raw text", async () => {
    const account = await fetchInstagramAccount({ accessToken: "token", unified: false }, async () =>
      jsonResponse(
        '{"id":"26000000000000001","user_id":17841477653344396,"username":"mulkallah77","name":"M","account_type":"MEDIA_CREATOR","followers_count":42,"follows_count":3,"media_count":7}',
      ),
    );
    expect(account.userId).toBe("17841477653344396");
    expect(account.username).toBe("mulkallah77");
    expect(account.followersCount).toBe(42);
  });

  it("splits long ranges into windows of at most 29 days", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const windows = insightWindows(periodRange("year", now), now);
    expect(windows.length).toBeGreaterThan(12);
    for (const window of windows) {
      expect(window.until - window.since).toBeLessThanOrEqual(29 * 86_400);
      expect(window.until).toBeGreaterThan(window.since);
    }
    for (let i = 1; i < windows.length; i += 1) expect(windows[i]!.since).toBeGreaterThanOrEqual(windows[i - 1]!.until);
  });

  it("parses totals, daily reach, and follow breakdowns", () => {
    const totals = parseTotalValues(
      [
        { name: "views", period: "day", total_value: { value: 120 } },
        { name: "likes", period: "day", total_value: { value: 9 } },
      ],
      ["views", "likes", "shares"],
    );
    expect(totals.get("views")).toBe(120);
    expect(totals.get("likes")).toBe(9);
    expect(totals.get("shares")).toBe(0);
    const daily = parseDailySeries(
      [{ name: "reach", values: [{ value: 5, end_time: "2026-10-02T07:00:00+0000" }] }],
      "reach",
    );
    expect(daily).toEqual([{ day: "2026-10-01", value: 5 }]);
    const follows = parseFollowBreakdown([
      {
        name: "follows_and_unfollows",
        total_value: {
          value: 7,
          breakdowns: [
            {
              dimension_keys: ["follow_type"],
              results: [
                { dimension_values: ["FOLLOWER"], value: 5 },
                { dimension_values: ["NON_FOLLOWER"], value: 2 },
              ],
            },
          ],
        },
      },
    ]);
    expect(follows).toEqual({ gained: 5, lost: 2 });
  });

  it("classifies insight errors", () => {
    expect(classifyInsightError(new InstagramApiError(400, 10, null, "OAuthException", "Application does not have permission for this action"))).toBe(
      "permission",
    );
    expect(classifyInsightError(new InstagramApiError(400, 4, null, "OAuthException", "Application request limit reached"))).toBe(
      "rate_limited",
    );
  });

  it("falls back per metric and reports unavailable metrics in Arabic", async () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const metric = url.searchParams.get("metric") ?? "";
      if (metric.includes(",") || metric === "saves") {
        return jsonResponse({ error: { message: "(#100) metric[0] must be one of the following values", type: "OAuthException", code: 100 } }, 400);
      }
      if (metric === "follows_and_unfollows") {
        return jsonResponse({ error: { message: "(#100) Not enough followers", type: "OAuthException", code: 100 } }, 400);
      }
      if (url.searchParams.get("metric_type") === "time_series") return jsonResponse({ data: [] });
      return jsonResponse({ data: [{ name: metric, period: "day", total_value: { value: 2 } }] });
    };
    const account = await fetchAccountInsights({
      ctx: { accessToken: "token", unified: false },
      igUserId: "17841477653344396",
      range: periodRange("month", now),
      now,
      fetchImpl,
    });
    expect(account.totals.views).toBeGreaterThan(0);
    expect(account.failed.saves).toBe("unsupported");
    expect(account.follows).toBeNull();
    const summary = buildInstagramPeriodSummary({
      period: "month",
      now,
      account,
      media: { posts: [], incomplete: false, insightsIssue: null },
      currentFollowers: 42,
      snapshots: [],
    });
    expect(summary.totals.views?.source).toBe("account");
    expect(summary.totals.saves).toEqual({ value: 0, source: "posts" });
    expect(summary.followers.gained).toBeNull();
    expect(summary.notices.map((notice) => notice.code)).toEqual(
      expect.arrayContaining(["metric_unavailable", "follows_unavailable"]),
    );
  });
});

const CONFIG_ID = "987654321098765";

describe("Instagram Unified login", () => {
  useTempDataDir();

  it("opens the Facebook Login for Business dialog with config_id instead of scope", () => {
    saveInstagram({ configId: CONFIG_ID });
    process.env.INSTAGRAM_PUBLIC_BASE_URL = "https://aviationsminuteanalysis.com";
    const started = beginOAuth("instagram", "http://localhost:5050", "user-a");
    if (started.type !== "redirect") throw new Error(JSON.stringify(started));
    const url = new URL(started.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.facebook.com/v26.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe(APP_ID);
    expect(url.searchParams.get("config_id")).toBe(CONFIG_ID);
    expect(url.searchParams.get("redirect_uri")).toBe("https://aviationsminuteanalysis.com/api/auth/instagram/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("prompt")).toBe("login");
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(started.url).not.toContain(SECRET);
  });

  it("reads config_id from INSTAGRAM_CONFIG_ID and can use the Instagram dialog", () => {
    saveInstagram();
    process.env.INSTAGRAM_CONFIG_ID = CONFIG_ID;
    process.env.INSTAGRAM_LOGIN_DIALOG = "instagram";
    const started = beginOAuth("instagram", "http://localhost:5050", "user-a");
    if (started.type !== "redirect") throw new Error(JSON.stringify(started));
    const url = new URL(started.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("config_id")).toBe(CONFIG_ID);
  });

  it("exchanges the code at graph.facebook.com and stores the shared Instagram account", async () => {
    saveInstagram({ configId: CONFIG_ID });
    const started = beginOAuth("instagram", "http://localhost:5050", "user-a");
    if (started.type !== "redirect") throw new Error("expected redirect");
    const urls: URL[] = [];
    await completeOAuthCallback({
      platform: "instagram",
      code: "fb-code#_=_",
      state: new URL(started.url).searchParams.get("state"),
      fetchImpl: async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.pathname === "/v26.0/oauth/access_token") return jsonResponse({ access_token: "suat", token_type: "bearer" });
        if (url.pathname === "/v26.0/me/assigned_instagram_accounts") {
          return jsonResponse({ data: [{ id: "17841477653344396", username: "mulkallah77" }] });
        }
        if (url.pathname === "/v26.0/debug_token") {
          return jsonResponse({ data: { scopes: ["instagram_basic", "instagram_manage_insights"] } });
        }
        return jsonResponse({ error: { message: "unexpected" } }, 500);
      },
    });
    const exchange = urls[0]!;
    expect(exchange.origin).toBe("https://graph.facebook.com");
    expect(exchange.searchParams.get("client_id")).toBe(APP_ID);
    expect(exchange.searchParams.get("client_secret")).toBe(SECRET);
    expect(exchange.searchParams.get("code")).toBe("fb-code");
    expect(exchange.searchParams.get("redirect_uri")).toBe("http://localhost:5050/api/auth/instagram/callback");
    expect(urls[1]!.searchParams.get("appsecret_proof")).toBe(appSecretProof("suat", SECRET));
    const tokens = readTokens("user-a", "instagram");
    expect(tokens?.accessToken).toBe("suat");
    expect(tokens?.tokenType).toBe(UNIFIED_TOKEN_TYPE);
    expect(tokens?.openId).toBe("17841477653344396");
    expect(hasInsightsScope(tokens?.scope)).toBe(true);
    expect(tokens!.expiresAt).toBeGreaterThan(Date.now() + 10 * 365 * 86_400_000);
  });

  it("fails clearly when no Instagram account was shared", async () => {
    saveInstagram({ configId: CONFIG_ID });
    const started = beginOAuth("instagram", "http://localhost:5050", "user-a");
    if (started.type !== "redirect") throw new Error("expected redirect");
    const result = await completeOAuthCallback({
      platform: "instagram",
      code: "fb-code",
      state: new URL(started.url).searchParams.get("state"),
      fetchImpl: async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/oauth/access_token")) return jsonResponse({ access_token: "suat" });
        return jsonResponse({ data: [] });
      },
    }).catch((error: unknown) => error);
    expect(JSON.stringify(result)).toContain("no_instagram_account");
    expect(readTokens("user-a", "instagram")).toBeNull();
  });

  it("does not try ig_refresh_token on a system-user token", async () => {
    const tokens = {
      accessToken: "suat",
      refreshToken: null,
      expiresAt: Date.now() + 86_400_000,
      scope: "",
      tokenType: UNIFIED_TOKEN_TYPE,
      openId: "17841477653344396",
    };
    const result = await ensureFreshToken({
      credentials: {},
      tokens,
      fetchImpl: async () => {
        throw new Error("should not refresh");
      },
    });
    expect(result.refreshed).toBe(false);
  });

  it("calls graph.facebook.com with the account id and keeps paging on that host", async () => {
    const ctx = { accessToken: "suat", unified: true, igUserId: "17841477653344396", appSecret: SECRET };
    const seen: URL[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      seen.push(url);
      if (url.pathname.endsWith("/media")) {
        return jsonResponse({
          data: [{ id: "m1", media_type: "IMAGE", timestamp: "2026-10-20T10:00:00+0000", like_count: 3 }],
          paging: { next: "https://graph.facebook.com/v26.0/17841477653344396/media?after=abc&access_token=old" },
        });
      }
      return jsonResponse({ id: "17841477653344396", ig_id: 123, username: "mulkallah77", followers_count: 42 });
    };
    const account = await fetchInstagramAccount(ctx, fetchImpl);
    expect(seen[0]!.pathname).toBe("/v26.0/17841477653344396");
    expect(seen[0]!.searchParams.get("fields")).not.toContain("account_type");
    expect(account.userId).toBe("17841477653344396");
    expect(account.followersCount).toBe(42);
    const page = await fetchMediaPage(ctx, { fetchImpl });
    expect(seen[1]!.pathname).toBe("/v26.0/17841477653344396/media");
    expect(page.media).toHaveLength(1);
    await fetchMediaPage(ctx, { next: page.next, fetchImpl });
    expect(seen[2]!.searchParams.get("access_token")).toBe("suat");
    expect(seen[2]!.searchParams.get("appsecret_proof")).toBe(appSecretProof("suat", SECRET));
    const foreign = await fetchMediaPage(ctx, { next: "https://evil.example/x", fetchImpl });
    expect(foreign.media).toHaveLength(0);
  });

  it("maps the Facebook code error to invalid_grant", () => {
    expect(oauthErrorFrom(400, '{"error":{"message":"Invalid verification code format.","type":"OAuthException","code":100}}').code).toBe(
      "invalid_grant",
    );
    expect(oauthErrorFrom(400, '{"error":{"message":"Error validating client secret.","type":"OAuthException","code":1}}').code).toBe(
      "invalid_client",
    );
  });

  it("validates the configuration id", () => {
    expect(prepareInstagramCredentials({ clientId: APP_ID, clientSecret: SECRET, configId: "abc" }).ok).toBe(false);
    const ok = prepareInstagramCredentials({ clientId: APP_ID, clientSecret: SECRET, configId: ` ${CONFIG_ID} ` });
    expect(ok.ok && ok.fields.configId).toBe(CONFIG_ID);
  });
});
