import { db } from "@/lib/db/neon";
import { createDocument } from "@/lib/db/repo";
import { json, unauthorized } from "@/lib/http";
import { importFile, kindFromName, titleFromName } from "@/lib/import";
import { currentUser } from "@/lib/session";
import { MAX_CONTENT_BYTES, MAX_UPLOAD_BYTES } from "@/lib/validation";

// Upload a .txt, .md or .docx file; it becomes a new document owned by the uploader.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Upload a file using the form field \"file\"." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file was attached." }, 400);

  const kind = kindFromName(file.name);
  if (!kind) return json({ error: "Unsupported file type. Upload a .txt, .md or .docx file." }, 415);
  if (file.size === 0) return json({ error: "That file is empty." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "That file is larger than 1 MB." }, 413);

  const data = Buffer.from(await file.arrayBuffer());
  if (kind === "docx" && !(data[0] === 0x50 && data[1] === 0x4b)) {
    return json({ error: "That doesn't look like a real .docx file." }, 400);
  }

  let content: unknown;
  try {
    content = await importFile(kind, data);
  } catch {
    return json({ error: `Couldn't read that .${kind} file.` }, 422);
  }
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
    return json({ error: "The converted document is too large (512 KB max)." }, 413);
  }

  const doc = await createDocument(db(), user.id, titleFromName(file.name), content);
  return json(doc, 201);
}
