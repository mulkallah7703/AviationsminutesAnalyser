import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { beginOAuth, completeOAuthCallback } from "@/lib/auth/service";
import { codeChallenge, createCodeVerifier } from "@/lib/providers/tiktok/oauth";
import { fetchTikTokAccount } from "@/lib/providers/tiktok/api";
import { explainTikTokCode } from "@/lib/providers/tiktok/errors";
import { prepareTikTokCredentials, previewTikTokRedirect } from "@/lib/providers/tiktok/redirect";
import { readTokens, saveTokens, upsertCredentials } from "@/lib/store";
import { tiktokMeta } from "@/lib/providers/tiktok/config";
import { useTempDataDir } from "@/test/temp-data";

const KEY = "aw-test-client-key";
const SECRET = "tiktok-client-secret";

function saveTikTok(fields: Record<string, string> = {}) {
  const saved = upsertCredentials(
    "tiktok",
    { clientKey: KEY, clientSecret: SECRET, ...fields },
    tiktokMeta.credentialFields,
    prepareTikTokCredentials,
  );
  expect(saved.ok).toBe(true);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TikTok redirect and PKCE", () => {
  it("accepts localhost and https, and rejects other http origins", () => {
    expect(previewTikTokRedirect({ origin: "http://localhost:4317", callbackPath: "/api/auth/tiktok/callback" })).toMatchObject({
      uri: "http://localhost:4317/api/auth/tiktok/callback",
      error: null,
    });
    expect(previewTikTokRedirect({ origin: "http://127.0.0.1:4317", callbackPath: "/cb" }).error).toBeNull();
    expect(previewTikTokRedirect({ origin: "http://192.168.1.8:4317", callbackPath: "/cb" }).error).toBeTruthy();
    expect(
      previewTikTokRedirect({
        origin: "http://localhost:4317",
        publicBaseUrl: "https://diwan.example",
        callbackPath: "/api/auth/tiktok/callback",
      }).uri,
    ).toBe("https://diwan.example/api/auth/tiktok/callback");
  });

  it("uses a hex SHA-256 challenge", () => {
    const verifier = createCodeVerifier();
    const challenge = codeChallenge(verifier);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("hex"));
    expect(challenge).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a public base URL that is not an https origin", () => {
    expect(prepareTikTokCredentials({ clientKey: KEY, clientSecret: SECRET, publicBaseUrl: "http://example.com" }).ok).toBe(
      false,
    );
    expect(
      prepareTikTokCredentials({ clientKey: KEY, clientSecret: SECRET, publicBaseUrl: "https://app.example/extra" }).ok,
    ).toBe(false);
  });
});

describe("TikTok OAuth", () => {
  useTempDataDir();

  afterEach(() => {
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;
    delete process.env.TIKTOK_PUBLIC_BASE_URL;
  });

  it("sends the user to TikTok with PKCE and without the secret", () => {
    saveTikTok();
    const started = beginOAuth("tiktok", "http://127.0.0.1:4317", "user-a");
    expect(started.type).toBe("redirect");
    if (started.type !== "redirect") return;
    const url = new URL(started.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe(KEY);
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:4317/api/auth/tiktok/callback");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,user.info.profile,user.info.stats,video.list");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("client_secret")).toBeNull();
    expect(started.url).not.toContain(SECRET);
  });

  it("uses the https origin when the admin saved one", () => {
    saveTikTok({ publicBaseUrl: "https://tunnel.example" });
    const started = beginOAuth("tiktok", "http://localhost:4317", "user-a");
    if (started.type !== "redirect") throw new Error(JSON.stringify(started));
    expect(new URL(started.url).searchParams.get("redirect_uri")).toBe(
      "https://tunnel.example/api/auth/tiktok/callback",
    );
  });

  it("keeps tokens for each local user", async () => {
    saveTikTok();
    const started = beginOAuth("tiktok", "http://localhost:4317", "user-a");
    if (started.type !== "redirect") throw new Error("expected redirect");
    await completeOAuthCallback({
      platform: "tiktok",
      code: "auth-code",
      state: new URL(started.url).searchParams.get("state"),
      fetchImpl: async () =>
        jsonResponse({
          access_token: "access-a",
          refresh_token: "refresh-a",
          expires_in: 3600,
          open_id: "open-a",
          scope: "user.info.basic",
          token_type: "Bearer",
        }),
    });
    saveTokens("user-b", "tiktok", {
      accessToken: "access-b",
      refreshToken: "refresh-b",
      expiresAt: Date.now() + 3600_000,
      scope: "user.info.basic",
      tokenType: "Bearer",
    });
    expect(readTokens("user-a", "tiktok")?.accessToken).toBe("access-a");
    expect(readTokens("user-b", "tiktok")?.accessToken).toBe("access-b");
  });

  it("lets environment variables override saved secrets without revealing them", () => {
    saveTikTok();
    process.env.TIKTOK_CLIENT_SECRET = "env-only-secret-value";
    const started = beginOAuth("tiktok", "http://localhost:4317", "user-a");
    expect(started.type).toBe("redirect");
    const status = upsertCredentials("tiktok", { clientKey: KEY }, tiktokMeta.credentialFields, prepareTikTokCredentials);
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(JSON.stringify(status.status)).not.toContain("env-only-secret-value");
    expect(status.status.fields.find((field) => field.key === "clientSecret")?.source).toBe("env");
  });
});

describe("TikTok account payload", () => {
  it("reads profile counts and videos", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/user/info/")) {
        return jsonResponse({
          data: {
            user: {
              open_id: "open-1",
              display_name: "لينا",
              username: "lina",
              avatar_url: "https://example.com/a.jpg",
              follower_count: 10,
              following_count: 2,
              likes_count: 30,
              video_count: 4,
            },
          },
          error: { code: "ok", message: "" },
        });
      }
      return jsonResponse({
        data: {
          videos: [
            {
              id: "v1",
              title: "مقطع",
              video_description: "وصف",
              view_count: 5,
              like_count: 1,
              comment_count: 0,
              share_count: 2,
              create_time: 1_700_000_000,
            },
          ],
        },
        error: { code: "ok", message: "" },
      });
    };
    const account = await fetchTikTokAccount("token", fetchImpl);
    expect(account.displayName).toBe("لينا");
    expect(account.followerCount).toBe(10);
    expect(account.videos[0]?.shareCount).toBe(2);
    expect(account.videos[0]?.createTime).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("explains a sandbox rejection in Arabic", () => {
    const error = explainTikTokCode("access_denied", "target user is not in sandbox");
    expect(error.titleAr).toContain("التجريبيين");
  });
});
