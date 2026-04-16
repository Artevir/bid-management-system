export function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // ignore malformed JSON
  }
  return [String(value)];
}

export function extractTemplateVariables(text: string): string[] {
  const vars = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
  for (const m of text.matchAll(regex)) {
    vars.add(m[1]);
  }
  return Array.from(vars);
}
