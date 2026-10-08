-- Le seau des sauvegardes (JSON et médias), et les règles qui le cloisonnent.
--
-- À jouer UNE FOIS dans le SQL Editor du projet Supabase. Le script est
-- rejouable : il ne recrée rien de ce qui existe déjà.
--
-- Pourquoi du SQL et pas un clic : ces politiques SONT la sécurité. Un client
-- mobile se décompile, sa clé publishable se lit, et rien n'empêche quelqu'un
-- de s'inscrire puis d'appeler l'API avec un chemin qui n'est pas le sien.
-- Ce qui l'en empêche, c'est Postgres. Versionner ces règles, c'est pouvoir
-- les relire -- et constater qu'elles disent ce qu'on croit.

-- 1. Le seau. PRIVÉ : une sauvegarde contient tout l'historique et les médias
--    d'entraînement, et un seau public se lit sans aucun jeton.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- 2. Les politiques, une par opération.
--
--    Le premier segment du chemin est l'identifiant du compte
--    (`<uid>/2026-09-19T21-30-00-000Z.json` et `<uid>/media/<uuid>.mp4`),
--    et chaque règle exige qu'il
--    corresponde au porteur du jeton. `auth.jwt() ->> 'sub'` est cet
--    identifiant, tel que Supabase le documente.
--
--    Les quatre opérations sont nécessaires : lister et lire (select),
--    déposer (insert), remplacer (update, qu'un envoi en écrasement
--    solliciterait), et faire le ménage des générations (delete).

drop policy if exists "backups: lire les siennes" on storage.objects;
create policy "backups: lire les siennes"
on storage.objects for select to authenticated
using (
  bucket_id = 'backups'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "backups: deposer les siennes" on storage.objects;
create policy "backups: deposer les siennes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'backups'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "backups: remplacer les siennes" on storage.objects;
create policy "backups: remplacer les siennes"
on storage.objects for update to authenticated
using (
  bucket_id = 'backups'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
)
with check (
  bucket_id = 'backups'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "backups: effacer les siennes" on storage.objects;
create policy "backups: effacer les siennes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'backups'
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

-- 3. De quoi vérifier, plutôt que d'espérer.
--    Doit rendre les quatre politiques ci-dessus, et le seau en `public = false`.
select name, public from storage.buckets where id = 'backups';
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'backups:%'
order by policyname;
