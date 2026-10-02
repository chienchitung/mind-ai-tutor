-- Restores the original six-step Excel Master learning map after the
-- data-driven game-engine migration.
--
-- Run once in the Supabase SQL editor after add_public_game_manifest.sql.
-- The script is idempotent: running it again reuses the same intro lesson,
-- preserves unrelated game settings, and does not duplicate lesson ids.

do $$
declare
  target_game record;
  intro_lesson_id uuid;
  ordered_lesson_ids text[];
  lesson_item record;
  lesson_summary text;
  lesson_role text;
  lesson_number integer;
  lesson_overrides jsonb;
  base_settings jsonb;
  lesson_ids_udt text;
begin
  select c.udt_name
    into lesson_ids_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'digital_games'
    and c.column_name = 'lesson_ids';

  for target_game in
    select g.id, g.user_id, g.lesson_ids, g.settings
    from public.digital_games g
    where lower(regexp_replace(trim(g.title), '\s+', '', 'g')) = 'excelmaster'
  loop
    select l.id
      into intro_lesson_id
    from public.lessons l
    where l.user_id = target_game.user_id
      and l.title = '前導課程：Excel 基本觀念'
    order by l.created_at nulls last
    limit 1;

    if intro_lesson_id is null then
      insert into public.lessons (
        user_id,
        title,
        description,
        duration,
        level,
        topics,
        teaching_content,
        markdown_content,
        practice_exercises,
        metadata
      ) values (
        target_game.user_id,
        '前導課程：Excel 基本觀念',
        '認識 Excel 的介面、儲存格概念與常見操作，建立學習基礎',
        10,
        'Beginner',
        to_jsonb(array['Excel 基礎', '儲存格', '公式入門']),
        '認識 Excel 的介面、工作簿、工作表、儲存格與常見操作，並了解所有公式都以等號開始。',
        E'# 開始之前：打好 Excel 基礎\n\n在進入挑戰關卡前，先建立 Excel 的基本觀念。\n\n## 介面與核心概念\n\n- 工作簿（Workbook）與工作表（Sheet）\n- 儲存格（Cell）與儲存格參照（如 A1、B2）\n- 相對參照與絕對參照：A1 與 $A$1\n- 常見資料型態：數值、文字、日期\n\n## 常見操作\n\n- 快速輸入與自動填滿\n- 格式化數值\n- 排序與篩選\n- 建立簡易圖表\n\n## 公式入門\n\n所有公式都以等號（=）開頭。接下來會從 SUM、AVERAGE 學到 IF、VLOOKUP 與樞紐分析表。',
        jsonb_build_array(jsonb_build_object(
          'question', 'Excel 公式通常以哪一個符號開始？',
          'answer', '=',
          'explanation', 'Excel 公式必須以等號（=）開始。'
        )),
        jsonb_build_object(
          'card_description', '認識 Excel 的介面、儲存格概念與常見操作，建立學習基礎',
          'game_number', 0,
          'game_role', 'intro'
        )
      )
      returning id into intro_lesson_id;
    end if;

    select array_prepend(
      intro_lesson_id::text,
      coalesce(array_agg(existing_id order by position)
        filter (where existing_id <> intro_lesson_id::text), array[]::text[])
    )
      into ordered_lesson_ids
    from jsonb_array_elements_text(coalesce(to_jsonb(target_game.lesson_ids), '[]'::jsonb))
      with ordinality as current_lessons(existing_id, position);

    base_settings := case
      when jsonb_typeof(coalesce(target_game.settings, '{}'::jsonb)) = 'object'
        then coalesce(target_game.settings, '{}'::jsonb)
      else '{}'::jsonb
    end;
    lesson_overrides := case
      when jsonb_typeof(base_settings -> 'lessonOverrides') = 'object'
        then base_settings -> 'lessonOverrides'
      else '{}'::jsonb
    end;

    for lesson_item in
      select l.id, l.title, l.description, ordered.position
      from unnest(ordered_lesson_ids) with ordinality as ordered(lesson_id, position)
      join public.lessons l
        on l.id::text = ordered.lesson_id
       and l.user_id = target_game.user_id
      order by ordered.position
    loop
      lesson_number := lesson_item.position - 1;
      lesson_role := case
        when lesson_item.id = intro_lesson_id then 'intro'
        when lesson_item.position = cardinality(ordered_lesson_ids) then 'final'
        else 'standard'
      end;
      lesson_summary := case
        when lesson_item.id = intro_lesson_id
          then '認識 Excel 的介面、儲存格概念與常見操作，建立學習基礎'
        when lesson_item.title ilike '%基礎%函數%' or lesson_item.title ilike '%基本%函數%'
          then '學習 Excel 中最基本的 SUM、AVERAGE、COUNT 等函數'
        when lesson_item.title ilike '%IF%'
          then '學習使用 IF 函數進行條件判斷'
        when lesson_item.title ilike '%樞紐%'
          then '學習創建和使用樞紐分析表'
        when lesson_item.title ilike '%VLOOKUP%'
          then '掌握 VLOOKUP 函數的使用方法'
        when lesson_item.title ilike '%綜合%' or lesson_item.title ilike '%測驗%'
          then '測試您對所有 Excel 函數的掌握程度'
        else left(regexp_replace(coalesce(lesson_item.description, ''), '\s+', ' ', 'g'), 120)
      end;

      update public.lessons l
      set description = lesson_summary,
          metadata = (
            case
              when jsonb_typeof(coalesce(l.metadata, '{}'::jsonb)) = 'object'
                then coalesce(l.metadata, '{}'::jsonb)
              else '{}'::jsonb
            end
          ) || jsonb_build_object(
            'card_description', lesson_summary,
            'game_number', lesson_number,
            'game_role', lesson_role
          )
      where l.id = lesson_item.id
        and l.user_id = target_game.user_id;

      lesson_overrides := lesson_overrides || jsonb_build_object(
        lesson_item.id::text,
        jsonb_build_object(
          'number', lesson_number,
          'role', lesson_role,
          'cardDescription', lesson_summary
        )
      );
    end loop;

    base_settings := (base_settings - 'lessonOverrides') || jsonb_build_object(
      'lessonOverrides', lesson_overrides
    );

    if lesson_ids_udt = '_uuid' then
      execute 'update public.digital_games set lesson_ids = $1::uuid[], settings = $2 where id = $3'
        using ordered_lesson_ids, base_settings, target_game.id;
    elsif lesson_ids_udt = 'jsonb' then
      execute 'update public.digital_games set lesson_ids = to_jsonb($1::text[]), settings = $2 where id = $3'
        using ordered_lesson_ids, base_settings, target_game.id;
    else
      execute 'update public.digital_games set lesson_ids = $1::text[], settings = $2 where id = $3'
        using ordered_lesson_ids, base_settings, target_game.id;
    end if;
  end loop;
end $$;

-- Verify the restored manifest. Excel Master should now report six lessons,
-- numbered 0 through 5, with intro and final roles.
select
  g.id,
  g.title,
  jsonb_array_length(to_jsonb(g.lesson_ids)) as lesson_count,
  g.settings -> 'lessonOverrides' as lesson_overrides
from public.digital_games g
where lower(regexp_replace(trim(g.title), '\s+', '', 'g')) = 'excelmaster';
