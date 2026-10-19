import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { resetSealForTests } from "@/lib/crypto/seal";
import { resetDbForTests } from "@/lib/db";

export function useTempDataDir(): void {
  let dir = "";
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "diwan-"));
    process.env.DATA_DIR = dir;
    resetDbForTests();
    resetSealForTests();
  });
  afterEach(() => {
    resetDbForTests();
    resetSealForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });
}
