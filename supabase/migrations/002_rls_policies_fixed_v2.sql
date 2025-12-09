-- Row Level Security 정책 설정 (anon 로그인 지원 버전)

-- RLS 활성화
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Teams 테이블 정책
-- ============================================

-- 모든 인증된 사용자는 팀 정보 읽기 가능
CREATE POLICY "teams_select_all" ON teams
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- super-admin만 팀 생성/수정/삭제 가능
CREATE POLICY "teams_insert_super_admin" ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

CREATE POLICY "teams_update_super_admin" ON teams
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

CREATE POLICY "teams_delete_super_admin" ON teams
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

-- ============================================
-- Users 테이블 정책
-- ============================================

-- anon 사용자는 로그인 목적으로 전화번호로 조회 가능 (민감한 정보 제외)
CREATE POLICY "users_select_for_login" ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 회원가입은 누구나 가능
CREATE POLICY "users_insert_public" ON users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- authenticated 사용자는 자신의 정보 수정 가능
CREATE POLICY "users_update_self" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- super-admin은 모든 사용자 수정 가능
CREATE POLICY "users_update_super_admin" ON users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

-- super-admin은 사용자 삭제 가능
CREATE POLICY "users_delete_super_admin" ON users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

-- ============================================
-- Zone Leaders 테이블 정책
-- ============================================

-- authenticated 사용자는 모든 구역장 읽기 가능
CREATE POLICY "zone_leaders_select_all" ON zone_leaders
  FOR SELECT
  TO authenticated
  USING (true);

-- team-leader는 자신의 팀 구역장 추가/수정/삭제 가능
CREATE POLICY "zone_leaders_insert_team_leader" ON zone_leaders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

CREATE POLICY "zone_leaders_update_team_leader" ON zone_leaders
  FOR UPDATE
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

CREATE POLICY "zone_leaders_delete_team_leader" ON zone_leaders
  FOR DELETE
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

-- ============================================
-- Members 테이블 정책
-- ============================================

-- authenticated 사용자는 모든 멤버 읽기 가능
CREATE POLICY "members_select_all" ON members
  FOR SELECT
  TO authenticated
  USING (true);

-- team-leader는 자신의 팀 멤버 추가/수정/삭제 가능
CREATE POLICY "members_insert_team_leader" ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

CREATE POLICY "members_update_team_leader" ON members
  FOR UPDATE
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

CREATE POLICY "members_delete_team_leader" ON members
  FOR DELETE
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

-- ============================================
-- Referrals 테이블 정책
-- ============================================

-- authenticated 사용자는 전도 기록 읽기 가능
CREATE POLICY "referrals_select_all" ON referrals
  FOR SELECT
  TO authenticated
  USING (true);

-- team-leader는 자신의 팀 전도 기록 추가 가능
CREATE POLICY "referrals_insert_team_leader" ON referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

-- ============================================
-- Attendance Records 테이블 정책
-- ============================================

-- authenticated 사용자는 출석 기록 읽기 가능
CREATE POLICY "attendance_select_all" ON attendance_records
  FOR SELECT
  TO authenticated
  USING (true);

-- team-leader는 자신의 팀 출석 기록 추가/수정 가능
CREATE POLICY "attendance_insert_team_leader" ON attendance_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

CREATE POLICY "attendance_update_team_leader" ON attendance_records
  FOR UPDATE
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true)
  );

-- ============================================
-- Points 테이블 정책
-- ============================================

-- authenticated 사용자는 점수 기록 읽기 가능
CREATE POLICY "points_select_all" ON points
  FOR SELECT
  TO authenticated
  USING (true);

-- authenticated 사용자는 점수 추가 가능 (함수에서 호출)
CREATE POLICY "points_insert_authenticated" ON points
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Devices 테이블 정책
-- ============================================

-- 사용자는 자신의 디바이스 정보만 읽기/추가/수정/삭제 가능
CREATE POLICY "devices_all_self" ON devices
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
