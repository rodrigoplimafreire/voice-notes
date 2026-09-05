"use client";

import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";

/**
 * Magic link. Sem senha, porque senha é mais uma coisa para lembrar num app que
 * existe para você não precisar lembrar de nada.
 */
export default function Entrar() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEstado("enviando");

    const { error } = await supabaseNavegador().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmar` },
    });

    if (error) {
      setErro(error.message);
      setEstado("parado");
      return;
    }

    setEstado("enviado");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Voice Notes</h1>
        <p className="text-sm text-fumaca">
          Um link chega no seu e-mail e abre o app. Sem senha.
        </p>
      </header>

      {estado === "enviado" ? (
        <div className="aviso aviso-ok" role="status">
          <span>
            O link foi para <strong>{email}</strong>. Abra no mesmo aparelho em que você vai
            gravar.
          </span>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="rotulo-campo" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primario btn-campo ${estado === "enviando" ? "btn-carregando" : ""}`}
            disabled={estado === "enviando" || !email.trim()}
          >
            {estado === "enviando" && <span aria-hidden className="girando" />}
            {estado === "enviando" ? "Enviando…" : "Receber o link"}
          </button>

          {erro && (
            <div className="aviso aviso-erro" role="alert">
              <span>{erro}</span>
            </div>
          )}
        </form>
      )}
    </main>
  );
}
