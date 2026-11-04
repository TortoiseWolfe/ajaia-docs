import StarterKit from "@tiptap/starter-kit";

/**
 * One schema for the browser editor AND the server-side import.
 * Anything this schema doesn't know (script, style, iframe, img, tables...)
 * is dropped when HTML is parsed into it, which is what sanitises uploads.
 * StarterKit v3 already includes Underline and Link.
 */
export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
];
