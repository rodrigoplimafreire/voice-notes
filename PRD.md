# PRD — Voice Notes: bloco de notas por voz

Versão 1.0, 04/09/2026. **Este é o único PRD válido do projeto.**
Substitui o rascunho de arquitetura 0.1 (30/08/2026), que foi absorvido inteiro
aqui.

Projeto novo, sem código. Mas **não** é greenfield: a peça mais arriscada,
transcrição por Whisper em produção, já existe testada no Obra Nova e é para ser
copiada, não reescrita. A seção 1 diz exatamente o quê.

---

## 0. Como usar este documento

Ordem de leitura para quem vai implementar: seção 1 (o que copiar do Obra Nova,
para não repetir depuração cara), seção 2 (o que é proibido, para não se perder),
seção 3 (o achado que define o produto), depois as entregas na seção 10, na
ordem.

Regra que governa o documento: **nada aqui é construído fora da ordem das
entregas.** Cada entrega é utilizável sozinha e tem critério de aceite
verificável. Se um pedido futuro cair na seção 2 ou na seção 11, recuse e cite a
seção.

Regra que governa o produto: **Voice Notes é ferramenta pessoal de um usuário
só.** Toda vez que uma decisão puder ser tomada em duas direções, a direção certa
é a que cabe em um fim de semana. Não existe segundo usuário até que exista, e
quando existir, a RLS por `user_id` já deixou a porta aberta sem custo.

---

## 1. O que já existe e não deve ser reconstruído

Verificado no código do Obra Nova em 04/09/2026.

### 1.1 `src/lib/transcricao/provedor.ts` — copiar quase inteiro

Esse arquivo é o ativo mais valioso deste projeto e carrega quatro descobertas
que custaram depuração em produção. Reescrever do zero é pagar de novo por elas.

| Descoberta | Regra que ela impõe |
| --- | --- |
| A Groq devolve **500** quando o `prompt` traz caractere fora de ASCII. Testado: "portugues" passa, "português" quebra. | O vocabulário do Whisper é **sempre sem acento**. Vale para o dicionário do usuário da seção 5.2: normalizar para ASCII na hora de montar a string, nunca na hora de salvar. |
| Os provedores decidem o container pela **extensão do nome do arquivo**; um `.bin` genérico é recusado. | Mapear MIME para extensão antes de montar o `FormData`. Chrome Android manda `audio/webm`, Safari manda `audio/mp4`. Sem esse mapa, o iPhone falha e o Android passa, e o bug parece "coisa do iOS". |
| Sem teto no `fetch`, o Node espera para sempre quando o provedor pendura a conexão. Com teto de 60s, o timeout disparou aos 61,3s: o erro foi gravado certinho, mas a função da Vercel já tinha sido cortada e o aparelho ficou preso em "Transcrevendo" para sempre. | Teto de **35s** na chamada ao provedor, abaixo do limite de execução da função, com folga para gravar o erro e responder. Ver seção 3.2. |
| Groq e OpenAI expõem a mesma rota multipart. | Provedor agnóstico: trocar de um para o outro é trocar duas variáveis de ambiente. Não acoplar nada da Groq ao resto do código. |

Ajustes necessários ao copiar, e só estes: `response_format` continua
`verbose_json`; o `Contexto` deixa de ser o par fixo `obra` / `orcamento` e passa
a receber a string de vocabulário montada da tabela do usuário.

### 1.2 `src/app/globals.css` — o design system, já implementado

O documento "Obra Nova Design System.dc.html" já virou CSS, com os racionais
preservados nos comentários. Copiar o arquivo inteiro e apagar o que não se usa
é mais barato e mais fiel do que reinterpretar o documento. Seção 8.

*Nota de processo:* a importação pelo MCP do Claude Design falhou nesta sessão
por falta de autorização (`/design-login`). Se você quiser a fonte original em
vez do CSS derivado, rode `/design-login` numa sessão interativa antes de
começar. O CSS é a versão que passou por AA de contraste e por uso real; o
documento é a versão de pôster. Onde discordarem, o CSS ganha.

### 1.3 O que **não** vem do Obra Nova

