"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador, com a sessão em cookie. */
export function supabaseNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
