# Corpus sources

Every text in the grounding corpus must be listed here with its provenance and
public-domain status. `npm run corpus:fetch` downloads these into `corpus/raw/`
(git-ignored); `npm run corpus:ingest` builds `data/corpus.db`.

| Work | Translator | Published | Project Gutenberg ebooks | Status |
|---|---|---|---|---|
| Mahābhārata (complete, prose) | Kisari Mohan Ganguli | 1883–1896 | [15474](https://www.gutenberg.org/ebooks/15474), [15475](https://www.gutenberg.org/ebooks/15475), [15476](https://www.gutenberg.org/ebooks/15476), [15477](https://www.gutenberg.org/ebooks/15477) | Public domain (translator d. 1908) |
| Vālmīki Rāmāyaṇa (complete, literal prose) | Manmatha Nath Dutt | 1891–1894 | [57265](https://www.gutenberg.org/ebooks/57265), [57826](https://www.gutenberg.org/ebooks/57826), [60188](https://www.gutenberg.org/ebooks/60188), [62496](https://www.gutenberg.org/ebooks/62496) | Public domain (published before 1929) |

The four Gutenberg volumes together cover all 18 books of Ganguli's translation
(Volume 3, #15476, holds Books 8–12). Several books (Karna to Stri, and the last
three) head their sections with a bare number on its own line instead of
"SECTION I"; the parser handles both forms.

Raw files are saved as `corpus/raw/<work>-<ebook id>.txt`. If Gutenberg is
unreachable, download the "Plain Text UTF-8" files by hand and save them under
those names.

## Deliberately excluded for v1

- Vishnu Purāṇa (H. H. Wilson, 1840) and R. T. H. Griffith's verse Rāmāyaṇa.
- Kannada-language texts (Kumāravyāsa's *Karṇāṭa Bhārata Kathāmañjari* on
  kn.wikisource, Alasingrachar's 1912 prose translations). Deferred to a later phase.
- Datasets with unclear licensing (e.g. scraped verse-by-verse translations).
