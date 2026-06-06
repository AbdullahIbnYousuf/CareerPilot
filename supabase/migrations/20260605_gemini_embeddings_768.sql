-- Switch CV vector search from legacy 1024-dimension embeddings to
-- 768-dimension Gemini embedding-001 embeddings.
--
-- Existing chunk embeddings cannot be converted safely across providers, so
-- they are cleared and regenerated when users re-upload their CVs.

begin;

drop function if exists hybrid_search(vector, text, integer, uuid, text);
drop index if exists cv_chunks_embedding_idx;

delete from cv_chunks;

alter table cv_chunks
  alter column embedding type vector(768)
  using null::vector(768);

create index cv_chunks_embedding_idx on cv_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function hybrid_search(
  query_embedding vector(768),
  query_text text,
  match_count int,
  p_user_id uuid,
  p_section text default null
)
returns table (id uuid, content text, section text, score float)
language sql
as $$
  with semantic as (
    select
      cv_chunks.id,
      cv_chunks.content,
      cv_chunks.section,
      row_number() over (order by cv_chunks.embedding <=> query_embedding) as rank
    from cv_chunks
    where cv_chunks.user_id = p_user_id
      and (p_section is null or cv_chunks.section = p_section)
      and cv_chunks.embedding is not null
    order by cv_chunks.embedding <=> query_embedding
    limit 20
  ),
  keyword as (
    select
      cv_chunks.id,
      cv_chunks.content,
      cv_chunks.section,
      row_number() over (
        order by ts_rank(cv_chunks.fts, plainto_tsquery('english', query_text)) desc
      ) as rank
    from cv_chunks
    where cv_chunks.user_id = p_user_id
      and (p_section is null or cv_chunks.section = p_section)
      and cv_chunks.fts @@ plainto_tsquery('english', query_text)
    limit 20
  ),
  rrf as (
    select
      coalesce(s.id, k.id) as id,
      coalesce(s.content, k.content) as content,
      coalesce(s.section, k.section) as section,
      coalesce(1.0 / (60 + s.rank), 0.0) + coalesce(1.0 / (60 + k.rank), 0.0) as score
    from semantic s
    full outer join keyword k on s.id = k.id
  )
  select rrf.id, rrf.content, rrf.section, rrf.score
  from rrf
  order by rrf.score desc
  limit match_count;
$$;

commit;
