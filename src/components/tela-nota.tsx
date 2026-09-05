"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copiar } from "@/lib/audio/copiar";
import { excluirNota, salvarCorpo, urlDoAudio } from "@/lib/notas/acoes";
import { derivarTitulo, formatarData, formatarDuracao, type Nota } from "@/lib/notas/tipos";

/**
 * A tela da nota, seção 7.3 do PRD.
 *
 * Texto editável direto, sem modo de edição separado, salvando sozinho. A barra
 * de baixo é fixa e tem altura de campo: no celular ela é o alvo do polegar.
 *
 * O alternador "original / limpo" só aparece na Entrega 4, quando houver
 * polimento para comparar.
 */
export function TelaNota({ nota }: { nota: Nota }) {
  const router = useRouter();
  const [corpo, setCorpo] = useState(nota.corpo);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);

  const primeiraRenderizacao = useRef(true);

  // Salva sozinho, um pouco depois de parar de digitar. Sem botão "salvar":
  // botão de salvar é uma forma de perguntar se a pessoa quis o que ela já fez.
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setSalvando(true);
      try {
        await salvarCorpo(nota.id, corpo, nota.titulo ?? derivarTitulo(corpo));
      } finally {
        setSalvando(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [corpo, nota.id, nota.titulo]);

  async function aoCopiar() {
    const ok = await copiar(corpo);
    if (!ok) {
      setAviso("O navegador recusou a cópia. Selecione o texto e copie à mão.");
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function compartilhar() {
    try {
      await navigator.share({ text: corpo });
    } catch {
      // Cancelar o compartilhamento cai aqui e não é erro.
    }
  }

  async function ouvir() {
    if (!nota.audio_caminho) return;
    const url = await urlDoAudio(nota.audio_caminho);
    if (!url) {
      setAviso("O áudio não está mais disponível.");
      return;
    }
    setAudio(url);
  }

  async function tentarDeNovo() {
    setTentando(true);
    setAviso(null);
    try {
      const resposta = await fetch("/api/transcrever", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notaId: nota.id }),
      });
      const dados = (await resposta.json()) as { ok: boolean; texto?: string; erro?: string };
      if (dados.ok && dados.texto) {
        setCorpo(dados.texto);
        primeiraRenderizacao.current = true;
      } else {
        setAviso(dados.erro ?? "A transcrição falhou de novo.");
      }
      router.refresh();
    } finally {
      setTentando(false);
    }
  }

  const podeCompartilhar = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <>
      <main
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 pt-6"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="acao-texto text-cinza">
            notas
          </Link>
          <span className="numero text-xs text-cinza">
            {formatarData(nota.criado_em)} · {formatarDuracao(nota.duracao_ms)}
            {salvando ? " · salvando" : ""}
          </span>
        </div>

        {nota.estado === "falhou" && (
          <div className="aviso aviso-erro" role="alert">
            <span className="flex-1">{nota.erro ?? "A transcrição falhou."}</span>
          </div>
        )}

        {aviso && (
          <div className="aviso aviso-atencao" role="status">
            <span>{aviso}</span>
          </div>
        )}

        <textarea
          className="campo rolagem-campo min-h-[50vh] flex-1 resize-none py-3 leading-relaxed"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          placeholder={
            nota.estado === "falhou"
              ? "Sem transcrição. Você pode tentar de novo ou escrever aqui."
              : "Transcrevendo…"
          }
        />

        {audio && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio className="w-full" src={audio} controls autoPlay />
        )}

        <div className="flex flex-wrap items-center gap-5 pb-2">
          {nota.audio_caminho ? (
            <button type="button" className="acao-texto text-cinza" onClick={ouvir}>
              ouvir o áudio
            </button>
          ) : (
            <span className="acao-texto text-cinza-400 no-underline">áudio expirado</span>
          )}

          <button
            type="button"
            className="acao-texto text-cinza"
            onClick={tentarDeNovo}
            disabled={tentando || !nota.audio_caminho}
          >
            {tentando ? "tentando…" : "tentar de novo"}
          </button>

          <form action={excluirNota.bind(null, nota.id)}>
            <button type="submit" className="acao-texto text-atraso">
              excluir
            </button>
          </form>
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t border-nevoa bg-papel px-5 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <button type="button" className="btn btn-primario btn-campo flex-1" onClick={aoCopiar}>
          {copiado ? "Copiado" : "Copiar"}
        </button>
        {podeCompartilhar && (
          <button
            type="button"
            className="btn btn-secundario btn-campo flex-1"
            onClick={compartilhar}
          >
            Compartilhar
          </button>
        )}
      </div>
    </>
  );
}
