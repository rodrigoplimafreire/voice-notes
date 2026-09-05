"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErroMicrofone, GravadorDeAudio, MENSAGENS_FALHA } from "@/lib/audio/recorder";
import { extensaoPara } from "@/lib/audio/mime";
import { copiarNoGesto } from "@/lib/audio/copiar";
import { criarNota, marcarEstado } from "@/lib/notas/acoes";
import { BUCKET } from "@/lib/notas/tipos";
import { supabaseNavegador } from "@/lib/supabase/navegador";

/**
 * O ciclo inteiro de uma nota ditada, do toque em gravar ao texto copiado.
 *
 * A ordem importa e é a da seção 5.1 do PRD: a linha nasce em `pendente` antes
 * de qualquer byte subir, para que uma queda de rede deixe uma nota pendente na
 * lista em vez de não deixar nada.
 */

export type EstadoGravacao = "parado" | "gravando" | "enviando" | "transcrevendo";

export function usarGravacao() {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoGravacao>("parado");
  const [decorridoMs, setDecorridoMs] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  /** `true` quando a transcrição chegou e o texto foi para a área de transferência. */
  const [copiado, setCopiado] = useState(false);
  /** Id da nota cuja cópia automática o navegador recusou. Vira botão em destaque. */
  const [precisaCopiar, setPrecisaCopiar] = useState<string | null>(null);

  const gravador = useRef<GravadorDeAudio | null>(null);
  const inicio = useRef(0);
  const ultimaNota = useRef<string | null>(null);

  useEffect(() => {
    if (estado !== "gravando") return;
    const relogio = setInterval(() => setDecorridoMs(performance.now() - inicio.current), 100);
    return () => clearInterval(relogio);
  }, [estado]);

  useEffect(() => () => gravador.current?.encerrar(), []);

  const comecar = useCallback(async () => {
    setErro(null);
    setCopiado(false);
    setPrecisaCopiar(null);
    setNivel(0);
    setDecorridoMs(0);

    const g = new GravadorDeAudio({ aoMedirNivel: setNivel });
    try {
      await g.iniciar();
    } catch (e) {
      g.encerrar();
      setErro(
        e instanceof ErroMicrofone
          ? MENSAGENS_FALHA[e.causa]
          : "Não foi possível acessar o microfone.",
      );
      return;
    }

    gravador.current = g;
    inicio.current = performance.now();
    setEstado("gravando");
  }, []);

  const cancelar = useCallback(() => {
    gravador.current?.encerrar();
    gravador.current = null;
    setNivel(0);
    setEstado("parado");
  }, []);

  /**
   * Chamado direto do toque em "parar". Não pode virar `async` antes de montar
   * a promessa da área de transferência: é o gesto deste clique que autoriza a
   * escrita, e ele vence no primeiro `await`.
   */
  const parar = useCallback(() => {
    const g = gravador.current;
    if (!g) return;

    gravador.current = null;
    setNivel(0);
    setEstado("enviando");

    const pipeline = (async () => {
      const bloco = await g.parar();

      const { id, caminho } = await criarNota({
        duracaoMs: bloco.duracaoMs,
        extensao: extensaoPara(bloco.mimeEscolhido),
      });

      router.refresh();

      const supabase = supabaseNavegador();
      const subida = await supabase.storage
        .from(BUCKET)
        .upload(caminho, bloco.blob, { contentType: bloco.mimeEscolhido, upsert: true });

      if (subida.error) {
        await marcarEstado(id, "falhou", `O áudio não subiu: ${subida.error.message}`);
        router.refresh();
        throw new Error("O áudio não subiu. A nota ficou na lista para tentar de novo.");
      }

      setEstado("transcrevendo");

      const resposta = await fetch("/api/transcrever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notaId: id }),
      });

      const dados = (await resposta.json()) as { ok: boolean; texto?: string; erro?: string };
      router.refresh();

      if (!dados.ok || !dados.texto) {
        throw new Error(dados.erro ?? "A transcrição falhou.");
      }

      ultimaNota.current = id;
      return dados.texto;
    })();

    // A promessa entra na área de transferência ainda dentro do gesto.
    const copia = copiarNoGesto(pipeline);

    void (async () => {
      try {
        await pipeline;
        const foiCopiado = await copia;
        setCopiado(foiCopiado);
        if (!foiCopiado) setPrecisaCopiar(ultimaNota.current);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setEstado("parado");
        setDecorridoMs(0);
      }
    })();
  }, [router]);

  return {
    estado,
    decorridoMs,
    nivel,
    erro,
    copiado,
    precisaCopiar,
    comecar,
    parar,
    cancelar,
    limparAviso: () => {
      setCopiado(false);
      setErro(null);
    },
  };
}
