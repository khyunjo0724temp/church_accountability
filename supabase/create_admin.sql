-- 관리자 계정 생성

INSERT INTO users (id, name, phone, pin_hash, role, team_id, approved) VALUES
('550e8400-e29b-41d4-a716-446655440000', '슈퍼관리자', 'admin', 'jojojo0724', 'admin', NULL, true);

SELECT '관리자 계정이 생성되었습니다.' as message;
SELECT '로그인 페이지: http://localhost:5173/super-login' as login_url;
SELECT 'Username: admin' as username;
SELECT 'Password: jojojo0724' as password;
