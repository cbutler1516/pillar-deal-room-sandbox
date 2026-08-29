import { signOut } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-ink transition hover:bg-surface-muted"
      >
        Log out
      </button>
    </form>
  );
}
