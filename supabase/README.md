# 교회 출석 관리 시스템 - Supabase 백엔드

이 디렉토리는 교회 출석 및 전도 관리 시스템의 Supabase 백엔드 구현을 포함합니다.

## 📁 프로젝트 구조

```
supabase/
├── migrations/              # 데이터베이스 마이그레이션
│   ├── 001_initial_schema.sql      # 초기 스키마
│   ├── 002_rls_policies.sql        # RLS 정책
│   └── 003_scoring_functions.sql   # 점수 계산 함수
├── functions/              # Edge Functions (API 엔드포인트)
│   ├── _shared/           # 공통 유틸리티
│   │   ├── cors.ts        # CORS 설정
│   │   ├── types.ts       # 타입 정의
│   │   └── auth.ts        # 인증 헬퍼
│   ├── auth/              # 인증 API
│   ├── members/           # 멤버 관리 API
│   ├── attendance/        # 출석 체크 API
│   ├── reports/           # 리포트 API
│   └── admin/             # 관리자 API
├── seed/                  # 샘플 데이터
│   └── sample_data.sql
├── config.toml            # Supabase 로컬 설정
└── README.md
```

## 🚀 시작하기

### 1. Supabase CLI 설치

```bash
# macOS
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# NPM (모든 플랫폼)
npm install -g supabase
```

### 2. Supabase 프로젝트 초기화

```bash
# 프로젝트 루트에서
cd supabase
supabase init
```

### 3. 로컬 Supabase 시작

```bash
supabase start
```

이 명령어는:
- PostgreSQL 데이터베이스 시작
- Supabase Studio (http://localhost:54323) 시작
- Edge Functions 런타임 시작
- API 게이트웨이 시작 (http://localhost:54321)

### 4. 마이그레이션 실행

```bash
# 모든 마이그레이션 적용
supabase db reset

# 또는 개별 마이그레이션 실행
supabase migration up
```

### 5. 샘플 데이터 로드

```bash
# psql 사용
supabase db reset --seed

# 또는 직접 SQL 실행
psql postgresql://postgres:postgres@localhost:54322/postgres -f seed/sample_data.sql
```

### 6. Edge Functions 배포 (로컬)

```bash
# 개별 함수 배포
supabase functions deploy auth
supabase functions deploy members
supabase functions deploy attendance
supabase functions deploy reports
supabase functions deploy admin

# 모든 함수 배포
supabase functions deploy
```

## 🔑 환경 변수

프론트엔드에서 사용할 환경 변수:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<로컬에서 제공되는 anon key>
```

로컬 Supabase를 시작하면 콘솔에 `anon key`와 `service_role key`가 표시됩니다.

## 📊 데이터베이스 스키마

### 주요 테이블

1. **teams** - 팀 정보
2. **users** - 사용자 계정 (로그인)
3. **zone_leaders** - 구역장 정보
4. **members** - 팀원 정보
5. **referrals** - 전도 관계
6. **attendance_records** - 출석 기록
7. **points** - 점수 기록
8. **devices** - 자동 로그인용 기기 정보

### ER 다이어그램 요약

```
teams (1) ←→ (N) users
teams (1) ←→ (N) zone_leaders
teams (1) ←→ (N) members
zone_leaders (1) ←→ (N) members
members (1) ←→ (N) attendance_records
members (1) ←→ (N) referrals
teams (1) ←→ (N) points
```

## 🔐 인증 및 권한

### 사용자 역할

- **super-admin**: 모든 권한, 팀장 승인 관리
- **team-leader**: 자기 팀의 CRUD, 출석 체크, 전도 등록
- **zone-leader**: 읽기 권한 (자기 팀)
- **pastor**: 전체 리포트 읽기 (수정 불가)
- **member**: 프로필 조회/수정

### Row Level Security (RLS)

모든 테이블에 RLS가 활성화되어 있으며, 각 역할에 따라 접근 권한이 제한됩니다.

## 🌐 API 엔드포인트

### 인증 (/auth)

- `POST /auth/signup` - 회원가입
- `POST /auth/login` - 로그인

### 멤버 관리 (/members)

- `GET /teams/:teamId/members` - 멤버 목록 조회
- `POST /teams/:teamId/members` - 멤버 추가
- `PUT /members/:id` - 멤버 수정
- `DELETE /members/:id` - 멤버 삭제

### 출석 체크 (/attendance)

- `POST /attendance` - 출석 기록 저장

### 리포트 (/reports)

- `GET /reports/team/:teamId` - 팀 리포트 조회
- `GET /admin/all-reports` - 전체 리포트 조회

### 관리자 (/admin)

- `GET /admin/pending-team-leaders` - 승인 대기 팀장 목록
- `POST /admin/approve-user` - 사용자 승인/거절

## 🧪 테스트 계정

샘플 데이터 로드 후 사용 가능한 계정:

| 역할 | 이름 | 전화번호 | PIN |
|------|------|----------|-----|
| super-admin | 관리자 | 01000000000 | 1234 |
| team-leader | 김팀장 | 01011111111 | 1234 |
| pastor | 목사님 | 01099999999 | 1234 |

## 📈 점수 계산 로직

### 1. 새신자 출석 점수

- 새신자 본인: **+1점** (매주 출석 시마다)
- 새신자는 결석 집계에서 제외

### 2. 전도 점수

**구역장이 전도한 경우:**
- 구역장: **+1점**
- 팀장: **+1점**

**일반 팀원이 전도한 경우:**
- 전도자 (팀원): **+1점**
- 전도자의 구역장: **+1점**

### 3. 결석 집계

- 재적 멤버가 체크되지 않으면 결석 카운트에 포함
- 새신자는 결석 카운트 불포함

## 🛠️ 개발 도구

### Supabase Studio

로컬 개발 시 http://localhost:54323 에서 접근 가능

- 데이터베이스 테이블 조회/편집
- SQL 편집기
- API 문서 자동 생성
- 인증 관리

### psql 접속

```bash
supabase db reset
psql postgresql://postgres:postgres@localhost:54322/postgres
```

### 로그 확인

```bash
# Edge Function 로그
supabase functions logs auth

# 데이터베이스 로그
supabase db logs
```

## 🚢 프로덕션 배포

### 1. Supabase 프로젝트 생성

https://supabase.com 에서 새 프로젝트 생성

### 2. 데이터베이스 마이그레이션

```bash
# Supabase 프로젝트에 연결
supabase link --project-ref <your-project-ref>

# 마이그레이션 푸시
supabase db push
```

### 3. Edge Functions 배포

```bash
# 모든 함수 배포
supabase functions deploy

# 환경 변수 설정
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. 프론트엔드 환경 변수 업데이트

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 📝 추가 작업 사항

### 보안

- [ ] PIN 해시를 실제 bcrypt로 구현 (현재는 샘플)
- [ ] JWT 토큰 갱신 로직 추가
- [ ] Rate limiting 설정
- [ ] API 키 로테이션 전략

### 기능

- [ ] 이메일/SMS 알림 (결석자, 새신자 출석 등)
- [ ] 엑셀/CSV 내보내기 API
- [ ] 대시보드 통계 API 최적화
- [ ] 실시간 알림 (Supabase Realtime 활용)

### 모니터링

- [ ] 에러 로깅 (Sentry 등)
- [ ] 성능 모니터링
- [ ] 백업 전략 수립

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해주세요.

## 📄 라이선스

MIT License
