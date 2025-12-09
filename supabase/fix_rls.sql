-- 1단계: 기존 RLS 정책 모두 삭제
DROP POLICY IF EXISTS "teams_select_authenticated" ON teams;
DROP POLICY IF EXISTS "teams_insert_super_admin" ON teams;
DROP POLICY IF EXISTS "teams_update_super_admin" ON teams;
DROP POLICY IF EXISTS "teams_delete_super_admin" ON teams;

DROP POLICY IF EXISTS "users_select_self" ON users;
DROP POLICY IF EXISTS "users_select_super_admin" ON users;
DROP POLICY IF EXISTS "users_insert_public" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;
DROP POLICY IF EXISTS "users_update_super_admin" ON users;
DROP POLICY IF EXISTS "users_delete_super_admin" ON users;

DROP POLICY IF EXISTS "zone_leaders_select_same_team" ON zone_leaders;
DROP POLICY IF EXISTS "zone_leaders_select_admin_pastor" ON zone_leaders;
DROP POLICY IF EXISTS "zone_leaders_insert_team_leader" ON zone_leaders;
DROP POLICY IF EXISTS "zone_leaders_update_team_leader" ON zone_leaders;
DROP POLICY IF EXISTS "zone_leaders_delete_team_leader" ON zone_leaders;

DROP POLICY IF EXISTS "members_select_same_team" ON members;
DROP POLICY IF EXISTS "members_select_admin_pastor" ON members;
DROP POLICY IF EXISTS "members_insert_team_leader" ON members;
DROP POLICY IF EXISTS "members_update_team_leader" ON members;
DROP POLICY IF EXISTS "members_delete_team_leader" ON members;

DROP POLICY IF EXISTS "referrals_select_same_team" ON referrals;
DROP POLICY IF EXISTS "referrals_select_admin_pastor" ON referrals;
DROP POLICY IF EXISTS "referrals_insert_team_leader" ON referrals;

DROP POLICY IF EXISTS "attendance_select_same_team" ON attendance_records;
DROP POLICY IF EXISTS "attendance_select_admin_pastor" ON attendance_records;
DROP POLICY IF EXISTS "attendance_insert_team_leader" ON attendance_records;
DROP POLICY IF EXISTS "attendance_update_team_leader" ON attendance_records;

DROP POLICY IF EXISTS "points_select_same_team" ON points;
DROP POLICY IF EXISTS "points_select_admin_pastor" ON points;
DROP POLICY IF EXISTS "points_insert_service_role" ON points;
DROP POLICY IF EXISTS "points_insert_authenticated" ON points;

DROP POLICY IF EXISTS "devices_select_self" ON devices;
DROP POLICY IF EXISTS "devices_insert_self" ON devices;
DROP POLICY IF EXISTS "devices_update_self" ON devices;
DROP POLICY IF EXISTS "devices_delete_self" ON devices;

-- 2단계: 새 RLS 정책 적용
-- Teams 테이블
CREATE POLICY "teams_select_all" ON teams
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "teams_insert_super_admin" ON teams
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'super-admin');

CREATE POLICY "teams_update_super_admin" ON teams
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'super-admin');

CREATE POLICY "teams_delete_super_admin" ON teams
  FOR DELETE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'super-admin');

-- Users 테이블
CREATE POLICY "users_select_for_login" ON users
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "users_insert_public" ON users
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "users_update_self" ON users
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "users_update_super_admin" ON users
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'super-admin');

CREATE POLICY "users_delete_super_admin" ON users
  FOR DELETE TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'super-admin');

-- Zone Leaders 테이블
CREATE POLICY "zone_leaders_select_all" ON zone_leaders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "zone_leaders_insert_team_leader" ON zone_leaders
  FOR INSERT TO authenticated
  WITH CHECK (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

CREATE POLICY "zone_leaders_update_team_leader" ON zone_leaders
  FOR UPDATE TO authenticated
  USING (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

CREATE POLICY "zone_leaders_delete_team_leader" ON zone_leaders
  FOR DELETE TO authenticated
  USING (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

-- Members 테이블
CREATE POLICY "members_select_all" ON members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "members_insert_team_leader" ON members
  FOR INSERT TO authenticated
  WITH CHECK (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

CREATE POLICY "members_update_team_leader" ON members
  FOR UPDATE TO authenticated
  USING (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

CREATE POLICY "members_delete_team_leader" ON members
  FOR DELETE TO authenticated
  USING (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

-- Referrals 테이블
CREATE POLICY "referrals_select_all" ON referrals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "referrals_insert_team_leader" ON referrals
  FOR INSERT TO authenticated
  WITH CHECK (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

-- Attendance Records 테이블
CREATE POLICY "attendance_select_all" ON attendance_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "attendance_insert_team_leader" ON attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

CREATE POLICY "attendance_update_team_leader" ON attendance_records
  FOR UPDATE TO authenticated
  USING (team_id = (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'team-leader' AND approved = true));

-- Points 테이블
CREATE POLICY "points_select_all" ON points
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "points_insert_authenticated" ON points
  FOR INSERT TO authenticated WITH CHECK (true);

-- Devices 테이블
CREATE POLICY "devices_all_self" ON devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
