export interface TNode {
  type?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: TNode[];
  text?: string;
}

export function walk(node: unknown, fn: (n: TNode) => void): void {
  const n = node as TNode;
  if (!n || typeof n !== "object") return;
  fn(n);
  n.content?.forEach((c) => walk(c, fn));
}

export function findNodes(doc: unknown, type: string): TNode[] {
  const out: TNode[] = [];
  walk(doc, (n) => n.type === type && out.push(n));
  return out;
}

export function markTypes(doc: unknown): Set<string> {
  const out = new Set<string>();
  walk(doc, (n) => n.marks?.forEach((m) => out.add(m.type)));
  return out;
}

export function headingLevels(doc: unknown): number[] {
  return findNodes(doc, "heading").map((h) => Number(h.attrs?.level));
}
