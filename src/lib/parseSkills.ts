export function parseSkills(input: string): string[] {
  return input
    .split(/[|,\n]/g)
    .map(s => s.trim())
    .filter(Boolean);
}