Não copie `orgs`, `org_members`, RLS multi-tenant, nem nada de orçamento. Voice
Notes tem um usuário e uma tabela de domínio. Trazer a estrutura multi-tenant
"porque já está pronta" é o erro mais provável desta implementação.

---

## 2. O que NÃO fazer

Lista fechada.

| Não fazer | Por quê |
| --- | --- |
| Transcrição ao vivo, palavra por palavra | A API é por arquivo, não por stream. Simular com chunks de N segundos quebra palavras nas bordas e derruba a acurácia. O próprio Wispr Flow transcreve depois que você solta o botão; a percepção de "ao vivo" vem da latência baixa, não de streaming. |
| Teclado Android, serviço de acessibilidade, injeção de texto em outro app | Muda a natureza do projeto: Kotlin, Play Store, permissões sensíveis. E é justamente o que a seção 3 mostra que não precisa acontecer. |
| Chave da Groq em `NEXT_PUBLIC_*` ou em qualquer bundle do cliente | Quem abrir o DevTools passa a gastar sua cota. Toda chamada ao provedor sai do servidor. |
| Guardar só o texto polido e descartar o cru | O polimento é um LLM. Quando ele reescrever demais, você vai precisar do original para saber que foi ele, e não você. Ver seção 5.3. |
| Reescrever o provedor de transcrição "mais limpo" | Seção 1.1. Limpeza aqui significa apagar as quatro descobertas. |
| Prometer gravação com a tela apagada ou com o app em segundo plano | O navegador suspende o `MediaRecorder`. Prometer isso na interface é prometer perda de áudio. Ver seção 12. |
| Multiusuário, cadastro público, planos, cobrança | Um usuário. RLS por `user_id` desde o primeiro dia deixa a porta aberta sem custo; construir a porta hoje é custo sem hipótese. |
| Pastas, tags, busca semântica, embeddings | Sem volume que justifique. Gatilho para revisar: quando a busca textual simples deixar de achar o que você procura. |
| Modo escuro | O design system é `color-scheme: light`, com contraste calibrado nessa base. Um segundo tema dobra a superfície de teste da paleta de estados sem pedido de ninguém. |
| Áudio como ativo permanente | O ativo é o texto. Áudio é lixo caro depois de transcrito. Ver seção 4.2. |
| Editor rico, formatação, markdown na nota | A nota vai ser colada num campo de WhatsApp. Texto puro é o formato de destino. |

---

## 3. Os achados que definem o produto

### 3.1 O PWA não injeta texto. Então a nota nasce copiada.

O Wispr Flow escreve direto no campo focado de qualquer app. Isso, no Android, só
é possível com um `InputMethodService`; no desktop, com um app nativo e atalho
global. **Um PWA não faz nem um nem outro, por design do navegador.** Isso não é
uma limitação a contornar com esforço: é o formato do produto.

A consequência é a decisão de interface mais importante deste documento. Se o
usuário precisa de um toque para parar, outro para copiar e um terceiro para
trocar de app, o Voice Notes perde para o Wispr Flow em cada uso, todo dia. Então:

**No instante em que a transcrição fica pronta, o texto vai para a área de
transferência sozinho, e a interface diz que foi.**

O fluxo inteiro vira: toca para gravar, fala, toca para parar, troca de app, cola.
Zero toque gasto com "copiar". O botão "Copiar" continua existindo na tela da
nota, para copiar de novo mais tarde, mas no caminho principal ele não é usado.

Restrições reais dessa decisão, que precisam estar no código:

1. `navigator.clipboard.writeText` exige gesto do usuário em alguns navegadores.
   O gesto existe: é o toque em "parar". A escrita precisa acontecer na cadeia
   desse gesto, não numa callback solta depois do `await` da rede. Se a
   transcrição demorar e o navegador recusar a escrita, a interface **cai para o
   botão "Copiar" em destaque**, sem mensagem de erro. Falha silenciosa que vira
   um botão.
2. Copiar sem avisar assusta: o usuário cola outra coisa e perde o que tinha na
   área de transferência. O aviso "copiado" é obrigatório, não decorativo.
