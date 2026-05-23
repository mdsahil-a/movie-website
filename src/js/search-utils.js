/**
 * Normalize text for flexible movie title matching.
 * "Thor: Love and Thunder" -> "thor love and thunder"
 */
export function normalizeForSearch(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split query into searchable tokens (min 2 chars, or single char if whole query is 1 char). */
export function getSearchTokens(query) {
  const normalized = normalizeForSearch(query);
  if (!normalized) return [];
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 1) return parts;
  return parts.filter((t) => t.length >= 2);
}

/**
 * Score how well a movie title matches the query.
 * All tokens must appear somewhere in the title (any order).
 */
export function scoreMovieTitle(title, query) {
  const normalizedTitle = normalizeForSearch(title);
  const normalizedQuery = normalizeForSearch(query);

  if (!normalizedQuery) return 0;

  // Full phrase match (e.g. "love and thunder")
  if (normalizedTitle.includes(normalizedQuery)) {
    let score = 1000;
    if (normalizedTitle.startsWith(normalizedQuery)) score += 150;
    return score;
  }

  const tokens = getSearchTokens(query);
  if (!tokens.length) {
    return normalizedTitle.includes(normalizedQuery) ? 400 : 0;
  }

  // Every word must appear in the title
  if (!tokens.every((t) => normalizedTitle.includes(t))) return 0;

  let score = 200;
  score += tokens.length * 25;

  // Bonus when tokens appear in the same order as typed
  let lastIndex = -1;
  let inOrder = true;
  for (const token of tokens) {
    const idx = normalizedTitle.indexOf(token, lastIndex + 1);
    if (idx === -1) {
      inOrder = false;
      break;
    }
    if (idx <= lastIndex) inOrder = false;
    lastIndex = idx;
    score += Math.max(0, 40 - idx * 0.5);
  }
  if (inOrder) score += 80;

  if (normalizedTitle.startsWith(tokens[0])) score += 60;

  // Prefer shorter, more specific titles when scores tie
  score -= normalizedTitle.length * 0.05;

  return score;
}

export function rankMovies(movies, query, limit = 20) {
  const trimmed = query.trim();
  if (!trimmed) return movies.slice(0, limit);

  return movies
    .map((movie) => ({
      movie,
      score: scoreMovieTitle(movie.title, trimmed),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ movie }) => movie);
}
