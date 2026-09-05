import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * O destino do magic link. Troca o token por sessão e manda para a lista.
 *
 * Se o token já foi usado ou expirou, volta para `/entrar` com o aviso — link
 * de e-mail é clicado duas vezes o tempo todo, e a segunda vez não pode virar
 * uma tela branca.
 */
export async function GET(requisicao: NextRequest) {
  const { searchParams, origin } = requisicao.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && tipo) {
    const supabase = await supabaseServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link`);
}
