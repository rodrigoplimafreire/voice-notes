-- Entrega 1 do PRD: a tabela de dominio, com RLS por user_id desde o primeiro
-- dia. Um usuario so; a RLS existe para deixar a porta aberta sem custo, nao
-- porque haja um segundo usuario previsto.
--
-- Tres colunas de texto, de proposito: `corpo` e o documento vivo, o unico que
-- o usuario edita; `texto_cru` e `texto_limpo` sao registro historico e nunca
-- mudam depois de escritos. Sem essa separacao nao ha como responder "isso eu
-- falei ou o polimento inventou?".
--
-- `texto_limpo` fica nulo ate a Entrega 4, quando o polimento existir.

create table notas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  titulo        text,
  corpo         text not null default '',
  texto_cru     text,
  texto_limpo   text,
  origem        text not null default 'voz'
                check (origem in ('voz','manual')),
  estado        text not null default 'pendente'
                check (estado in ('pendente','transcrevendo','pronta','falhou')),
  erro          text,
  audio_caminho text,
  duracao_ms    integer,
  modelo        text,
  provedor      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

alter table notas enable row level security;

create policy notas_proprias on notas for all
  to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index notas_usuario_data on notas (user_id, atualizado_em desc)
  where excluido_em is null;

create index notas_busca on notas
  using gin (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || corpo));

-- `atualizado_em` e a chave do last write wins da Entrega 3. Se ela depender do
-- cliente lembrar de mandar, um dia ele esquece e a ordem da lista mente.
create or replace function tocar_atualizado_em()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger notas_atualizado_em
  before update on notas
  for each row execute function tocar_atualizado_em();
