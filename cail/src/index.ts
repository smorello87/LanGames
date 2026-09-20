import { WorkerEntrypoint } from "cloudflare:workers";
import app from "./app";
import type { Env } from "./env";
import { readinessResult, type LanGamesReadinessResult } from "./readiness";

export type { LanGamesReadinessResult } from "./readiness";

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
};

/** Doorway's release probe, over a service binding. */
export class LanGamesReadiness extends WorkerEntrypoint<Env> {
  async getReadiness(): Promise<LanGamesReadinessResult> {
    return readinessResult(this.env);
  }
}
