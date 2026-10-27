import { defineConfig } from "@playwright/test";
import voteEditConfig from "./vote-edit.config";

// Reuse the isolated, credential-free server and the desktop/320px/390px viewports.
export default defineConfig({ ...voteEditConfig, testMatch: "idea-author.spec.ts", outputDir: "../work/idea-author-results" });
