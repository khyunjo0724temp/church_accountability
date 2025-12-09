-- 모든 데이터 삭제

DELETE FROM points;
DELETE FROM attendance_records;
DELETE FROM referrals;
DELETE FROM members;
DELETE FROM zone_leaders;
DELETE FROM users;
DELETE FROM teams;
DELETE FROM devices;

SELECT '모든 데이터가 삭제되었습니다.' as message;
