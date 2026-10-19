import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const command = process.argv[2] === "start" ? "start" : "dev";
const port = process.env.PORT?.trim() || "5050";

if (!/^\d+$/.test(port)) {
  console.error("PORT must be a number.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [nextBin, command, "--hostname", "0.0.0.0", "--port", port],
  { stdio: "inherit" },
);

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
