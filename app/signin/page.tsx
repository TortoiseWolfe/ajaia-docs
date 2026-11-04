import { redirect } from "next/navigation";
import { db } from "@/lib/db/neon";
import { listUsers } from "@/lib/db/repo";
import { currentUser } from "@/lib/session";
import { SignInPicker } from "./SignInPicker";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await currentUser()) redirect("/");
  const users = await listUsers(db());
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Ajaia Docs</h1>
      <p className="mt-2 text-stone-600">Choose who to continue as.</p>
      <p className="mt-1 text-sm text-amber-800">
        Sign-in is mocked for this demo: there are no passwords. Each person is a seeded user, so you can switch
        between them to try sharing.
      </p>
      <SignInPicker users={users} />
    </main>
  );
}
