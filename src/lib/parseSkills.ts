export function parseSkills(input: string): string[] {
  return input
    .split(/[|,\n\u2022•·]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

export type SkillGroup = { heading?: string; items: string[] };

/**
 * Parse skills into optional category groups.
 * - A line like "Category: a | b, c" becomes a group with heading "Category".
 * - Blank lines separate groups.
 * - Lines without a colon are appended as items to the current group.
 * - If no headings are present, returns a single group with no heading.
 */
export function parseSkillGroups(input: string): SkillGroup[] {
  if (!input) return [];
  const groups: SkillGroup[] = [];
  let current: SkillGroup | null = null;
  const lines = input.split(/\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current && current.items.length) {
        groups.push(current);
        current = null;
      }
      continue;
    }
    const colon = line.indexOf(":");
    if (colon > 0 && colon < 40) {
      if (current && current.items.length) groups.push(current);
      const heading = line.slice(0, colon).trim();
      const rest = line.slice(colon + 1);
      current = { heading, items: rest.split(/[|,\u2022•·]/g).map(s => s.trim()).filter(Boolean) };
    } else {
      const items = line.split(/[|,\u2022•·]/g).map(s => s.trim()).filter(Boolean);
      if (!current) current = { items: [] };
      current.items.push(...items);
    }
  }
  if (current && current.items.length) groups.push(current);
  return groups;
}