-- Row Level Security 정책 설정 (Supabase 호환 버전)

-- RLS 활성화
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수 (public 스키마에 생성)
CREATE OR REPLACE FUNCTION public.get_my_user_id() RETURNS UUID AS $$
  SELECT id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_team_id() RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_approved() RETURNS BOOLEAN AS $$
  SELECT approved FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- Teams 테이블 정책
-- ============================================

-- 모든 인증된 사용자는 팀 정보 읽기 가능
CREATE POLICY "teams_select_authenticated" ON teams
  FOR SELECT
  TO authenticated
  USING (true);

-- super-admin만 팀 생성 가능
CREATE POLICY "teams_insert_super_admin" ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

-- super-admin만 팀 수정/삭제 가능
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

-- 사용자는 자신의 정보 읽기 가능
CREATE POLICY "users_select_self" ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- super-admin은 모든 사용자 정보 읽기 가능
CREATE POLICY "users_select_super_admin" ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'super-admin'
  );

-- 회원가입은 누구나 가능 (anon)
CREATE POLICY "users_insert_public" ON users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 사용자는 자신의 정보 수정 가능
CREATE POLICY "users_update_self" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- super-admin은 모든 사용자 수정 가능 (승인 등)
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

-- 같은 팀의 사용자는 구역장 목록 읽기 가능
CREATE POLICY "zone_leaders_select_same_team" ON zone_leaders
  FOR SELECT
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- pastor와 super-admin은 모든 구역장 읽기 가능
CREATE POLICY "zone_leaders_select_admin_pastor" ON zone_leaders
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super-admin', 'pastor')
  );

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

-- 같은 팀의 사용자는 멤버 목록 읽기 가능
CREATE POLICY "members_select_same_team" ON members
  FOR SELECT
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- pastor와 super-admin은 모든 멤버 읽기 가능
CREATE POLICY "members_select_admin_pastor" ON members
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super-admin', 'pastor')
  );

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

-- 같은 팀의 사용자는 전도 기록 읽기 가능
CREATE POLICY "referrals_select_same_team" ON referrals
  FOR SELECT
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- pastor와 super-admin은 모든 전도 기록 읽기 가능
CREATE POLICY "referrals_select_admin_pastor" ON referrals
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super-admin', 'pastor')
  );

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

-- 같은 팀의 사용자는 출석 기록 읽기 가능
CREATE POLICY "attendance_select_same_team" ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- pastor와 super-admin은 모든 출석 기록 읽기 가능
CREATE POLICY "attendance_select_admin_pastor" ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super-admin', 'pastor')
  );

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

-- 같은 팀의 사용자는 점수 기록 읽기 가능
CREATE POLICY "points_select_same_team" ON points
  FOR SELECT
  TO authenticated
  USING (
    team_id = (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- pastor와 super-admin은 모든 점수 기록 읽기 가능
CREATE POLICY "points_select_admin_pastor" ON points
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('super-admin', 'pastor')
  );

-- 인증된 사용자도 점수 추가 가능 (함수에서 호출)
CREATE POLICY "points_insert_authenticated" ON points
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Devices 테이블 정책
-- ============================================

-- 사용자는 자신의 디바이스 정보 읽기 가능
CREATE POLICY "devices_select_self" ON devices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 사용자는 자신의 디바이스 추가 가능
CREATE POLICY "devices_insert_self" ON devices
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 사용자는 자신의 디바이스 수정 가능
CREATE POLICY "devices_update_self" ON devices
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- 사용자는 자신의 디바이스 삭제 가능
CREATE POLICY "devices_delete_self" ON devices
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
