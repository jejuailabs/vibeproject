import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

// Bundle the real client components locally. This server has no API handlers,
// authentication, database clients, deployment, or Next CLI startup dependency.
const root = process.cwd();
const result = await build({
  stdin: {
    contents: `import { StrictMode } from "react";
      import { createRoot } from "react-dom/client";
      import VoteLatencyFixture from "./e2e/fixtures/vote-latency";
      createRoot(document.getElementById("root")).render(<StrictMode><VoteLatencyFixture /></StrictMode>);`,
    resolveDir: root,
    sourcefile: "vote-latency-entry.tsx",
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: { "@": path.join(root, "src") },
  define: { "process.env.NODE_ENV": '"development"' },
  outfile: path.join(root, "work", "vote-latency-harness", "fixture.js"),
});
const script = result.outputFiles.find((file) => file.path.endsWith(".js")).text;
const styles = (await Promise.all(["globals.css", "steps.css", "project-flow.css"]
  .map((file) => readFile(path.join(root, "src", "app", file), "utf8")))).join("\n");
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server = createServer((request, response) => {
  const route = request.url?.split("?")[0];
  const resource = route === "/" ? ["text/html; charset=utf-8", html]
    : route === "/fixture.js" ? ["text/javascript; charset=utf-8", script]
    : route === "/fixture.css" ? ["text/css; charset=utf-8", styles] : null;
  if (!resource) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": resource[0] });
  response.end(resource[1]);
});
server.listen(3107, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
