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
