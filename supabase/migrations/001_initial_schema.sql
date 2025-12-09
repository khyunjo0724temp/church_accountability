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
