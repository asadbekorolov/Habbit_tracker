-- reset_all_data va send_global_notification funksiyalarining haqiqiy tanasini olish
SELECT p.proname AS function_name, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('reset_all_data', 'send_global_notification', 'toggle_user_ban');
