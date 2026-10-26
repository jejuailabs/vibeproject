import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

// This serves the real client in preview mode. It has no backend or credentials.
const root = process.cwd();
const result = await build({
  stdin: {
    contents: `import { StrictMode } from "react";
      import { createRoot } from "react-dom/client";
      import { WorkspaceApp } from "./src/components/workspace-app";
      createRoot(document.getElementById("root")).render(<StrictMode><WorkspaceApp preview /></StrictMode>);`,
    resolveDir: root,
    sourcefile: "project-management-entry.tsx",
    loader: "tsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: {
    "@/lib/preview": path.join(root, "e2e/fixtures/project-management-preview.ts"),
    "@": path.join(root, "src"),
  },
  define: { "process.env": "{}", "process.env.NODE_ENV": '"development"' },
  outfile: path.join(root, "work/project-management-harness/fixture.js"),
});
const script = result.outputFiles.find((file) => file.path.endsWith(".js")).text;
const styles = (await Promise.all([
  "globals.css", "arena.css", "workshop.css", "court.css", "journey.css", "lobby.css", "steps.css", "project-flow.css", "mobile.css",
].map((file) => readFile(path.join(root, "src/app", file), "utf8")))).join("\n")
  .replace(/@import url\([^;]+;/g, "");
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>';
const server = createServer((request, response) => {
  const route = request.url?.split("?")[0];
  const resource = route === "/" ? ["text/html; charset=utf-8", html]
    : route === "/fixture.js" ? ["text/javascript; charset=utf-8", script]
    : route === "/fixture.css" ? ["text/css; charset=utf-8", styles] : null;
  if (!resource) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": resource[0] });
  response.end(resource[1]);
});
server.listen(3108, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
