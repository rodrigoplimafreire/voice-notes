import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente do servidor, com a sessão vinda dos cookies.
 *
 * Respeita RLS: o que ele enxerga é o que a policy `notas_proprias` deixa. Não
 * existe cliente com service role neste projeto, e é de propósito — o servidor
 * nunca precisa ver a nota de outra pessoa.
 */
export async function supabaseServidor() {
  const jar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (novos) => {
          try {
            novos.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            // Server Component não pode escrever cookie. O proxy renova a
            // sessão antes de chegar aqui, então isto é esperado.
          }
        },
      },
    },
  );
}

/** O usuário da requisição, ou null. */
export async function usuarioAtual() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
