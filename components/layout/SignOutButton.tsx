"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="btn px-2.5 py-1.5 text-xs"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch("/api/auth/signout", { method: "POST" });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <LogOut className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
