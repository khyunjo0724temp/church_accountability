-- 교회 출석 및 전도 관리 시스템 데이터베이스 스키마

-- 1. Teams 테이블 (팀 정보)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users 테이블 (사용자 정보 - 로그인 계정)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  pin_hash VARCHAR(255) NOT NULL, -- bcrypt 해시
  role VARCHAR(20) NOT NULL CHECK (role IN ('super-admin', 'team-leader', 'zone-leader', 'pastor', 'member')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  approved BOOLEAN DEFAULT FALSE, -- 팀장은 승인 필요
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Zone Leaders 테이블 (구역장 정보)
CREATE TABLE zone_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- 4. Members 테이블 (팀원 정보)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  is_newbie BOOLEAN DEFAULT FALSE, -- 새신자 여부
  zone_leader_id UUID REFERENCES zone_leaders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Referrals 테이블 (전도 관계)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  referrer_id UUID, -- member_id 또는 zone_leader의 연결된 member
  referrer_type VARCHAR(20) CHECK (referrer_type IN ('member', 'zone-leader', 'external')),
  depth INT DEFAULT 1 CHECK (depth IN (1, 2)), -- 전도 깊이
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Attendance Records 테이블 (출석 기록)
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- 해당 주의 일요일 날짜
  present BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, week_start_date) -- 같은 멤버가 같은 주에 중복 기록 방지
);

-- 7. Points 테이블 (점수 기록)
CREATE TABLE points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- 팀장, 구역장 등
  member_id UUID REFERENCES members(id) ON DELETE SET NULL, -- 일반 멤버
  zone_leader_id UUID REFERENCES zone_leaders(id) ON DELETE SET NULL, -- 구역장
  points INT NOT NULL,
  reason VARCHAR(50) NOT NULL, -- 'newbie_attendance', 'referral', 'referral_chain' 등
  week_start_date DATE, -- 주간 점수인 경우
  date DATE DEFAULT CURRENT_DATE,
  metadata JSONB, -- 추가 정보 (예: referral_id, attendance_id 등)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Devices 테이블 (기기 정보 - 자동 로그인용)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- 인덱스 생성
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_members_team_id ON members(team_id);
CREATE INDEX idx_members_zone_leader_id ON members(zone_leader_id);
CREATE INDEX idx_members_is_newbie ON members(is_newbie);
CREATE INDEX idx_attendance_team_id ON attendance_records(team_id);
CREATE INDEX idx_attendance_week ON attendance_records(week_start_date);
CREATE INDEX idx_attendance_member_week ON attendance_records(member_id, week_start_date);
CREATE INDEX idx_referrals_team_id ON referrals(team_id);
CREATE INDEX idx_referrals_new_member ON referrals(new_member_id);
CREATE INDEX idx_points_team_id ON points(team_id);
CREATE INDEX idx_points_week ON points(week_start_date);
CREATE INDEX idx_points_user_id ON points(user_id);
CREATE INDEX idx_points_member_id ON points(member_id);
CREATE INDEX idx_points_zone_leader_id ON points(zone_leader_id);

-- Updated_at 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at 트리거 적용
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zone_leaders_updated_at BEFORE UPDATE ON zone_leaders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE teams IS '팀 정보';
COMMENT ON TABLE users IS '사용자 계정 정보 (로그인)';
COMMENT ON TABLE zone_leaders IS '구역장 정보';
COMMENT ON TABLE members IS '팀원 정보';
COMMENT ON TABLE referrals IS '전도 관계 기록';
COMMENT ON TABLE attendance_records IS '출석 기록';
COMMENT ON TABLE points IS '점수 기록';
COMMENT ON TABLE devices IS '자동 로그인용 기기 정보';
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
-- 점수 계산 로직 함수들

