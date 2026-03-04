// MUST be set before any path-resolving imports so resolveStateDir()
// and resolveConfigPath() pick them up at module-load time.
process.env.OPENCLAW_STATE_DIR = "/app/system";
process.env.OPENCLAW_CONFIG_PATH = "/app/config/openclaw.json";

import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { runEmbeddedPiAgent } from "./agents/pi-embedded-runner.js";
import { resolveSessionTranscriptPath } from "./config/sessions/paths.js";

const PORT = 50051;
const AGENT_ID = "main";
const WORKSPACE_DIR = "/app/office";
// ~24 days: effectively "no timeout" (same sentinel used by resolveAgentTimeoutMs).
const NO_TIMEOUT_MS = 2_147_000_000;

interface ExecutePayload {
  sender_id: string;
  intent: string;
  message: string;
  office_pointers: string[];
}

// Persist one session UUID per sender for the lifetime of the process so
// conversation history accumulates across requests.
const sessionIds = new Map<string, string>();

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post("/execute", async (req: Request, res: Response) => {
  const body = req.body as Partial<ExecutePayload>;

  if (
    typeof body.sender_id !== "string" ||
    typeof body.intent !== "string" ||
    typeof body.message !== "string" ||
    !Array.isArray(body.office_pointers)
  ) {
    res.status(400).json({
      error: "Invalid payload: sender_id, intent, message, office_pointers required",
    });
    return;
  }

  // One persistent session thread per sender.
  const sessionKey = `engine-${body.sender_id}`;

  // Reuse session ID across requests so conversation history persists.
  let sessionId = sessionIds.get(sessionKey);
  if (!sessionId) {
    sessionId = randomUUID();
    sessionIds.set(sessionKey, sessionId);
  }

  const sessionFile = resolveSessionTranscriptPath(sessionId, AGENT_ID);

  // Prepend intent label when provided so the agent knows the request type.
  const prompt = body.intent ? `[${body.intent}]\n${body.message}` : body.message;

  try {
    const result = await runEmbeddedPiAgent({
      sessionId,
      sessionKey,
      agentId: AGENT_ID,
      sessionFile,
      workspaceDir: WORKSPACE_DIR,
      timeoutMs: NO_TIMEOUT_MS,
      runId: sessionId,
      prompt,
      toolResultFormat: "markdown",
    });

    const text =
      result.payloads
        ?.filter((p) => p.text)
        .map((p) => p.text)
        .join("\n") ?? null;
    const ok = !result.meta.error && !result.meta.aborted;
    res.json({
      ok,
      message: text,
      usage: result.meta.agentMeta?.usage ?? null,
      errors: result.meta.error ? [result.meta.error.message] : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[agent-engine] Listening on port ${PORT}`);
  console.log(`[agent-engine]   Config    : ${process.env.OPENCLAW_CONFIG_PATH}`);
  console.log(`[agent-engine]   State dir : ${process.env.OPENCLAW_STATE_DIR}`);
});
