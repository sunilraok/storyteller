/**
 * Registry of public-domain source texts that make up the grounding corpus.
 * Every file listed here must also be recorded in corpus/SOURCES.md.
 */

export type WorkId = "mahabharata" | "ramayana";

export interface BookDef {
  /** Stable slug used in passage ids and story pins, e.g. "adi". */
  slug: string;
  /** Display name with diacritics, e.g. "Ādi Parva". */
  name: string;
  /** Kannada display name. */
  nameKn: string;
  /** Regex matched against a normalized heading line (see normalizeHeading). */
  heading: RegExp;
}

export interface SourceDef {
  work: WorkId;
  title: string;
  titleKn: string;
  translator: string;
  years: string;
  /** Project Gutenberg ebook numbers, in reading order. */
  gutenbergIds: number[];
  /** Label for a chapter unit in this work ("Section" for Ganguli, "Sarga" for Dutt). */
  chapterLabel: string;
  chapterLabelKn: string;
  /**
   * Sanity floor for a full ingest (~90% of the chapters in the translation).
   * Fewer parsed sections means a truncated download or a parser mismatch.
   */
  minSections: number;
  books: BookDef[];
}

const parva = (slug: string, name: string, nameKn: string, pattern: string): BookDef => ({
  slug,
  name,
  nameKn,
  heading: new RegExp(`^(?:BOOK \\d+ )?(?:THE )?${pattern} PARVA$`),
});

const kanda = (slug: string, name: string, nameKn: string, pattern: string): BookDef => ({
  slug,
  name,
  nameKn,
  heading: new RegExp(`^(?:BOOK [IVX\\d]+ )?${pattern} ?KAND(?:A|AM)$`),
});

export const SOURCES: Record<WorkId, SourceDef> = {
  mahabharata: {
    work: "mahabharata",
    title: "The Mahabharata of Krishna-Dwaipayana Vyasa",
    titleKn: "ಮಹಾಭಾರತ",
    translator: "Kisari Mohan Ganguli",
    years: "1883–1896",
    gutenbergIds: [15474, 15475, 15476, 15477],
    chapterLabel: "Section",
    chapterLabelKn: "ಅಧ್ಯಾಯ",
    minSections: 1900, // Ganguli has ~2,100 sections
    books: [
      parva("adi", "Ādi Parva", "ಆದಿ ಪರ್ವ", "ADI"),
      parva("sabha", "Sabhā Parva", "ಸಭಾ ಪರ್ವ", "SABHA"),
      parva("vana", "Vana Parva", "ವನ ಪರ್ವ", "(?:VANA|ARANYAKA)"),
      parva("virata", "Virāṭa Parva", "ವಿರಾಟ ಪರ್ವ", "VIRATA"),
      parva("udyoga", "Udyoga Parva", "ಉದ್ಯೋಗ ಪರ್ವ", "UDYOGA"),
      parva("bhishma", "Bhīṣma Parva", "ಭೀಷ್ಮ ಪರ್ವ", "BHISHMA"),
      parva("drona", "Droṇa Parva", "ದ್ರೋಣ ಪರ್ವ", "DRONA"),
      parva("karna", "Karṇa Parva", "ಕರ್ಣ ಪರ್ವ", "KARNA"),
      parva("shalya", "Śalya Parva", "ಶಲ್ಯ ಪರ್ವ", "(?:SALYA|SHALYA)"),
      parva("sauptika", "Sauptika Parva", "ಸೌಪ್ತಿಕ ಪರ್ವ", "SAUPTIKA"),
      parva("stri", "Strī Parva", "ಸ್ತ್ರೀ ಪರ್ವ", "STRI"),
      parva("shanti", "Śānti Parva", "ಶಾಂತಿ ಪರ್ವ", "(?:SANTI|SHANTI)"),
      parva("anushasana", "Anuśāsana Parva", "ಅನುಶಾಸನ ಪರ್ವ", "(?:ANUSASANA|ANUSHASANA)"),
      parva("ashvamedhika", "Āśvamedhika Parva", "ಅಶ್ವಮೇಧಿಕ ಪರ್ವ", "(?:ASWAMEDHA|ASWAMEDHIKA|ASHVAMEDHIKA)"),
      parva("ashramavasika", "Āśramavāsika Parva", "ಆಶ್ರಮವಾಸಿಕ ಪರ್ವ", "(?:ASRAMAVASIKA|ASHRAMAVASIKA)"),
      parva("mausala", "Mausala Parva", "ಮೌಸಲ ಪರ್ವ", "MAUSALA"),
      parva("mahaprasthanika", "Mahāprasthānika Parva", "ಮಹಾಪ್ರಸ್ಥಾನಿಕ ಪರ್ವ", "MAHAPRASTHANIKA"),
      parva("svargarohana", "Svargārohaṇa Parva", "ಸ್ವರ್ಗಾರೋಹಣ ಪರ್ವ", "(?:SVARGAROHANIKA|SWARGAROHANIKA|SVARGAROHANA)"),
    ],
  },
  ramayana: {
    work: "ramayana",
    title: "The Rāmāyana of Vālmīki",
    titleKn: "ರಾಮಾಯಣ",
    translator: "Manmatha Nath Dutt",
    years: "1891–1894",
    gutenbergIds: [57265, 57826, 60188, 62496],
    chapterLabel: "Sarga",
    chapterLabelKn: "ಸರ್ಗ",
    minSections: 580, // Dutt has ~645 sargas
    books: [
      kanda("bala", "Bāla Kāṇḍa", "ಬಾಲ ಕಾಂಡ", "BALA"),
      kanda("ayodhya", "Ayodhyā Kāṇḍa", "ಅಯೋಧ್ಯಾ ಕಾಂಡ", "AYODHYA"),
      kanda("aranya", "Araṇya Kāṇḍa", "ಅರಣ್ಯ ಕಾಂಡ", "ARANYA"),
      kanda("kishkindha", "Kiṣkindhā Kāṇḍa", "ಕಿಷ್ಕಿಂಧಾ ಕಾಂಡ", "KISH?KINDH?A"),
      kanda("sundara", "Sundara Kāṇḍa", "ಸುಂದರ ಕಾಂಡ", "SUNDARA"),
      kanda("yuddha", "Yuddha Kāṇḍa", "ಯುದ್ಧ ಕಾಂಡ", "(?:YUDDHA|LANKA)"),
      kanda("uttara", "Uttara Kāṇḍa", "ಉತ್ತರ ಕಾಂಡ", "UTTARA"),
    ],
  },
};

export function getBook(work: WorkId, slug: string): BookDef | undefined {
  return SOURCES[work].books.find((b) => b.slug === slug);
}

export function gutenbergUrls(id: number): string[] {
  const mirror = process.env.GUTENBERG_MIRROR?.replace(/\/$/, "");
  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
  if (mirror) {
    const path = String(id).slice(0, -1).split("").join("/");
    urls.unshift(`${mirror}/${path}/${id}/${id}-0.txt`, `${mirror}/cache/epub/${id}/pg${id}.txt`);
  }
  return urls;
}
