export interface MatchCandidate {
  id: number;
  name: string;
  aliases?: string;
}

export interface TitleMatch<T extends MatchCandidate> {
  candidate: T;
  score: number;
}

const MIN_SCORE = 0.9;
const MIN_MARGIN = 0.04;

export function normalizeTitle(value: string): string {
  return value
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(left.split(' ').filter(Boolean));
  const b = new Set(right.split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function editSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return 1 - (previous[right.length] ?? Math.max(left.length, right.length)) / Math.max(left.length, right.length, 1);
}

function scoreName(search: string, candidate: string): number {
  const normalizedCandidate = normalizeTitle(candidate);
  if (search === normalizedCandidate) return 1;
  if (search.length < 5 || normalizedCandidate.length < 5) return 0;
  return editSimilarity(search, normalizedCandidate) * 0.65 + tokenSimilarity(search, normalizedCandidate) * 0.35;
}

function candidateNames(candidate: MatchCandidate): string[] {
  return [candidate.name, ...(candidate.aliases?.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean) ?? [])];
}

export function findStrictMatch<T extends MatchCandidate>(title: string, candidates: T[]): TitleMatch<T> | null {
  const search = normalizeTitle(title);
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: Math.max(...candidateNames(candidate).map((name) => scoreName(search, name))),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  if (!best || best.score < MIN_SCORE) return null;
  if (best.score < 1 && ranked[1] && best.score - ranked[1].score < MIN_MARGIN) return null;
  return best;
}
