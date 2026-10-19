import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { open, seal } from "@/lib/crypto/seal";
import { getDataDir } from "@/lib/paths";
import { describeCredentials, upsertCredentials } from "@/lib/store";
import { youtubeMeta } from "@/lib/providers/youtube/config";
import { useTempDataDir } from "@/test/temp-data";

describe("encryption at rest", () => {
  useTempDataDir();

  it("round-trips plaintext and rejects tampered payloads", () => {
    const payload = seal("client-secret-value");
    expect(payload).not.toContain("client-secret-value");
    expect(open(payload)).toBe("client-secret-value");
    expect(() => open(`${payload}x`)).toThrow(/decrypt_failed/);
  });

  it("stores credentials as ciphertext and never returns the secret", () => {
    const secret = "GOCSPX-super-secret-value";
    const saved = upsertCredentials(
      "youtube",
      {
        clientId: "123456.apps.googleusercontent.com",
        clientSecret: secret,
      },
      youtubeMeta.credentialFields,
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const secretField = saved.status.fields.find((field) => field.key === "clientSecret");
    const idField = saved.status.fields.find((field) => field.key === "clientId");
    expect(secretField).toMatchObject({ set: true, secret: true, hint: null });
    expect(idField?.hint).toBe("••••.com");
    expect(JSON.stringify(saved.status)).not.toContain(secret);

    const status = describeCredentials("youtube", youtubeMeta.credentialFields);
    expect(JSON.stringify(status)).not.toContain(secret);

    const dir = getDataDir();
    const stored = Buffer.concat(
      ["app.db", "app.db-wal", "app.db-shm"].map((name) => {
        const file = path.join(dir, name);
        return fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
      }),
    );
    expect(stored.includes(secret)).toBe(false);
  });
});
