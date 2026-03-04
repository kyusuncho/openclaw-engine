import { defineConfig } from "tsdown";

// Minimal build config for the Dockerized agent-engine microservice.
// Used by Dockerfile.agent-engine in place of the full pnpm build pipeline.
export default defineConfig({
  entry: "src/agent-server.ts",
  platform: "node",
  fixedExtension: false,
});
