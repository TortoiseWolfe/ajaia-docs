import type { Role } from "@/lib/db/types";

const STYLES: Record<Role, string> = {
  owner: "bg-stone-900 text-white",
  editor: "bg-emerald-100 text-emerald-900",
  viewer: "bg-sky-100 text-sky-900",
  none: "hidden",
};
const LABELS: Record<Role, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer", none: "" };

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STYLES[role]}`}>{LABELS[role]}</span>;
}
