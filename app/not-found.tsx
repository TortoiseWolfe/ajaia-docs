import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Document not found</h1>
      <p className="mt-2 text-stone-600">
        It doesn&apos;t exist, or it hasn&apos;t been shared with you. Ask the owner to share it.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium text-blue-700 underline">
        Back to your documents
      </Link>
    </main>
  );
}
