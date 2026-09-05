import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão a cada requisição.
 *
 * Server Component não pode escrever cookie, então é aqui que o refresh token
 * é trocado e os cookies novos são gravados. Sem isto a sessão expiraria em uma
 * hora e o login cairia sozinho — num app que se usa todo dia, isso é a
 * diferença entre abrir e falar, e abrir e ter que entrar de novo.
 */
export async function proxy(request: NextRequest) {
  const resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (novos) => {
          novos.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const publico = caminho.startsWith("/entrar") || caminho.startsWith("/auth");

  if (!user && !publico) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  if (user && caminho.startsWith("/entrar")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  // Tudo menos estático e as rotas de arquivo do Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
