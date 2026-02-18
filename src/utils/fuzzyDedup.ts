/**
 * fuzzyDedup.ts — Fuzzy duplicate detection for Roll Call entries.
 *
 * Instead of auto-grouping, this module:
 * 1. Detects similar entries and returns merge *suggestions*
 * 2. Applies only user-confirmed merges to build final groups
 *
 * Detection uses 3 passes: normalize → exact/substring → Levenshtein.
 */

import type { RollCallEntry } from '../types/database';

// --- Public types ---

export interface MergeSuggestion {
  key: string;
  canonical: string;
  entries: { id: string; text: string; submitter: string }[];
}

export interface PlayerGroup {
  canonical: string;
  variants: { text: string; submitter: string }[];
  uniqueSubmitters: number;
}

// --- Normalization ---

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Levenshtein ---

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// --- Similarity detection ---

function areSimilar(normA: string, normB: string): boolean {
  if (normA === normB) return true;

  // Substring check (min 5 chars to avoid false positives)
  if (normA.length >= 5 && normB.includes(normA)) return true;
  if (normB.length >= 5 && normA.includes(normB)) return true;

  // Levenshtein: allow 1 edit per 5 chars
  const maxLen = Math.max(normA.length, normB.length);
  const threshold = Math.floor(maxLen / 5);
  if (threshold > 0 && levenshtein(normA, normB) <= threshold) return true;

  return false;
}

/**
 * Returns true if two raw name strings are similar enough to be considered
 * the same player. Used in career mode answer validation to allow typos and
 * partial names (e.g. "Michael Pittman" matching "Michael Pittman Jr").
 */
export function areSimilarNames(a: string, b: string): boolean {
  return areSimilar(normalize(a), normalize(b));
}

// --- Suggestion generation ---

/** Build a stable key for a set of entry IDs (sorted + joined). */
function buildSuggestionKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

/**
 * Finds groups of similar entries and returns them as merge suggestions.
 * Skips groups whose key is already confirmed or dismissed.
 */
export function findSuggestions(
  entries: RollCallEntry[],
  confirmedKeys: Set<string>,
  dismissedKeys: Set<string>
): MergeSuggestion[] {
  if (entries.length < 2) return [];

  const normalized = entries.map(e => ({ entry: e, norm: normalize(e.entry_text) }));

  // Union-find via group map: entry index → group id
  const groupOf = new Map<number, number>();
  let nextGroup = 0;

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (!areSimilar(normalized[i].norm, normalized[j].norm)) continue;

      const gi = groupOf.get(i);
      const gj = groupOf.get(j);

      if (gi === undefined && gj === undefined) {
        const id = nextGroup++;
        groupOf.set(i, id);
        groupOf.set(j, id);
      } else if (gi !== undefined && gj === undefined) {
        groupOf.set(j, gi);
      } else if (gi === undefined && gj !== undefined) {
        groupOf.set(i, gj);
      } else if (gi !== gj) {
        // Merge groups: reassign all of gj to gi
        for (const [idx, g] of groupOf.entries()) {
          if (g === gj) groupOf.set(idx, gi!);
        }
      }
    }
  }

  // Collect groups with 2+ members
  const groupMembers = new Map<number, number[]>();
  for (const [idx, gid] of groupOf.entries()) {
    const list = groupMembers.get(gid) || [];
    list.push(idx);
    groupMembers.set(gid, list);
  }

  const suggestions: MergeSuggestion[] = [];

  for (const memberIndices of groupMembers.values()) {
    if (memberIndices.length < 2) continue;

    const groupEntries = memberIndices.map(i => normalized[i].entry);
    const ids = groupEntries.map(e => e.id);
    const key = buildSuggestionKey(ids);

    if (confirmedKeys.has(key) || dismissedKeys.has(key)) continue;

    // Canonical = longest entry text
    const canonical = groupEntries.reduce((longest, e) =>
      e.entry_text.length > longest.entry_text.length ? e : longest
    ).entry_text;

    suggestions.push({
      key,
      canonical,
      entries: groupEntries.map(e => ({
        id: e.id,
        text: e.entry_text,
        submitter: e.player_name,
      })),
    });
  }

  return suggestions;
}

// --- Apply confirmed merges to build results ---

/**
 * Builds the final grouped list. Confirmed merges are grouped together;
 * all other entries appear as individual items.
 */
export function applyMerges(
  entries: RollCallEntry[],
  confirmedMerges: string[][]
): PlayerGroup[] {
  if (entries.length === 0) return [];

  const entryMap = new Map(entries.map(e => [e.id, e]));
  const usedIds = new Set<string>();
  const groups: PlayerGroup[] = [];

  // Build groups from confirmed merges
  for (const mergeIds of confirmedMerges) {
    const mergeEntries = mergeIds
      .map(id => entryMap.get(id))
      .filter((e): e is RollCallEntry => e !== undefined);

    if (mergeEntries.length === 0) continue;

    for (const e of mergeEntries) usedIds.add(e.id);

    const canonical = mergeEntries.reduce((longest, e) =>
      e.entry_text.length > longest.entry_text.length ? e : longest
    ).entry_text;

    groups.push({
      canonical,
      variants: mergeEntries.map(e => ({ text: e.entry_text, submitter: e.player_name })),
      uniqueSubmitters: new Set(mergeEntries.map(e => e.player_id)).size,
    });
  }

  // Add remaining entries as individual groups
  for (const entry of entries) {
    if (usedIds.has(entry.id)) continue;
    groups.push({
      canonical: entry.entry_text,
      variants: [{ text: entry.entry_text, submitter: entry.player_name }],
      uniqueSubmitters: 1,
    });
  }

  // Sort: most submitters first, then alphabetical
  groups.sort((a, b) => {
    if (b.uniqueSubmitters !== a.uniqueSubmitters) return b.uniqueSubmitters - a.uniqueSubmitters;
    return a.canonical.localeCompare(b.canonical);
  });

  return groups;
}
