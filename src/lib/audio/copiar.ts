/**
 * A cópia automática da seção 3.1 do PRD, e a razão de ela ser difícil.
 *
 * O navegador só deixa escrever na área de transferência dentro do gesto do
 * usuário. O gesto existe — é o toque em "parar" —, mas o texto só fica pronto
 * depois de subir o áudio e esperar a rede, e a essa altura o gesto já venceu.
 *
 * A saída é o `ClipboardItem` com **promessa** dentro: ele é criado ainda no
 * gesto e resolvido depois, que é exatamente o desenho que o padrão prevê para
 * este caso. Onde isso não existir, tenta o `writeText` simples; e onde o
 * navegador recusar, devolve `false` — a interface cai para o botão "Copiar"
 * em destaque, sem mensagem de erro. Falha silenciosa que vira um botão.
 */
export async function copiarNoGesto(texto: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/plain": texto.then((t) => new Blob([t], { type: "text/plain" })),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // Cai para o caminho simples abaixo.
  }

  try {
    await navigator.clipboard.writeText(await texto);
    return true;
  } catch {
    return false;
  }
}

/** Cópia comum, a partir de um toque direto no botão "Copiar". */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