-- ============================================
-- 1. 새신자 출석 점수 계산 함수
-- ============================================
CREATE OR REPLACE FUNCTION calculate_newbie_attendance_points(
  p_team_id UUID,
  p_member_id UUID,
  p_week_start_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
  v_points_added JSONB := '[]'::JSONB;
BEGIN
  -- 멤버 정보 조회
  SELECT * INTO v_member FROM members WHERE id = p_member_id;

  -- 새신자가 아니면 점수 부여 안 함
  IF NOT v_member.is_newbie THEN
    RETURN v_points_added;
  END IF;

  -- 새신자 본인에게 +1점
  INSERT INTO points (team_id, member_id, points, reason, week_start_date, date, metadata)
  VALUES (
    p_team_id,
    p_member_id,
    1,
    'newbie_attendance',
    p_week_start_date,
    CURRENT_DATE,
    jsonb_build_object('member_id', p_member_id, 'week', p_week_start_date)
  );

  v_points_added := v_points_added || jsonb_build_object(
    'member_id', p_member_id,
    'member_name', v_member.name,
    'points', 1,
    'reason', 'newbie_attendance'
  );

  RETURN v_points_added;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. 전도 점수 계산 함수
-- ============================================
CREATE OR REPLACE FUNCTION calculate_referral_points(
  p_team_id UUID,
  p_new_member_id UUID,
  p_referrer_id UUID,
  p_referrer_type VARCHAR(20),
  p_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_referrer RECORD;
  v_zone_leader RECORD;
  v_team_leader RECORD;
  v_points_added JSONB := '[]'::JSONB;
BEGIN
  -- 전도자 타입별 점수 부여
  IF p_referrer_type = 'zone-leader' THEN
    -- 구역장이 전도한 경우: 구역장 +1, 팀장 +1

    -- 구역장 정보 조회
    SELECT * INTO v_zone_leader FROM zone_leaders WHERE id = p_referrer_id;

    -- 구역장에게 +1점
    INSERT INTO points (team_id, zone_leader_id, points, reason, date, metadata)
    VALUES (
      p_team_id,
      p_referrer_id,
      1,
      'referral_by_zone_leader',
      p_date,
      jsonb_build_object('new_member_id', p_new_member_id, 'depth', 1)
    );

    v_points_added := v_points_added || jsonb_build_object(
      'zone_leader_id', p_referrer_id,
      'zone_leader_name', v_zone_leader.name,
      'points', 1,
      'reason', 'referral_by_zone_leader'
    );

    -- 팀장에게 +1점
    SELECT * INTO v_team_leader FROM users WHERE team_id = p_team_id AND role = 'team-leader' LIMIT 1;
    IF FOUND THEN
      INSERT INTO points (team_id, user_id, points, reason, date, metadata)
      VALUES (
        p_team_id,
        v_team_leader.id,
        1,
        'referral_bonus_team_leader',
        p_date,
        jsonb_build_object('new_member_id', p_new_member_id, 'zone_leader_id', p_referrer_id, 'depth', 2)
      );

      v_points_added := v_points_added || jsonb_build_object(
        'user_id', v_team_leader.id,
        'user_name', v_team_leader.name,
        'points', 1,
        'reason', 'referral_bonus_team_leader'
      );
    END IF;

  ELSIF p_referrer_type = 'member' THEN
    -- 일반 팀원이 전도한 경우: 전도자 +1, 전도자의 구역장 +1

    -- 전도자(멤버) 정보 조회
    SELECT * INTO v_referrer FROM members WHERE id = p_referrer_id;

    -- 전도자에게 +1점
    INSERT INTO points (team_id, member_id, points, reason, date, metadata)
    VALUES (
      p_team_id,
      p_referrer_id,
      1,
      'referral_by_member',
      p_date,
      jsonb_build_object('new_member_id', p_new_member_id, 'depth', 1)
    );

    v_points_added := v_points_added || jsonb_build_object(
      'member_id', p_referrer_id,
      'member_name', v_referrer.name,
      'points', 1,
      'reason', 'referral_by_member'
    );

    -- 전도자의 구역장에게 +1점
    IF v_referrer.zone_leader_id IS NOT NULL THEN
      SELECT * INTO v_zone_leader FROM zone_leaders WHERE id = v_referrer.zone_leader_id;
      IF FOUND THEN
        INSERT INTO points (team_id, zone_leader_id, points, reason, date, metadata)
        VALUES (
          p_team_id,
          v_referrer.zone_leader_id,
          1,
          'referral_chain_zone_leader',
          p_date,
          jsonb_build_object('new_member_id', p_new_member_id, 'referrer_id', p_referrer_id, 'depth', 2)
        );

        v_points_added := v_points_added || jsonb_build_object(
          'zone_leader_id', v_referrer.zone_leader_id,
          'zone_leader_name', v_zone_leader.name,
          'points', 1,
          'reason', 'referral_chain_zone_leader'
        );
      END IF;
    END IF;
  END IF;

  RETURN v_points_added;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. 출석 체크 일괄 처리 함수
-- ============================================
CREATE OR REPLACE FUNCTION process_attendance_batch(
  p_team_id UUID,
  p_week_start_date DATE,
  p_records JSONB -- [{member_id: uuid, present: boolean}, ...]
)
RETURNS JSONB AS $$
DECLARE
  v_record JSONB;
  v_member_id UUID;
  v_present BOOLEAN;
  v_points_result JSONB;
  v_all_points JSONB := '[]'::JSONB;
BEGIN
  -- 각 출석 레코드 처리
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_member_id := (v_record->>'member_id')::UUID;
    v_present := (v_record->>'present')::BOOLEAN;

    -- 출석 기록 저장 (UPSERT)
    INSERT INTO attendance_records (team_id, member_id, week_start_date, present)
    VALUES (p_team_id, v_member_id, p_week_start_date, v_present)
    ON CONFLICT (member_id, week_start_date)
    DO UPDATE SET present = EXCLUDED.present, updated_at = NOW();

    -- 출석한 새신자에게 점수 부여
    IF v_present THEN
      v_points_result := calculate_newbie_attendance_points(p_team_id, v_member_id, p_week_start_date);
      v_all_points := v_all_points || v_points_result;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'points_added', v_all_points
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. 주/월/년 리포트 조회 함수
-- ============================================
CREATE OR REPLACE FUNCTION get_team_report(
  p_team_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_attendance INT;
  v_total_absences INT;
  v_absentees JSONB;
  v_points_summary JSONB;
  v_top_referrers JSONB;
BEGIN
  -- 총 출석 수
  SELECT COUNT(*) INTO v_total_attendance
  FROM attendance_records
  WHERE team_id = p_team_id
    AND week_start_date BETWEEN p_start_date AND p_end_date
    AND present = true;

  -- 총 결석 수 (재적 멤버만, 새신자 제외)
  SELECT COUNT(*) INTO v_total_absences
  FROM attendance_records ar
  JOIN members m ON ar.member_id = m.id
  WHERE ar.team_id = p_team_id
    AND ar.week_start_date BETWEEN p_start_date AND p_end_date
    AND ar.present = false
    AND m.is_newbie = false;

  -- 결석자 명단 (재적 멤버만)
  SELECT jsonb_agg(jsonb_build_object(
    'name', m.name,
    'phone', m.phone,
    'week', ar.week_start_date
  )) INTO v_absentees
  FROM attendance_records ar
  JOIN members m ON ar.member_id = m.id
  WHERE ar.team_id = p_team_id
    AND ar.week_start_date BETWEEN p_start_date AND p_end_date
    AND ar.present = false
    AND m.is_newbie = false;

  -- 점수 요약 (사용자별, 구역장별, 멤버별)
  SELECT jsonb_build_object(
    'by_user', (
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', u.id,
        'name', u.name,
        'role', u.role,
        'total_points', COALESCE(SUM(p.points), 0)
      ))
      FROM users u
      LEFT JOIN points p ON p.user_id = u.id
        AND p.date BETWEEN p_start_date AND p_end_date
      WHERE u.team_id = p_team_id
      GROUP BY u.id, u.name, u.role
    ),
    'by_zone_leader', (
      SELECT jsonb_agg(jsonb_build_object(
        'zone_leader_id', zl.id,
        'name', zl.name,
        'total_points', COALESCE(SUM(p.points), 0)
      ))
      FROM zone_leaders zl
      LEFT JOIN points p ON p.zone_leader_id = zl.id
        AND p.date BETWEEN p_start_date AND p_end_date
      WHERE zl.team_id = p_team_id
      GROUP BY zl.id, zl.name
    ),
    'by_member', (
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', m.id,
        'name', m.name,
        'is_newbie', m.is_newbie,
        'total_points', COALESCE(SUM(p.points), 0)
      ))
      FROM members m
      LEFT JOIN points p ON p.member_id = m.id
        AND p.date BETWEEN p_start_date AND p_end_date
      WHERE m.team_id = p_team_id
      GROUP BY m.id, m.name, m.is_newbie
    )
  ) INTO v_points_summary;

  -- Top 전도자 (멤버 기준)
  SELECT jsonb_agg(t.*)
  INTO v_top_referrers
  FROM (
    SELECT
      m.id,
      m.name,
      COUNT(r.id) as referral_count,
      COALESCE(SUM(p.points), 0) as total_referral_points
    FROM members m
    LEFT JOIN referrals r ON r.referrer_id = m.id
      AND r.date BETWEEN p_start_date AND p_end_date
    LEFT JOIN points p ON p.member_id = m.id
      AND p.reason LIKE 'referral%'
      AND p.date BETWEEN p_start_date AND p_end_date
    WHERE m.team_id = p_team_id
    GROUP BY m.id, m.name
    HAVING COUNT(r.id) > 0
    ORDER BY referral_count DESC, total_referral_points DESC
    LIMIT 10
  ) t;

  -- 결과 조합
  v_result := jsonb_build_object(
    'team_id', p_team_id,
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'attendance', jsonb_build_object(
      'total_attendance', v_total_attendance,
      'total_absences', v_total_absences,
      'absentees', COALESCE(v_absentees, '[]'::JSONB)
    ),
    'points_summary', v_points_summary,
    'top_referrers', COALESCE(v_top_referrers, '[]'::JSONB)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. 전체 리포트 조회 함수 (pastor, super-admin용)
-- ============================================
CREATE OR REPLACE FUNCTION get_all_teams_report(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_team RECORD;
  v_team_report JSONB;
  v_all_reports JSONB := '[]'::JSONB;
BEGIN
  -- 각 팀별로 리포트 생성
  FOR v_team IN SELECT * FROM teams
  LOOP
    v_team_report := get_team_report(v_team.id, p_start_date, p_end_date);
    v_team_report := jsonb_set(v_team_report, '{team_name}', to_jsonb(v_team.name));
    v_all_reports := v_all_reports || jsonb_build_array(v_team_report);
  END LOOP;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'teams', v_all_reports
  );
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON FUNCTION calculate_newbie_attendance_points IS '새신자 출석 시 점수 계산 및 기록';
COMMENT ON FUNCTION calculate_referral_points IS '전도 시 점수 계산 및 기록 (구역장/팀원 구분)';
COMMENT ON FUNCTION process_attendance_batch IS '출석 체크 일괄 처리 및 새신자 점수 자동 부여';
COMMENT ON FUNCTION get_team_report IS '팀별 주/월/년 리포트 조회';
COMMENT ON FUNCTION get_all_teams_report IS '전체 팀 리포트 조회 (pastor, super-admin용)';
