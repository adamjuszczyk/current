-- Current V2 — the pre-v2 restore point, as a migration of its own.
--
-- WHY THIS IS A SEPARATE FILE. The snapshot was originally written into
-- 0002_v2.sql, but 0002 had already been applied to the live project by
-- then. Editing an applied migration is how a repo and a database quietly
-- stop matching: the file says one thing, the database contains another,
-- and nothing warns you. 0002 is therefore restored to exactly what ran,
-- and the snapshot lives here instead.
--
-- WHAT IT CAPTURES. tasks.block_id no longer exists as a column — 0002
-- dropped it — but the mapping it held is fully derivable through
-- lists.block_id, because 0002 gave every block with tasks exactly one
-- flat list. So v1_backup.tasks below reproduces precisely what a
-- pre-0002 snapshot would have contained.
--
-- WHY NOT public. A table in public without RLS is served by PostgREST to
-- anyone holding the anon key, and that key ships publicly in the client
-- bundle — a snapshot of every task placed there would be readable by a
-- stranger. PostgREST exposes only public, so v1_backup is unreachable
-- through the API; the revokes are the second layer.
--
-- Safe to re-run: every create is guarded.

create schema if not exists v1_backup;
revoke all on schema v1_backup from anon, authenticated;

create table if not exists v1_backup.areas  as select * from areas;
create table if not exists v1_backup.blocks as select * from blocks;
create table if not exists v1_backup.notes  as select * from notes;
create table if not exists v1_backup.lists  as select * from lists;

-- tasks in their pre-migration v1 shape, block_id and all
create table if not exists v1_backup.tasks as
  select t.id, l.block_id, t.text, t.completed, t.created_at
  from tasks t join lists l on l.id = t.list_id;

revoke all on all tables in schema v1_backup from anon, authenticated;