3. `navigator.share` fica ao lado como segundo caminho, para mandar direto ao
   WhatsApp sem colar. Onde a Web Share API não existir, o botão não aparece.

### 3.2 O teto da função é o inimigo, e o áudio longo é quem o encosta

Herdado do Obra Nova, seção 1.1: a função da Vercel corta em 60s e a chamada ao
provedor tem teto de 35s. Um áudio de um minuto cabe com sobra. Um áudio de dez
minutos não cabe de jeito nenhum, e o modo como ele falha é o pior possível: o
aparelho fica girando.

Decisão: **a gravação para sozinha em 3 minutos**, com contagem regressiva
visível a partir dos 2:30. A nota é salva normalmente; o usuário grava outra se
precisar. Isso não é uma limitação técnica disfarçada de feature, e a interface
não finge o contrário: o rótulo diz "máximo 3 min".

Fatiar áudio longo em pedaços e costurar transcrições é trabalho real, com bordas
de palavra a resolver, e não tem usuário pedindo. Fora de escopo, seção 11.

---

## 4. Modelo de dados

Postgres no Supabase. Uma tabela de domínio, uma de vocabulário. Toda tabela tem
`user_id` e RLS pelo mesmo padrão.

### 4.1 Notas

```sql
create table notas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  titulo        text,          -- derivado das primeiras palavras, editável
  corpo         text not null default '',   -- o que a UI mostra e o usuário edita
  texto_cru     text,          -- saída do Whisper, nunca editada
  texto_limpo   text,          -- saída do polimento, nunca editada

  origem        text not null default 'voz'
                check (origem in ('voz','manual')),
  estado        text not null default 'pendente'
                check (estado in ('pendente','transcrevendo','pronta','falhou')),
  erro          text,

  audio_caminho text,          -- storage: {user_id}/{id}.{ext}
  duracao_ms    integer,
  modelo        text,
  provedor      text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

alter table notas enable row level security;
create policy notas_proprias on notas for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index notas_usuario_data on notas (user_id, atualizado_em desc)
  where excluido_em is null;
create index notas_busca on notas
  using gin (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || corpo));
```

Três colunas de texto, de propósito. `corpo` é o documento vivo, o único que o
usuário edita. `texto_cru` e `texto_limpo` são registro histórico e nunca mudam
depois de escritos. Sem essa separação não há como responder "isso eu falei ou o
polimento inventou?", que é a pergunta que decide se você continua usando o app.

### 4.2 Áudio, e a rotina que apaga

Bucket `audio`, privado, políticas restritas ao prefixo `{user_id}/`.

**O áudio é apagado 30 dias depois da nota ficar pronta**, e `audio_caminho` vai a
`null`. Rotina diária, uma linha de SQL mais uma chamada de storage.

Sem isso, o plano gratuito do Storage estoura em alguns meses de uso diário e você
descobre no dia em que o app parar de gravar, sem entender por quê. Não é
otimização prematura: é a diferença entre o projeto durar um ano e durar quatro
meses.

### 4.3 Vocabulário

