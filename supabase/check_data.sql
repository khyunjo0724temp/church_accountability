-- 데이터베이스 확인 쿼리

-- 1. 팀 확인
SELECT 'Teams:' as table_name, COUNT(*) as count FROM teams;
SELECT * FROM teams;

-- 2. 사용자 확인
SELECT 'Users:' as table_name, COUNT(*) as count FROM users;
SELECT id, name, phone, role, team_id, approved FROM users;

-- 3. 구역장 확인
SELECT 'Zone Leaders:' as table_name, COUNT(*) as count FROM zone_leaders;
SELECT * FROM zone_leaders LIMIT 5;

-- 4. 멤버 확인
SELECT 'Members:' as table_name, COUNT(*) as count FROM members;
SELECT * FROM members LIMIT 10;

-- 5. 김팀장의 team_id로 멤버 조회
SELECT m.*, zl.name as zone_leader_name
FROM members m
LEFT JOIN zone_leaders zl ON m.zone_leader_id = zl.id
WHERE m.team_id = '550e8400-e29b-41d4-a716-446655440001'
LIMIT 10;
