"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ErroMicrofone,
  GravadorDeAudio,
  MENSAGENS_FALHA,
  formatarDuracao,
  formatarTamanho,
} from "@/lib/audio/recorder";

/**
 * Entrega 0 do PRD: gravar, mandar para a rota de servidor, mostrar o texto.
 *
 * Sem banco, sem login, sem PWA e sem a cópia automática da seção 3.1 — ela é
 * da Entrega 1. O que existe aqui é só o que responde à pergunta que a Entrega
 * 0 faz: a transcrição é boa o bastante para o projeto continuar?
 *
 * Por isso a tela mede as duas coisas do critério de aceite, nota a nota: o
 * tempo entre soltar o botão e ver o texto, e o texto em si, para você contar
 * quantas mandaria sem corrigir nada.
 */

type Estado = "parado" | "gravando" | "transcrevendo";

type Nota = {
  id: number;
  texto: string;
  /** Do fim da gravação até o texto na tela. É a métrica da Entrega 0. */
  esperaMs: number;
  duracaoMs: number;
  bytes: number;
  provedor: string | null;
};

export function Gravador() {
  const [estado, setEstado] = useState<Estado>("parado");
  const [decorridoMs, setDecorridoMs] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [copiada, setCopiada] = useState<number | null>(null);

  const gravador = useRef<GravadorDeAudio | null>(null);
  const inicio = useRef(0);
  const proximoId = useRef(1);

  // Cronômetro da gravação. Fica no cliente porque a duração do container sai
  // sem header e `audio.duration` vira Infinity — o tempo é medido, não lido.
  useEffect(() => {
    if (estado !== "gravando") return;
    const relogio = setInterval(() => {
      setDecorridoMs(performance.now() - inicio.current);
    }, 100);
    return () => clearInterval(relogio);
  }, [estado]);

  // Solta o microfone se a página for embora no meio da gravação.
  useEffect(() => () => gravador.current?.encerrar(), []);

  const comecar = useCallback(async () => {
    setErro(null);
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

  const parar = useCallback(async () => {
    const g = gravador.current;
    if (!g) return;

    const bloco = await g.parar();
    gravador.current = null;
    setNivel(0);
    setEstado("transcrevendo");

    // O relógio da métrica começa aqui: soltar o botão.
    const soltou = performance.now();

    const form = new FormData();
    form.append("audio", bloco.blob, "audio");
    form.append("mime", bloco.mimeEscolhido);

    try {
      const resposta = await fetch("/api/transcrever", { method: "POST", body: form });
      const dados = (await resposta.json()) as {
        ok: boolean;
        texto?: string;
        erro?: string;
        provedor?: string | null;
      };

      if (!dados.ok || !dados.texto) {
        setErro(dados.erro ?? "A transcrição falhou.");
      } else {
        setNotas((atuais) => [
          {
            id: proximoId.current++,
            texto: dados.texto!,
            esperaMs: performance.now() - soltou,
            duracaoMs: bloco.duracaoMs,
            bytes: bloco.tamanhoBytes,
            provedor: dados.provedor ?? null,
          },
          ...atuais,
        ]);
      }
    } catch {
      setErro("A rede caiu antes de a transcrição voltar.");
    } finally {
      setEstado("parado");
    }
  }, []);

  async function copiar(nota: Nota) {
    try {
      await navigator.clipboard.writeText(nota.texto);
      setCopiada(nota.id);
      setTimeout(() => setCopiada(null), 2000);
    } catch {
      setErro("O navegador recusou a cópia. Selecione o texto e copie à mão.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="cartao flex flex-col items-center gap-5 p-6">
        {/* Um único botão amarelo por tela. Aqui ele é a tela inteira. */}
        <button
          type="button"
          className={`btn btn-campo w-full ${
            estado === "gravando" ? "btn-secundario" : "btn-primario"
          } ${estado === "transcrevendo" ? "btn-carregando" : ""}`}
          disabled={estado === "transcrevendo"}
          onClick={estado === "gravando" ? parar : comecar}
        >
          {estado === "gravando" && <span aria-hidden className="girando" />}
          {estado === "parado" && "Gravar"}
          {estado === "gravando" && "Parar"}
          {estado === "transcrevendo" && "Transcrevendo…"}
        </button>

        <p className="numero text-3xl tabular-nums">
          {formatarDuracao(estado === "gravando" ? decorridoMs : 0)}
        </p>

        {/* Medidor de volume: a resposta à ansiedade número um de quem grava,
            "está pegando minha voz?". Arroio é dado e progresso. */}
        <div className="h-1.5 w-full overflow-hidden bg-cinza-100" aria-hidden>
          <div
            className="h-full bg-arroio transition-[width] duration-75"
            style={{ width: `${Math.min(100, Math.round(nivel * 140))}%` }}
          />
        </div>

        <p className="rotulo text-center">
          {estado === "gravando"
            ? "Fale. Toque em parar quando terminar."
            : "Entrega 0 · sem banco, sem login, sem PWA"}
        </p>
      </div>

      {erro && (
        <div className="aviso aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {notas.map((nota) => (
        <article key={nota.id} className="cartao flex flex-col gap-4 p-5">
          <p className="whitespace-pre-wrap leading-relaxed">{nota.texto}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cinza-100 pt-3">
            {/* Número que se compara é mono tabular, sempre. */}
            <span className="numero text-xs text-cinza">
              {(nota.esperaMs / 1000).toFixed(1)}s até o texto · áudio de{" "}
              {formatarDuracao(nota.duracaoMs)} · {formatarTamanho(nota.bytes)}
              {nota.provedor ? ` · ${nota.provedor}` : ""}
            </span>
            <button type="button" className="acao-texto" onClick={() => copiar(nota)}>
              {copiada === nota.id ? "copiado" : "copiar"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
