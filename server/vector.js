export function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\u0000/g, '')
    .trim();
}

export function buildChunks(pages, { maxWords, overlapWords }) {
  const flattenedWords = [];

  pages.forEach((pageText, pageIndex) => {
    const words = pageText.split(/\s+/).filter(Boolean);

    words.forEach((word) => {
      flattenedWords.push({ word, page: pageIndex + 1 });
    });
  });

  const chunks = [];
  const step = Math.max(1, maxWords - overlapWords);

  for (let start = 0; start < flattenedWords.length; start += step) {
    const slice = flattenedWords.slice(start, start + maxWords);

    if (!slice.length) {
      break;
    }

    chunks.push({
      text: slice.map(({ word }) => word).join(' '),
      pageStart: slice[0].page,
      pageEnd: slice[slice.length - 1].page,
      wordCount: slice.length
    });

    if (start + maxWords >= flattenedWords.length) {
      break;
    }
  }

  return chunks;
}

export function buildEmbedding(text, dimension = 256) {
  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

  for (const token of tokens) {
    const index = hashToken(token) % dimension;
    const weight = 1 + Math.min(token.length, 12) / 12;
    vector[index] += weight;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;

  return vector.map((value) => value / norm);
}

export function cosineSimilarity(left, right) {
  let sum = 0;

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

export function topMatches(items, count) {
  return [...items].sort((left, right) => right.similarity - left.similarity).slice(0, count);
}

function hashToken(token) {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return hash >>> 0;
}