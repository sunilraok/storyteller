/**
 * The site serves pre-generated narrations by default. Set LIVE_NARRATION=1 (with
 * an Anthropic API key, Google sign-in and a usage-limit store) to also enable
 * on-demand narration, questions, live faithfulness checks and server TTS.
 */
export function liveMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.LIVE_NARRATION === "1";
}

export const LIVE_DISABLED = { error: "liveDisabled" } as const;
