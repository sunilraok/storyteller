# Generate saved narrations

These are instructions for Claude Code, run locally in this repository. They
produce the pre-written narrations the site serves, so visitors never trigger
paid model calls. Start Claude Code in the repo and say:

> Follow scripts/generate-narrations.md for all stories.

To generate only some stories, name them: "…for ekalavya and hanumans-leap."
Re-running is safe; skip any narration that already exists and passes
`npm run story:check` unless asked to regenerate it.

## 0. Prepare the sources

`data/corpus.db` must exist (`npm run corpus:ingest`). Then run:

```bash
npm run story:export
```

This writes `data/narrations/<story>/sources.json` for every story in
`data/stories.json`: the pinned source passages, each with an `id` such as
`mahabharata:adi:17:1`, a `label` and the English `text`. These passages are
the only source of truth for everything below.

## 1. For each story, language and audience, write the narration

For every story × language (`kn`, `en`) × audience (`child`, `adult`), read the
story's `sources.json` in full, then write
`data/narrations/<story>/<lang>-<audience>.md`.

### Faithfulness comes before everything else

- Narrate only events, names, places, dialogue and details that appear in the
  passages. Do not add episodes, motives or details from later retellings,
  television serials, folk versions or your own knowledge, even if you believe
  them to be true.
- You may compress, reorder for clarity and paraphrase, but never invent. When
  simplifying for children, simplify the language, not the facts.
- Where the translation reports a speech, you may render it as dialogue,
  keeping its meaning.
- Cite: after each sentence or short group of sentences, add the id of the
  passage that supports it as `[[passage-id]]`, e.g. `…ಕಡೆದರು. [[mahabharata:adi:17:1]]`.
  Use only ids from that story's `sources.json`. Several markers in a row are
  fine when a sentence draws on several passages. Every paragraph should carry
  at least one citation.

### Language and voice

- Write entirely in the target language and script. For Kannada (`kn`), use
  natural modern Kannada prose (ಹೊಸಗನ್ನಡ) in Kannada script, with Sanskrit
  proper names in their standard Kannada forms (ಯುಧಿಷ್ಠಿರ, ದ್ರೌಪದಿ,
  ಹನುಮಂತ, ಸೀತೆ). Avoid English words in Kannada narrations. For English
  (`en`), use the plain spellings the translations use (Yudhishthira, Draupadi).
- Tell it as a warm oral storyteller would, suitable for reading aloud: flowing
  paragraphs separated by blank lines. No title, headings, bullet lists, bold,
  or any other markdown. Begin directly with the story.
- `child`: short sentences, gentle tone, violence described without gore,
  about 400–600 words.
- `adult`: a fuller retelling of about 700–1200 words that keeps the texture of
  the original.

## 2. Review each narration against the sources

After writing a narration, review it as a strict, independent checker would:
go sentence by sentence and compare it with the passages it cites and the rest
of `sources.json`. A sentence is unsupported if it states a fact, event, name
or detail the passages do not contain. Stylistic framing ("Long ago…") and
faithful paraphrase are fine.

- If you find unsupported sentences, fix the narration (remove or correct them)
  and review again.
- When the narration is clean, write
  `data/narrations/<story>/<lang>-<audience>.check.json`:

  ```json
  { "status": "checked", "issues": [], "checkedAt": "<ISO date>" }
  ```

  If something could not be fixed, list it instead, quoting the sentence
  exactly as it appears in the narration (without citation markers):
  `{ "sentence": "…", "reason": "short English reason" }`.

## 3. Validate

```bash
npm run story:check -- --stamp --allow-missing
```

`--stamp` records which version of each narration a review applies to; a later
edit to the narration then marks the review as stale. Fix every error the
checker reports (unknown citation ids, wrong script, markdown, stale or
mismatched review) and re-run until there are no errors. Length warnings are
worth a look but are not errors.

## 4. Finish

When all narrations pass, run `npm run story:check` (no flags) to confirm none
are missing, then summarise what was generated and any warnings. Do not commit
unless asked. Audio is generated separately with `npm run story:audio`, which
uses a TTS provider key.
