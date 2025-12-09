-- members 테이블에 is_zone_leader 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_zone_leader BOOLEAN DEFAULT FALSE;

-- 기존 데이터의 zone_leader_id를 NULL로 설정 (constraint 변경 전)
UPDATE members SET zone_leader_id = NULL;

-- 기존 zone_leader_id를 member_id를 참조하도록 변경 (self-reference)
-- 외래키 제약조건 삭제 후 재생성
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_zone_leader_id_fkey;
ALTER TABLE members ADD CONSTRAINT members_zone_leader_id_fkey
  FOREIGN KEY (zone_leader_id) REFERENCES members(id) ON DELETE SET NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_members_is_zone_leader ON members(is_zone_leader);

-- 코멘트 추가
COMMENT ON COLUMN members.is_zone_leader IS '구역장 여부 (true이면 구역장)';
COMMENT ON COLUMN members.zone_leader_id IS '소속 구역장 (구역장인 경우 NULL, 일반 멤버는 자신의 구역장 member_id)';

SELECT '멤버 테이블 구조가 업데이트되었습니다.' as message;
SELECT 'is_zone_leader 컬럼이 추가되었습니다.' as detail;
SELECT 'zone_leader_id가 이제 members.id를 참조합니다.' as detail2;
