/** 滑动窗口分片：每片约 chunkSize 字，相邻重叠 overlap 字 */
export function splitTextIntoChunks(
  text: string,
  chunkSize = 600,
  overlap = 100,
): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }
  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) {
      break;
    }
    start = Math.max(0, end - overlap);
  }
  return chunks;
}
