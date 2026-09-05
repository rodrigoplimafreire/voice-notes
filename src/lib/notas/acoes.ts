"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { BUCKET, COLUNAS, type Nota } from "./tipos";

/**
 * Tudo que escreve nota passa por aqui.
 *
 * Nenhuma destas funções confia num `user_id` vindo do cliente: quem decide o
 * dono é a sessão, e a RLS confere de novo no banco. São duas cercas para a
 * mesma coisa de propósito — a de cima é conveniência, a de baixo é a que vale.
 */

// Num módulo "use server" todo export precisa ser função async — constante
// exportada aqui derruba o módulo inteiro, e o erro aponta para quem importa.
// Por isso o nome do bucket vive em `tipos.ts`.

async function exigirUsuario() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/entrar");
  return { supabase, usuario: data.user };
}

/**
 * Cria a nota em `pendente` e devolve o caminho onde o áudio deve ser gravado.
 *
 * A linha nasce antes do upload de propósito: se a rede cair no meio, a nota
 * aparece na lista como pendente em vez de sumir. Nada some da lista.
 */
export async function criarNota(dados: {
  duracaoMs: number;
  extensao: string;
}): Promise<{ id: string; caminho: string }> {
  const { supabase, usuario } = await exigirUsuario();

  const { data, error } = await supabase
    .from("notas")
    .insert({
      user_id: usuario.id,
      estado: "pendente",
      origem: "voz",
      duracao_ms: dados.duracaoMs,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Não deu para criar a nota: ${error.message}`);

  const caminho = `${usuario.id}/${data.id}.${dados.extensao}`;

  const { error: erroCaminho } = await supabase
    .from("notas")
    .update({ audio_caminho: caminho })
    .eq("id", data.id);

  if (erroCaminho) throw new Error(`Não deu para guardar o caminho: ${erroCaminho.message}`);

  revalidatePath("/");
  return { id: data.id, caminho };
}

export async function marcarEstado(
  id: string,
  estado: "pendente" | "transcrevendo" | "falhou",
  erro?: string,
) {
  const { supabase } = await exigirUsuario();
  await supabase
    .from("notas")
    .update({ estado, erro: erro ?? null })
    .eq("id", id);
  revalidatePath("/");
}

/** Salva o que o usuário editou. `corpo` é a única coluna de texto que muda. */
export async function salvarCorpo(id: string, corpo: string, titulo?: string | null) {
  const { supabase } = await exigirUsuario();

  const { error } = await supabase
    .from("notas")
    .update({
      corpo,
      titulo: titulo === undefined ? undefined : titulo?.trim() || null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/nota/${id}`);
}

/**
 * Excluir é marcar a data, nunca `delete`.
 *
 * Apagar por engano uma nota que você acabou de ditar, sem poder voltar, é o
 * tipo de erro que faz abandonar a ferramenta. A rotina da Entrega 5 apaga de
 * verdade 30 dias depois.
 */
export async function excluirNota(id: string) {
  const { supabase } = await exigirUsuario();
  await supabase.from("notas").update({ excluido_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/");
  redirect(`/?excluida=${id}`);
}

export async function desfazerExclusao(id: string) {
  const { supabase } = await exigirUsuario();
  await supabase.from("notas").update({ excluido_em: null }).eq("id", id);
  revalidatePath("/");
  redirect(`/nota/${id}`);
}

/** URL assinada do áudio, enquanto ele existir. Some aos 30 dias (Entrega 5). */
export async function urlDoAudio(caminho: string): Promise<string | null> {
  const { supabase } = await exigirUsuario();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 10);
  return data?.signedUrl ?? null;
}

export async function lerNota(id: string): Promise<Nota | null> {
  const { supabase } = await exigirUsuario();
  const { data } = await supabase
    .from("notas")
    .select(COLUNAS)
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle();
  return (data as Nota | null) ?? null;
}

export async function sair() {
  const { supabase } = await exigirUsuario();
  await supabase.auth.signOut();
  redirect("/entrar");
}
