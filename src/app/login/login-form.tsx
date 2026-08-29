"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { signIn, type SignInState } from "@/lib/auth/actions";

const initialState: SignInState = { error: null };

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const error = state.error ?? initialError ?? null;

  return (
    <form action={formAction} className="mt-4 space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={`mt-1 w-full ${inputClass}`}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`mt-1 w-full ${inputClass}`}
        />
      </div>

      <button type="submit" disabled={pending} className={`w-full ${buttonClass("primary")}`}>
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
