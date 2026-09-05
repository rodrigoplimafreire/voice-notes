"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usarGravacao } from "@/lib/audio/usar-gravacao";
import { desfazerExclusao, sair } from "@/lib/notas/acoes";
import {
  formatarData,
  formatarDuracao,
  nomeDaNota,
  previa,
  ROTULO_ESTADO,
  type Nota,
} from "@/lib/notas/tipos";

/**
 * A lista, fiel à seção 7.1 do PRD.
 *
 * Um único botão amarelo na tela, e ele é gravar. Nota em `pendente` ou
 * `transcrevendo` aparece com selo neutro e círculo girando; nota `falhou`
 * aparece com selo de atraso. **Nada some da lista por estar em erro.**
 */
export function TelaLista({ notas, excluida }: { notas: Nota[]; excluida: string | null }) {
  const [busca, setBusca] = useState("");
  const gravacao = usarGravacao();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return notas;
    return notas.filter((n) =>
      `${n.titulo ?? ""} ${n.corpo}`.toLowerCase().includes(termo),
    );
  }, [notas, busca]);

  const gravando = gravacao.estado === "gravando";
  const trabalhando = gravacao.estado === "enviando" || gravacao.estado === "transcrevendo";

  return (
    <>
      <main
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pt-8"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <header className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Notas</h1>
          <form action={sair}>
            <button type="submit" className="acao-texto text-cinza">
              sair
            </button>
          </form>
        </header>

        <input
          type="search"
          className="campo"
          placeholder="Buscar"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {excluida && (
          <div className="aviso" role="status">
            <span className="flex-1">Nota excluída.</span>
            <form action={desfazerExclusao.bind(null, excluida)}>
              <button type="submit" className="acao-texto">
                desfazer
              </button>
            </form>
          </div>
        )}

        {gravacao.copiado && (
          <div className="aviso aviso-ok" role="status">
            <span>Nota pronta e já copiada. É só colar.</span>
          </div>
        )}

        {gravacao.precisaCopiar && (
          <div className="aviso" role="status">
            <span className="flex-1">Nota pronta.</span>
            <Link href={`/nota/${gravacao.precisaCopiar}`} className="acao-texto">
              copiar
            </Link>
          </div>
        )}

        {gravacao.erro && (
          <div className="aviso aviso-erro" role="alert">
            <span>{gravacao.erro}</span>
          </div>
        )}

        {filtradas.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-lg font-semibold">
              {busca ? "Nada com esse termo." : "Nenhuma nota ainda."}
            </p>
            <p className="max-w-xs text-sm text-fumaca">
              {busca
                ? "A busca olha título e corpo."
                : "Toque no botão amarelo, fale, e toque de novo para parar. O texto sai copiado."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtradas.map((nota) => (
              <li key={nota.id}>
                <Link href={`/nota/${nota.id}`} className="cartao flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold leading-snug">{nomeDaNota(nota)}</h2>
                    {nota.estado !== "pronta" && (
                      <span
                        className={`selo ${nota.estado === "falhou" ? "selo-atraso" : "selo-neutro"}`}
                      >
                        {nota.estado !== "falhou" && <span aria-hidden className="girando" />}
                        {ROTULO_ESTADO[nota.estado]}
                      </span>
                    )}
                  </div>

                  {nota.corpo.trim() && (
                    <p className="line-clamp-2 text-sm text-fumaca">{previa(nota.corpo)}</p>
                  )}

                  <p className="numero text-left text-xs text-cinza">
                    {formatarData(nota.atualizado_em)} · {formatarDuracao(nota.duracao_ms)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      {gravando && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-8 bg-papel px-6">
          <p className="numero text-5xl">{formatarDuracao(gravacao.decorridoMs)}</p>

          <div className="h-2 w-full max-w-xs overflow-hidden bg-cinza-100" aria-hidden>
            <div
              className="h-full bg-arroio transition-[width] duration-75"
              style={{ width: `${Math.min(100, Math.round(gravacao.nivel * 140))}%` }}
            />
          </div>

          <p className="rotulo">gravando</p>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <button type="button" className="btn btn-primario btn-campo" onClick={gravacao.parar}>
              Parar
            </button>
            <button
              type="button"
              className="btn btn-sutil btn-campo"
              onClick={() => {
                if (confirm("Descartar esta gravação?")) gravacao.cancelar();
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!gravando && (
        <button
          type="button"
          onClick={gravacao.comecar}
          disabled={trabalhando}
          className={`btn btn-primario btn-campo fixed right-5 z-10 shadow-lg ${
            trabalhando ? "btn-carregando" : ""
          }`}
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          {trabalhando && <span aria-hidden className="girando" />}
          {gravacao.estado === "enviando" && "Enviando…"}
          {gravacao.estado === "transcrevendo" && "Transcrevendo…"}
          {gravacao.estado === "parado" && "Gravar"}
        </button>
      )}
    </>
  );
}
