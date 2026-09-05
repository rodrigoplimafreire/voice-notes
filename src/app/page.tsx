import { supabaseServidor } from "@/lib/supabase/servidor";
import { COLUNAS, type Nota } from "@/lib/notas/tipos";
import { TelaLista } from "@/components/tela-lista";

/**
 * A lista. Lê do banco a cada requisição — na Entrega 3 ela passa a ler do
 * Dexie e nenhuma tela mais espera a rede para desenhar.
 */
export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<{ excluida?: string }>;
}) {
  const { excluida } = await searchParams;
  const supabase = await supabaseServidor();

  const { data } = await supabase
    .from("notas")
    .select(COLUNAS)
    .is("excluido_em", null)
    .order("atualizado_em", { ascending: false })
    .limit(200);

  return <TelaLista notas={(data ?? []) as Nota[]} excluida={excluida ?? null} />;
}
