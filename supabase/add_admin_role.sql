-- users 테이블의 role constraint에 admin 추가

-- 기존 constraint 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 새로운 constraint 추가 (admin 포함)
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'team-leader', 'zone-leader', 'pastor'));

-- 확인 메시지
SELECT 'admin role이 추가되었습니다.' as message;
