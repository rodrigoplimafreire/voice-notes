-- Bucket privado. O caminho e sempre {user_id}/{id}.{ext}, e as politicas
-- amarram a primeira pasta ao dono: sem isso, uma URL adivinhada le o audio de
-- outra pessoa no dia em que existir outra pessoa.
--
-- O audio e apagado aos 30 dias pela rotina da Entrega 5. Aqui so nasce o
-- lugar onde ele mora enquanto existe.

insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', false, 26214400)
on conflict (id) do nothing;

create policy audio_proprio_ler on storage.objects for select
  to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy audio_proprio_subir on storage.objects for insert
  to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy audio_proprio_trocar on storage.objects for update
  to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy audio_proprio_apagar on storage.objects for delete
  to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
