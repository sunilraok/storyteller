# Kathā — Indian epics, told from the source

A web app that narrates stories from the Mahābhārata and Rāmāyaṇa in Kannada
(and English), grounded in public-domain translations. Each narration cites
the passages it draws on, and you can read the original English passage
beside the retelling.

## Two modes

- **Saved mode (default).** Narrations are written ahead of time with Claude
  Code on your own machine and committed as files under `data/narrations/`.
  The site serves them as they are: no model calls, no API keys, no sign-in.
  Audio can be pre-generated too. This is the cheapest way to run the site.
- **Live mode (`LIVE_NARRATION=1`).** Stories are narrated on demand through
  the Claude API. The site also offers free-form questions, a live
  faithfulness check and server-side TTS. It needs an Anthropic API key,
  Google sign-in and a usage-limit store (see Configuration).

## How it works

1. **Corpus.** K. M. Ganguli's Mahābhārata (1883–96) and M. N. Dutt's
   Rāmāyaṇa (1891–94) are downloaded from Project Gutenberg. They are split
   into ~450-word passages keyed by book and section, and indexed in SQLite
   with FTS5 (`data/corpus.db`). See [`corpus/SOURCES.md`](corpus/SOURCES.md).
2. **Retrieval.** Catalog stories (`data/stories.json`) pin an exact section
   range. In live mode, a helper model turns a free-form question (Kannada or
   English) into English keywords, which are then searched in the index.
3. **Narration.** The passages are the only allowed source. In saved mode,
   Claude Code writes each narration following `scripts/generate-narrations.md`
   and cites passages inline as `[[passage-id]]`. In live mode, the passages
   go to the Claude API as citable documents. Either way, citations become
   footnotes that open the original English passage.
4. **Faithfulness check.** Each narration is reviewed sentence by sentence
   against the passages. Saved narrations store the review next to the text,
   and a review is discarded if the narration changes after it. In live mode
   a second model runs the check on request.
5. **Access and limits (live mode).** Narrating, checking and listening call
   paid APIs, so they require Google sign-in. Each user has daily quotas and
   concurrency limits, and there is a global daily budget on top; the
   counters live in Upstash Redis. In saved mode these endpoints are switched
   off.
6. **Audio.** Saved narrations play pre-generated files
   (`npm run story:audio`), falling back to the browser's own voice. In live
   mode the narration is spoken through Sarvam AI (Bulbul) or Google Cloud
   TTS, with a size-capped disk cache.

## Generate the saved narrations

With the corpus built (see Setup), start Claude Code in this repository and say:

> Follow scripts/generate-narrations.md for all stories.

It exports each story's passages (`npm run story:export`), then writes
`data/narrations/<story>/<lang>-<audience>.md` for Kannada and English, child
and adult. It reviews each narration against the passages, records the review,
and validates everything with `npm run story:check`. Look over the results and
commit `data/narrations/`.

For audio, set `SARVAM_API_KEY` (or `GOOGLE_TTS_API_KEY`) in `.env.local`, run
`npm run story:audio`, and commit `public/audio/`. Audio is regenerated only
for narrations that changed.

## Setup

```bash
npm install
cp .env.example .env.local        # saved mode needs no keys; see Configuration for live mode
npm run corpus:fetch              # download the source texts into corpus/raw/
npm run corpus:ingest             # build data/corpus.db and check story pins
npm run dev                       # http://localhost:3000
```

`corpus:ingest` prints how many sections it indexed for each book. It also
checks that every story's pinned range contains the names that story expects.
The ingest fails, exits non-zero, and leaves any existing `data/corpus.db` in
place if any of these happen:

- a volume is missing;
- a book yields no sections;
- a work parses far fewer sections than the translation contains;
- a story pin shows ✗.

To fix a failed pin, correct that story's section range in `data/stories.json`.

If Project Gutenberg is unreachable, download the plain-text files listed in
`corpus/SOURCES.md` by hand and save them as `corpus/raw/<work>-<id>.txt`.

## Configuration

| Variable | Purpose |
|---|---|
| `LIVE_NARRATION=1` | Enables live mode. Everything in this table except the TTS keys applies only to live mode. |
| `ANTHROPIC_API_KEY` | Required in live mode. Used for narration. |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Required in live mode. Google sign-in via Auth.js; the OAuth redirect URI is `<origin>/api/auth/callback/google`. |
| `AUTH_TRUST_HOST=true` or `AUTH_URL` | Needed when self-hosting outside Vercel so Auth.js accepts the request host. |
| `AUTH_ALLOWED_EMAILS` | Restricts sign-in to listed addresses or `@domains`. |
| `AUTH_DEV_BYPASS=1` | Skips sign-in in local development (ignored in production builds). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required in production. Shared store for usage limits; without it the paid endpoints return 503 unless `ALLOW_IN_MEMORY_LIMITS=1` is set (single instance only). |
| `LIMIT_*` | Per-user daily quotas, global daily budgets and concurrency limits (see `.env.example`). |
| `TTS_CACHE_MAX_MB` | Size cap for the TTS audio cache (default 200). |
| `CLAUDE_MODEL` | Narration model (default `claude-opus-5`). |
| `CLAUDE_HELPER_MODEL` | Model for query rewriting and the faithfulness check (default `claude-sonnet-5`). |
| `SARVAM_API_KEY` / `SARVAM_TTS_SPEAKER` | Sarvam AI Bulbul TTS (recommended for Kannada), used by `npm run story:audio` and in live mode. |
| `GOOGLE_TTS_API_KEY` | Google Cloud TTS, used as a fallback. |
| `TTS_PROVIDER` | Forces `sarvam` or `google`. |
| `CORPUS_DB_PATH` | Alternative location for the corpus index. |

## Adding things

- **A story:** add an entry to `data/stories.json` with its Kannada and
  English title, summary and pinned range, then re-run `npm run corpus:ingest`.
- **A language:** add `lib/i18n/<code>.json` with the same keys as
  `en.json` and register it in `lib/i18n/index.ts`.
- **A source text:** register it in `lib/corpus/sources.ts` and record its
  provenance in `corpus/SOURCES.md`.

## Development

```bash
npm test            # Vitest: parser, index, prompt assembly, streaming, TTS helpers
npm run typecheck
npm run lint
```
