/**
 * Tipos e formatação das notas, **sem** `server-only`: as telas são componentes
 * cliente e precisam disto. O que toca o banco mora em `acoes.ts`.
 */

/** Bucket privado do áudio. Caminho sempre `{user_id}/{id}.{ext}`. */
export const BUCKET = "audio";

export type EstadoDaNota = "pendente" | "transcrevendo" | "pronta" | "falhou";

export type Nota = {
  id: string;
  titulo: string | null;
  corpo: string;
  texto_cru: string | null;
  estado: EstadoDaNota;
  erro: string | null;
  audio_caminho: string | null;
  duracao_ms: number | null;
  provedor: string | null;
  criado_em: string;
  atualizado_em: string;
};

/** As colunas que a lista e a tela de nota precisam. Uma fonte só, sem `select("*")`. */
export const COLUNAS =
  "id, titulo, corpo, texto_cru, estado, erro, audio_caminho, duracao_ms, provedor, criado_em, atualizado_em";

/**
 * O título nasce das primeiras palavras e é editável depois. Nota ditada não
 * ganha nome: ninguém para de falar para batizar o que acabou de dizer.
 */
export function derivarTitulo(corpo: string): string | null {
  const limpo = corpo.trim().replace(/\s+/g, " ");
  if (!limpo) return null;
  if (limpo.length <= 48) return limpo;
  const corte = limpo.slice(0, 48);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return (ultimoEspaco > 24 ? corte.slice(0, ultimoEspaco) : corte) + "…";
}

/** O nome que a lista mostra. */
export function nomeDaNota(nota: Pick<Nota, "titulo" | "corpo" | "estado">): string {
  if (nota.titulo?.trim()) return nota.titulo.trim();
  const derivado = derivarTitulo(nota.corpo);
  if (derivado) return derivado;
  return nota.estado === "falhou" ? "Nota sem transcrição" : "Nota sem título";
}

/** As duas primeiras linhas do corpo, para o cartão dizer do que se trata. */
export function previa(corpo: string): string {
  return corpo.trim().replace(/\s+/g, " ").slice(0, 160);
}

export function formatarDuracao(ms: number | null): string {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Data curta, para o rodapé em mono. Hoje e ontem por extenso: é o que se lê. */
export function formatarData(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mesmoDia(data, hoje)) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(data, ontem)) return "ontem";

  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const ROTULO_ESTADO: Record<EstadoDaNota, string> = {
  pendente: "na fila",
  transcrevendo: "transcrevendo",
  pronta: "pronta",
  falhou: "falhou",
};
