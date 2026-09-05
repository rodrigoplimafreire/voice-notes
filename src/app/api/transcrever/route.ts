import { transcrever } from "@/lib/transcricao/provedor";

/**
 * Entrega 0: recebe o áudio, transcreve, devolve o texto. Sem banco, sem
 * sessão, sem fila — a nota ainda não existe como registro.
 *
 * A chave do provedor nunca sai daqui. Isto é uma rota de servidor
 * justamente porque `GROQ_API_KEY` não pode chegar ao navegador (PRD, seção 9).
 */

export const runtime = "nodejs";

/**
 * O teto da função tem que ficar acima do teto do `fetch` ao provedor (35s em
 * `provedor.ts`), com folga para responder o erro. Ver PRD, seção 3.2.
 */
export const maxDuration = 60;

/** 25 MB é o limite do provedor no plano gratuito. Recusar antes é mais honesto. */
const TAMANHO_MAXIMO = 24 * 1024 * 1024;

export async function POST(requisicao: Request) {
  let form: FormData;
  try {
    form = await requisicao.formData();
  } catch {
    return Response.json(
      { ok: false, erro: "Envio inválido: esperava multipart com o campo `audio`." },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json(
      { ok: false, erro: "Nenhum áudio chegou no campo `audio`." },
      { status: 400 },
    );
  }

  if (audio.size > TAMANHO_MAXIMO) {
    return Response.json(
      { ok: false, erro: "Áudio grande demais para o provedor (limite de 25 MB)." },
      { status: 413 },
    );
  }

  // O mime que o cliente *escolheu* no MediaRecorder, não o que o blob reporta:
  // o WebKit devolve `type` vazio, e é a extensão derivada daqui que decide se
  // o provedor aceita o arquivo.
  const mime = typeof form.get("mime") === "string" ? (form.get("mime") as string) : audio.type;

  const inicio = Date.now();
  const resultado = await transcrever(audio, mime || null);
  const decorridoMs = Date.now() - inicio;

  if (!resultado.ok) {
    return Response.json(
      { ok: false, erro: resultado.erro, provedor: resultado.provedor, decorridoMs },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    texto: resultado.texto,
    idioma: resultado.idioma,
    provedor: resultado.provedor,
    decorridoMs,
    bytes: audio.size,
  });
}
