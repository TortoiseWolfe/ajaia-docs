"use client";

import { type Editor, useEditorState } from "@tiptap/react";

function Btn({
  label,
  title,
  active,
  disabled,
  onClick,
  className = "",
}: {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      // keep the editor's selection when clicking a toolbar button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded px-2 py-1 text-sm ${
        active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
      } disabled:opacity-35 disabled:hover:bg-transparent ${className}`}
    >
      {label}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-stone-200" aria-hidden />;

export function Toolbar({ editor }: { editor: Editor | null }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            h1: e.isActive("heading", { level: 1 }),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });
  if (!editor || !s) return <div className="h-11 border-b border-stone-200" />;
  const c = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-stone-200 bg-white/95 px-2 py-1.5 backdrop-blur"
    >
      <Btn label="B" title="Bold (Ctrl+B)" className="font-bold" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn label="I" title="Italic (Ctrl+I)" className="italic" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Btn label="U" title="Underline (Ctrl+U)" className="underline" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <Sep />
      <Btn label="H1" title="Heading 1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} />
      <Btn label="H2" title="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn label="H3" title="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <Sep />
      <Btn label="• List" title="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <Btn label="1. List" title="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <Sep />
      <Btn label="↶" title="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => c().undo().run()} />
      <Btn label="↷" title="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={() => c().redo().run()} />
    </div>
  );
}
