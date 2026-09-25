/**
 * Split narration into chunks of at most `max` characters for TTS, breaking on
 * paragraph and sentence boundaries (".", "?", "!", "।", "॥").
 */
export function splitForSpeech(text: string, max = 450): string[] {
  const chunks: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const sentences = para
      .replace(/\s+/g, " ")
      .trim()
      .match(/[^.?!।॥]+[.?!।॥]+["'”’)]*\s*|[^.?!।॥]+$/g);
    if (!sentences) continue;
    let buf = "";
    for (const raw of sentences) {
      const s = raw.trim();
      if (!s) continue;
      if (buf && buf.length + 1 + s.length > max) {
        chunks.push(buf);
        buf = "";
      }
      if (s.length > max) {
        // Very long sentence: break on commas, then hard-wrap on spaces.
        for (const piece of hardWrap(s, max)) chunks.push(piece);
        continue;
      }
      buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) chunks.push(buf);
  }
  return chunks;
}

function hardWrap(s: string, max: number): string[] {
  const out: string[] = [];
  let buf = "";
  for (const word of s.split(/(?<=,)\s+|\s+/)) {
    if (buf && buf.length + 1 + word.length > max) {
      out.push(buf);
      buf = "";
    }
    buf = buf ? `${buf} ${word}` : word;
  }
  if (buf) out.push(buf);
  return out;
}
