begin;

-- Keep the first link that a teacher may already have shared and close later
-- accidental duplicates before enforcing the invariant.
with ranked_assignments as (
  select id,
    row_number() over (
      partition by user_id, classroom_id, game_id
      order by assigned_at asc, created_at asc, id asc
    ) as duplicate_number
  from public.game_assignments
  where status = 'active'
)
update public.game_assignments assignment
set status = 'archived', updated_at = now()
from ranked_assignments ranked
where assignment.id = ranked.id
  and ranked.duplicate_number > 1;

create unique index if not exists game_assignments_one_active_game_per_class
  on public.game_assignments (user_id, classroom_id, game_id)
  where status = 'active';

commit;