```sql
create table vocabulario (
  user_id   uuid not null references auth.users(id) on delete cascade,
  termo     text not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, termo)
);
alter table vocabulario enable row level security;
create policy vocabulario_proprio on vocabulario for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Seção 5.2.

### 4.4 Exclusão em duas etapas

`excluido_em`, nunca `delete`. Apagar por engano uma nota que você acabou de
ditar, sem poder voltar, é o tipo de erro que faz abandonar a ferramenta. A tela
de nota excluída oferece "desfazer" por 30 dias; depois disso a rotina diária
apaga de verdade, junto com o áudio.

---

## 5. Transcrição

### 5.1 O caminho do áudio

1. Toque em gravar. `getUserMedia` pede o microfone; `MediaRecorder` grava.
2. Toque em parar. O blob vai para o IndexedDB **antes de qualquer rede**, com a
   nota em `pendente`. Nada se perde se a conexão cair aqui.
3. O cliente sobe o áudio para o Storage e chama a rota de servidor com o
   caminho. A nota vai a `transcrevendo`.
4. O servidor baixa o áudio e chama o provedor (código da seção 1.1), com
   `language=pt` fixo e o `prompt` da seção 5.2.
5. Grava `texto_cru`, dispara o polimento, grava `texto_limpo`, copia o resultado
   para `corpo`, marca `pronta`.
6. O cliente recebe, escreve na área de transferência e avisa (seção 3.1).

**A chave nunca sai do servidor.** Repetido aqui de propósito: é o erro mais
comum em projeto desse formato.

### 5.2 Vocabulário do usuário

O endpoint aceita um `prompt` que enviesa o reconhecimento. É assim que se
resolvem os nomes próprios que o Whisper erra sempre: Shalom, Obra Nova, Anawin,
nomes de clientes, jargão de UX.

Regras, todas herdadas de dor real:

- **Sem acento.** A string vai normalizada para ASCII antes de sair. A Groq
  devolve 500 com caractere fora de ASCII (seção 1.1). Normalizar na saída, não
  na entrada: o usuário digita "Comunidade Shalom" e vê "Comunidade Shalom".
- **Curta.** O campo é limitado, na ordem de algumas centenas de tokens. Cortar
  pelos termos mais recentes quando estourar, não falhar.
- **Só o que ele erra de fato.** A tela de vocabulário começa vazia e ganha
  termos quando você percebe um erro, não por antecipação.

O texto orienta o reconhecimento e não aparece na transcrição.

### 5.3 Polimento

Whisper já pontua, mas mantém hesitação: "é", "então", "tipo", repetições, começo
de frase abandonado. O que faz o Wispr Flow parecer mágico é exatamente essa
limpeza, não a transcrição.

Segundo passo com LLM rápido na própria Groq, com instrução restrita: remover
marcadores de hesitação, corrigir pontuação, **preservar o conteúdo, não resumir,
não reescrever, não completar raciocínio**.

Invariantes desse passo:

- `texto_cru` e `texto_limpo` são gravados separados, sempre (seção 4.1).
- A tela da nota tem um alternador discreto "original / limpo".
- **Se o polimento falhar ou demorar, a nota fica pronta com o texto cru.** O
  polimento nunca bloqueia a entrega. Uma nota com "é" sobrando é infinitamente
  melhor que uma nota que não chegou.

*Ressalva:* não fixo aqui o nome do modelo de LLM. O catálogo da Groq muda com
frequência; confira em `console.groq.com/docs/models` na hora de implementar e
escolha o mais barato com qualidade aceitável em português. Não tenho como
garantir hoje qual estará disponível.

---

## 6. Sincronização e offline

- **Fonte local:** IndexedDB via Dexie, espelhando `notas`. A interface lê daqui,
  sempre. Nenhuma tela espera a rede para desenhar.
- **Escrita:** grava local, enfileira numa outbox, envia quando houver rede.
- **Leitura:** Supabase Realtime assinando `notas` do usuário, aplicando no Dexie.
- **Conflito:** last write wins por `atualizado_em`.

**Onde o LWW quebra, declarado:** você edita a mesma nota no celular e no desktop
com um deles sem rede; a edição que sincronizar por último ganha e a outra some
sem aviso. Com um usuário e notas curtas o risco é baixo, e resolver direito
(CRDT ou merge por campo) é desproporcional. Dívida consciente, não descuido.
Gatilho para revisar: a primeira vez que você perder uma edição de verdade.

O caso que **precisa** funcionar é outro, e é o que justifica a outbox: gravar
sem rede, o áudio ficar na fila local, e a transcrição acontecer sozinha quando a
conexão voltar. Sem isso o app falha justamente quando você mais precisa dele.

---

## 7. Telas

Mobile primeiro. Desktop é a mesma aplicação em duas colunas.

### 7.1 `/` — a lista

Fiel ao Wispr Flow e ao bloco de notas de referência, sem invenção.

- Título grande "Notas", em Archivo, peso 600, tracking fechado.
- Campo de busca textual simples. Sem filtros, sem abas.
- Cartões: título, duas linhas do corpo, e um rodapé em mono com data e duração.
  Data e duração são número que se compara, então são mono tabular por regra do
  design system.
- Estado vazio com a frase e o caminho para o botão.
- **Um único botão amarelo na tela: gravar.** Flutuante, canto inferior direito,
  ao alcance do polegar. É a regra central do design system e ela cai perfeita
  aqui: o app tem exatamente uma ação principal.
- Nota em `pendente` ou `transcrevendo` aparece na lista com selo neutro e o
  círculo girando. Nota `falhou` aparece com selo de atraso e ação "tentar de
  novo". **Nada some da lista por estar em erro.**

### 7.2 Gravação

Uma coisa só na tela, porque é uma coisa só que está acontecendo.

- Botão grande, altura de campo (52px), o único alvo.
- Tempo decorrido em mono tabular, grande.
- Forma de onda em tempo real. Não é enfeite: é a resposta à ansiedade número um
  de quem grava, "está pegando minha voz?". Sem ela o usuário fala olhando para
  um cronômetro que anda igual no silêncio e no som.
- A partir de 2:30, contagem regressiva para o corte em 3:00 (seção 3.2).
- Parar e cancelar. Cancelar pede confirmação; parar não.

### 7.3 Nota

- Texto editável direto, sem modo de edição separado. Salva sozinho.
- Barra fixa embaixo: "Copiar" e "Compartilhar". No celular, altura de campo.
- Alternador discreto "original / limpo", em `.acao-texto` (mono, caixa alta,
  micro).
- Menu: excluir, tentar de novo, ouvir o áudio enquanto ele existir.
- Quando o áudio já foi apagado pela rotina dos 30 dias, o menu diz isso em vez
  de oferecer um play quebrado.

### 7.4 Desktop

Duas colunas: lista à esquerda, nota à direita. Atalho de teclado para gravar
**dentro da aba**. Fora da aba não é possível, e a interface não sugere que seja.

### 7.5 Vocabulário

Lista simples de termos, adicionar e remover. Acessível pelo menu, não pela barra
principal. É manutenção, não uso diário.

---

## 8. Design system

Herdado do Obra Nova, arquivo `src/app/globals.css` (seção 1.2). Copiar e podar.

O que se mantém inteiro, porque é o que dá identidade:

- **Amarelo é ação, grafite é estrutura, arroio é dado e progresso. Nunca
  inverter.** Um único botão amarelo por tela.
- **Archivo fala, IBM Plex Mono mede.** Todo número que se compara (duração,
  data, contador de gravação) é mono tabular.
- Raio curto: 0 em tabela e faixa, 4 em botão e campo, 8 em card e modal, pill
  só em selo de estado.
- Cinco variantes de botão, três alturas. Nada além disso entra.
- Desabilitado tem cor própria, nunca `opacity`.
- Estado sempre com rótulo ou ícone, nunca só cor.
- Diálogo é `<dialog>` nativo: modal no desktop, folha de baixo no celular.
- `--altura-abas` e `env(safe-area-inset-bottom)`: o botão flutuante e a barra da
  nota encostam na borda do aparelho e precisam da reserva.

O que se poda, por não ter uso aqui: tudo de tabela de dados e zebra, os selos
`planejado` e `emdia`, as ilustrações, o tema `em-escuro` de barra.

O que muda de papel, e é a única adaptação real:

| Elemento | Obra Nova | Voice Notes |
| --- | --- | --- |
| Botão amarelo único | Publicar orçamento | Gravar |
| Arroio (dado e progresso) | Medição e percentual | Forma de onda e barra de progresso da transcrição |
| Selo de atraso | Pagamento vencido | Transcrição que falhou |
| Mono tabular | Dinheiro e prazo | Duração e data |

Não introduzir cor nova. Se algo parecer precisar de uma, é sinal de que o
elemento está pedindo hierarquia que ele não tem.

---

## 9. Invariantes

- **A chave do provedor nunca chega ao cliente.**
- **O áudio vai para o armazenamento local antes de qualquer chamada de rede.**
- **O `prompt` do Whisper é sempre ASCII.**
- **O nome do arquivo enviado ao provedor sempre tem extensão reconhecida.**
- **O teto do `fetch` ao provedor fica abaixo do limite de execução da função.**
- **`texto_cru` e `texto_limpo` são gravados separados e nunca sobrescritos.**
- **O polimento nunca bloqueia a entrega da nota.**
- **A transcrição pronta é copiada para a área de transferência, e o usuário é
  avisado.**
- **Nada some da lista por estar em erro.**
- **A interface lê do banco local; nenhuma tela espera a rede para desenhar.**
- **Um único botão amarelo por tela.**
- **Excluir é reversível por 30 dias.**
- **O áudio é apagado aos 30 dias; o texto fica.**

---

## 10. Entregas

Ordem obrigatória. A Entrega 0 existe para você poder desistir barato.

### Entrega 0 — A prova de qualidade, sem produto
Uma página, sem banco, sem login, sem PWA: gravar, mandar para uma rota de
servidor com o código da seção 1.1, mostrar o texto na tela.
**Aceite:** ditar dez notas de verdade, do seu jeito de falar, e medir duas
coisas: o tempo entre soltar o botão e ver o texto, e quantas das dez você
mandaria sem corrigir nada. **Se menos de sete passarem sem correção, pare e
reavalie o projeto antes da Entrega 1.** Nenhuma tela bonita conserta
transcrição ruim.

### Entrega 1 — O ciclo completo, para um usuário
Auth por magic link, tabela `notas` com RLS, Storage, lista, tela de nota, editar,
excluir com desfazer, copiar automático da seção 3.1.
**Aceite:** ditar uma nota no celular, ela aparecer na lista já copiada, e você
colar no WhatsApp sem tocar em "copiar". Depois abrir a mesma nota no desktop,
editar, e ver a edição no celular.

### Entrega 2 — PWA e o corte de 3 minutos
Manifest, ícones maskable, service worker com precache do shell, atalho "nova
gravação" no ícone, limite e contagem regressiva da seção 3.2.
**Aceite:** instalar pela tela inicial do Android, abrir sem barra de navegador,
gravar. Segurar a gravação até 3:00 e confirmar que ela para sozinha e salva.

### Entrega 3 — Offline de verdade
Dexie, outbox, Realtime, estados `pendente` e `transcrevendo` visíveis na lista,
"tentar de novo" em `falhou`.
**Aceite:** ligar o modo avião, gravar três notas, desligar o modo avião e ver as
três transcreverem sozinhas, sem tocar em nada. Fechar o app no meio disso e
reabrir: as pendentes continuam.

### Entrega 4 — Polimento e vocabulário
Segundo passo de LLM, alternador original/limpo, tabela e tela de vocabulário.
**Aceite:** ditar uma nota com hesitação de propósito e ver o texto limpo sem os
"é" e "então", com o conteúdo intacto no alternador. Cadastrar três nomes
próprios que o Whisper errava e confirmar que ele passa a acertar.

### Entrega 5 — A rotina que apaga
Job diário: áudio com mais de 30 dias, notas excluídas há mais de 30 dias.
**Aceite:** rodar o job à mão com dados forjados e confirmar que o áudio sumiu,
`audio_caminho` está `null`, o texto continua lá, e a tela da nota diz que o
áudio expirou em vez de oferecer um play quebrado.

---

## 11. Fora de escopo

- Injeção de texto em outro app, teclado Android, extensão de navegador.
- Fatiamento de áudio longo e costura de transcrições.
- Transcrição ao vivo.
- Pastas, tags, busca semântica, resumo automático, extração de tarefas.
- Compartilhamento de nota com outra pessoa.
- Modo escuro.
- Multiusuário, planos, cobrança, cadastro público.
- Publicação em loja. É PWA, instala pelo navegador; foi decidido em 04/09/2026.
- **iOS como plataforma prometida.** Ver seção 12, risco 1. Pode funcionar; não é
  entrega.

---

## 12. Riscos

| Risco | Mitigação |
| --- | --- |
| **iOS.** Não tenho certeza do comportamento atual de `getUserMedia` e `MediaRecorder` em PWA instalado na tela de início do iOS; houve versões em que a permissão de microfone se comportava diferente entre Safari e PWA instalado. | Android e desktop são o alvo da v1. Testar iOS num aparelho real antes de qualquer promessa. Se quebrar, o app continua funcionando pelo Safari sem instalar. |
| **A fricção do colar.** É a diferença permanente para o Wispr Flow, e nenhum código a elimina. | O copiar automático da seção 3.1 reduz a diferença a um gesto. Teste isso na primeira semana de uso real, não no terceiro mês. Se ainda incomodar depois de um mês, o projeto certo era outro, e essa é uma conclusão válida. |
| **Gravação interrompida** por troca de app ou tela apagada. | Screen Wake Lock durante a gravação, e chunks parciais salvos no IndexedDB a cada poucos segundos, para que uma interrupção perca segundos e não a nota. A interface nunca promete gravação em segundo plano. |
| **Whisper erra nome próprio e jargão**, e a primeira semana frustra. | Vocabulário na Entrega 4, não no roadmap. Se a Entrega 0 mostrar que o erro é mais grave do que nomes próprios, trocar `whisper-large-v3-turbo` por `whisper-large-v3` e medir de novo antes de qualquer outra coisa. |
| **O polimento reescreve demais** e você deixa de confiar no app. | `texto_cru` sempre gravado, alternador na tela, polimento que nunca bloqueia. Se em um mês você usar mais o original que o limpo, o passo de polimento é peso morto e deve ser removido, não ajustado. |
| **Storage estoura em silêncio.** | Entrega 5. |
| **Escopo crescer para produto.** | Seções 2 e 11. |

---

## 13. Custo, e a razão de existir do projeto

Preços da documentação oficial da Groq, consultados em 30/08/2026:

| Modelo | Preço |
| --- | --- |
| `whisper-large-v3-turbo` | US$ 0,04 por hora de áudio |
| `whisper-large-v3` | US$ 0,111 por hora de áudio |

Trinta minutos de fala por dia, todos os dias, dá cerca de 15 horas por mês:
aproximadamente **US$ 0,60 por mês** de transcrição, mais centavos de polimento.
Supabase e Vercel cabem nos planos gratuitos nesse volume.

Detalhes que mudam decisão: o mínimo faturado é 10 segundos por requisição (nota
de 3s custa como 10s, irrelevante nesse volume); o limite de arquivo é 25 MB no
tier gratuito; o áudio é reamostrado para 16 kHz mono do lado deles, então gravar
em qualidade alta só desperdiça banda e tempo de upload. **Grave em bitrate
baixo de propósito.**

---

## 14. Instrumentação — sem código

Uma pergunta decide se o projeto valeu: **em quantos por cento das notas você
colou o texto sem editar nada?**

É mensurável sem tela nenhuma, com os dados que já existem: `texto_limpo`
comparado a `corpo` na tabela `notas`. Rode a consulta depois de um mês de uso.
Se o número for alto, o Voice Notes substituiu o Wispr Flow e a decisão está
tomada. Se for baixo, o gargalo é a qualidade da transcrição, e nenhuma feature
deste PRD ajuda: o caminho é trocar de modelo ou voltar a pagar.

**Não construa tela para isso.**

---

## 15. Antes de qualquer deploy

`npx tsc --noEmit` e `npm run build`.

Stack: Next.js App Router, TypeScript, Tailwind, Supabase (`@supabase/ssr`),
Dexie, deploy na Vercel.

Duas verificações que não são opcionais:

1. Buscar por `GROQ_API_KEY` no bundle do cliente antes de todo deploy. Uma vez
   vazada, a chave é rotacionada, não corrigida.
2. Testar num Android real, instalado pela tela inicial, não no simulador do
   DevTools. Permissão de microfone, `navigator.share` e `MediaRecorder` se
   comportam diferente ali, e é ali que o app vai viver.

*Ressalva:* não fixo aqui a biblioteca de service worker. Verifique a
compatibilidade da opção escolhida com a versão do Next antes de adotar; esse é
um ponto que quebra entre versões com frequência.

---

## Fontes

- Groq, speech-to-text: https://console.groq.com/docs/speech-to-text
- Groq, modelos e preços: https://console.groq.com/docs/models
- `obra-nova/src/lib/transcricao/provedor.ts`, verificado em 04/09/2026
- `obra-nova/src/app/globals.css`, design system implementado
