# Kathā — Indian epics, told from the source

A web app that narrates stories from the Mahābhārata and Rāmāyaṇa in Kannada
(and English), grounded in public-domain translations. Each narration cites
the passages it draws on, and you can read the original English passage
beside the retelling.

## How it works

1. **Corpus.** K. M. Ganguli's Mahābhārata (1883–96) and M. N. Dutt's
   Rāmāyaṇa (1891–94) are downloaded from Project Gutenberg. They are split
   into ~450-word passages keyed by book and section, and indexed in SQLite
   with FTS5 (`data/corpus.db`). See [`corpus/SOURCES.md`](corpus/SOURCES.md).
2. **Retrieval.** Catalog stories (`data/stories.json`) pin an exact section
   range. For free-form questions, a helper model turns the question
   (Kannada or English) into English keywords, which are then searched in
   the index.
3. **Narration.** The passages go to Claude as citable documents. The system
   prompt allows only material found in those passages. Claude streams the
   story in the chosen language, with citations that become footnotes.
4. **Faithfulness check (optional).** A second model lists any sentence that
   the passages don't support, and the reader highlights it.
5. **Audio.** The narration is split into sentences and spoken through
   Sarvam AI (Bulbul) or Google Cloud TTS, with results cached on disk. If
   neither is configured, the browser's own speech synthesis is used.

## Setup

```bash
npm install
cp .env.example .env.local        # add ANTHROPIC_API_KEY, and SARVAM_API_KEY for Kannada audio
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
| `ANTHROPIC_API_KEY` | Required. Used for narration. |
| `CLAUDE_MODEL` | Narration model (default `claude-opus-5`). |
| `CLAUDE_HELPER_MODEL` | Model for query rewriting and the faithfulness check (default `claude-sonnet-5`). |
| `SARVAM_API_KEY` / `SARVAM_TTS_SPEAKER` | Sarvam AI Bulbul TTS (recommended for Kannada). |
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
