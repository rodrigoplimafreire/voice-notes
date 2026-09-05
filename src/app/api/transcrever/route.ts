import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { lerConfig, transcrever } from "@/lib/transcricao/provedor";
import { derivarTitulo } from "@/lib/notas/tipos";

/**
 * O caminho do áudio, do jeito que o PRD desenha na seção 5.1: o cliente já
 * subiu o arquivo para o Storage e manda só o id da nota. O servidor baixa,
 * transcreve, grava `texto_cru`, copia para `corpo` e marca `pronta`.
 *
 * A chave do provedor nunca sai daqui.
 */

export const runtime = "nodejs";

/**
 * O teto da função fica acima do teto do `fetch` ao provedor (35s em
 * `provedor.ts`), com folga para gravar o erro e responder. Ver PRD, seção 3.2.
 */
export const maxDuration = 60;

export async function POST(requisicao: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, erro: "Sem sessão." }, { status: 401 });
  }

  let notaId: string | undefined;
  try {
    ({ notaId } = (await requisicao.json()) as { notaId?: string });
  } catch {
    notaId = undefined;
  }

  if (!notaId) {
    return NextResponse.json({ ok: false, erro: "Faltou o id da nota." }, { status: 400 });
  }

  // A RLS já garante que esta nota é do dono da sessão; o `.eq` é só clareza.
  const { data: nota } = await supabase
    .from("notas")
    .select("id, audio_caminho")
    .eq("id", notaId)
    .maybeSingle();

  if (!nota?.audio_caminho) {
    return NextResponse.json({ ok: false, erro: "Nota sem áudio." }, { status: 404 });
  }

  await supabase.from("notas").update({ estado: "transcrevendo", erro: null }).eq("id", notaId);

  const baixado = await supabase.storage.from("audio").download(nota.audio_caminho);

  if (baixado.error || !baixado.data) {
    const erro = `O áudio não voltou do storage: ${baixado.error?.message ?? "vazio"}`;
    await supabase.from("notas").update({ estado: "falhou", erro }).eq("id", notaId);
    return NextResponse.json({ ok: false, erro }, { status: 502 });
  }

  const resultado = await transcrever(
    baixado.data,
    baixado.data.type || null,
    // O vocabulário do usuário entra aqui na Entrega 4.
    null,
    nota.audio_caminho,
  );

  if (!resultado.ok) {
    // Estado `falhou` continua na lista, com "tentar de novo". Nada some da
    // lista por estar em erro.
    await supabase
      .from("notas")
      .update({ estado: "falhou", erro: resultado.erro, provedor: resultado.provedor })
      .eq("id", notaId);

    return NextResponse.json({ ok: false, erro: resultado.erro }, { status: 502 });
  }

  const config = lerConfig();

  const { error } = await supabase
    .from("notas")
    .update({
      // `texto_cru` é registro histórico: escrito uma vez, nunca editado.
      texto_cru: resultado.texto,
      corpo: resultado.texto,
      titulo: derivarTitulo(resultado.texto),
      estado: "pronta",
      erro: null,
      provedor: resultado.provedor,
      modelo: config?.modelo ?? null,
    })
    .eq("id", notaId);

  if (error) {
    return NextResponse.json(
      { ok: false, erro: `A transcrição voltou, mas não deu para gravar: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: notaId, texto: resultado.texto });
}
