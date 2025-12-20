-- 같은 팀에서 같은 이름을 가진 멤버들 찾기
SELECT 
  team_id,
  name,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as member_ids
FROM members
GROUP BY team_id, name
HAVING COUNT(*) > 1
ORDER BY team_id, name;
