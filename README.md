# Voice Notes

Bloco de notas por voz. Toca para gravar, fala, toca para parar, troca de app,
cola. É esse o ciclo inteiro, e ele foi desenhado para não gastar nenhum toque
com coisa que não seja falar.

## A decisão que define o produto

Um PWA não escreve texto dentro de outro aplicativo. No Android isso exigiria um
teclado próprio; no desktop, um app nativo com atalho global. O navegador não
permite nem um nem outro, por projeto. Isso não é uma limitação a contornar com
esforço: é o formato do produto.

A consequência é a única regra de interface que importa aqui: **no instante em
que a transcrição fica pronta, o texto vai para a área de transferência sozinho,
e a tela avisa que foi.** O botão "Copiar" continua existindo para copiar de
novo mais tarde, mas no caminho principal ele nunca é usado. Se o navegador
recusar a escrita automática, a interface cai para um "Copiar" em destaque, sem
mensagem de erro — falha silenciosa que vira um botão.

## Os limites são de propósito

- **Três minutos por gravação**, com contagem regressiva a partir de 2:30. A
  função de servidor tem teto de execução e o áudio longo é quem o encosta; o
  modo como isso falha sem limite é o pior possível, com o aparelho girando para
  sempre. O rótulo diz "máximo 3 min" em vez de fingir o contrário.
- **Um usuário.** Sem cadastro público, sem planos, sem cobrança. A RLS por
  `user_id` desde o primeiro dia deixa a porta aberta sem custo; construir a
  porta hoje seria custo sem hipótese.
- **O áudio é apagado aos 30 dias; o texto fica.** O ativo é o texto. Áudio é
  lixo caro depois de transcrito, e é ele que estoura o plano gratuito em
  silêncio.
- **Excluir é reversível por 30 dias.** Apagar por engano uma nota recém-ditada,
  sem poder voltar, é o tipo de erro que faz abandonar a ferramenta.
- **Sem modo escuro, sem editor rico, sem pastas nem tags.** A nota vai ser
  colada num campo de WhatsApp; texto puro é o formato de destino.
- **O texto cru e o texto polido são guardados separados**, e o polimento nunca
  bloqueia a entrega da nota. Sem isso não há como responder "isso eu falei ou o
  polimento inventou?", que é a pergunta que decide se você continua usando o
  app.

## Origem

Não é greenfield. A peça mais arriscada — transcrição por Whisper em produção —
já existe testada no [Obra Nova](https://github.com/rodrigoplimafreire/obra-nova)
e é para ser copiada, não reescrita: o provedor de transcrição carrega quatro
descobertas que custaram depuração em produção, e "limpar" aquele arquivo
significa apagá-las. O design system vem do mesmo lugar, já implementado em CSS
e calibrado para contraste AA. Amarelo é ação, grafite é estrutura, arroio é
dado e progresso; Archivo fala, IBM Plex Mono mede.

## Estado

**Só o PRD.** Ainda não há uma linha de código.

O próximo passo é a Entrega 0, que existe para o projeto poder ser abandonado
barato: uma página sem banco, sem login e sem PWA, que grava, transcreve e mostra
o texto. O aceite é ditar dez notas de verdade e contar quantas você mandaria sem
corrigir nada. Menos de sete, o projeto para para ser reavaliado — nenhuma tela
bonita conserta transcrição ruim.

Leia [`PRD.md`](PRD.md) inteiro antes de escrever qualquer coisa. É o único
documento válido do projeto.

## Stack pretendida

Next.js (App Router), TypeScript, Tailwind, Supabase (Postgres, Auth por magic
link, Storage, Realtime), Dexie no cliente, deploy na Vercel. Transcrição em
Whisper na Groq, com o provedor agnóstico: trocar para a OpenAI é trocar duas
variáveis de ambiente. A chave nunca chega ao cliente.
