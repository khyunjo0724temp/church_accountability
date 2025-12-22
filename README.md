# 교회 출석 및 전도 관리 시스템

교회 팀별 출석, 전도(새신자) 누적 점수제를 관리하는 웹 애플리케이션입니다.

## 주요 기능

### 사용자 역할
- **super-admin (운영자)**: 팀장 회원가입 승인/거절, 관리자 대시보드
- **team-leader (팀장)**: 자신 팀의 구성원 CRUD, 주간 출석 체크, 전도 등록, 리포트 조회
- **zone-leader (구역장)**: 팀장 아래 소속, 읽기 권한
- **pastor (목사님)**: 전체 리포트 조회 (읽기 전용)
- **member (팀원)**: 프로필 조회/수정

### 핵심 화면
1. **로그인/회원가입**: 전화번호 + 4자리 PIN 인증, 기기 기억하기 옵션
2. **대시보드**: 주간/월간 출석 현황, 점수 요약, 빠른 액션 버튼
3. **멤버 관리**: 팀원 목록, 새신자/재적 필터, CRUD 기능
4. **주간 출석 체크**: 주일별 출석 체크, 실시간 출석/결석 집계
5. **전도(새신자) 등록**: 새신자 정보 입력, 전도자 관계 설정
6. **리포트**: 주/월/년 단위 통계, 개인별 점수, 결석 명단
7. **관리자 페이지**: 팀장 가입 승인 관리

## 점수 계산 규칙

### 새신자 출석
- 새신자 본인: +1점 (매주 출석 시마다 누적)
- 새신자는 결석 집계에서 제외

### 전도 점수
- **구역장이 전도한 경우**: 구역장 +1점, 팀장 +1점
- **일반 팀원이 전도한 경우**: 전도자 +1점, 전도자의 구역장 +1점
- 전파는 2대까지 점수 부여 (depth=2)

### 결석 집계
- 재적 멤버가 체크되지 않으면 결석 카운트에 포함
- 새신자는 결석 카운트 불포함

## 환경 설정

### 1. 백엔드 설정 (Supabase)

백엔드는 Supabase를 사용합니다. 로컬 개발을 위해 먼저 Supabase를 설정해야 합니다.

\`\`\`bash
# Supabase CLI 설치 (macOS)
brew install supabase/tap/supabase

# Supabase 로컬 시작
cd supabase
supabase start

# 마이그레이션 및 샘플 데이터 로드
supabase db reset
\`\`\`

자세한 백엔드 설정은 [supabase/README.md](./supabase/README.md)를 참조하세요.

### 2. 프론트엔드 환경 변수

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수를 설정하세요:

\`\`\`env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<supabase start 시 출력되는 anon key>
\`\`\`

### 3. 프론트엔드 설치 및 실행

\`\`\`bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
\`\`\`

## API 엔드포인트

모든 요청은 `Authorization: Bearer <access_token>` 헤더가 필요합니다.

### 인증
- `POST /auth/signup` - 회원가입
- `POST /auth/login` - 로그인

### 팀 및 멤버
- `GET /teams/:teamId/members` - 팀 멤버 목록 조회
- `POST /teams/:teamId/members` - 멤버 추가
- `PUT /members/:id` - 멤버 수정
- `DELETE /members/:id` - 멤버 삭제

### 출석
- `POST /attendance` - 출석 기록 저장

### 전도
- `POST /referrals` - 전도 관계 등록

### 리포트
- `GET /reports/team/:teamId` - 팀 리포트 조회
- `GET /admin/all-reports` - 전체 리포트 조회 (관리자)

### 관리자
- `GET /admin/pending-team-leaders` - 승인 대기 팀장 목록
- `POST /admin/approve-user` - 사용자 승인/거절

## 기술 스택

- **프론트엔드**: React 19 + TypeScript
- **스타일링**: Tailwind CSS
- **라우팅**: React Router v7
- **상태관리**: TanStack Query (React Query)
- **아이콘**: Remix Icon
- **빌드 도구**: Vite

## 테스트 케이스

1. 새신자 등록 → 해당 주 출석 체크 시 새신자 본인 +1점
2. 일반 팀원이 새신자 전도 → 전도자 +1점, 구역장 +1점
3. 구역장이 전도 → 구역장 +1점, 팀장 +1점
4. 같은 새신자가 2주 연속 출석 → 각 주마다 +1점씩 누적 (총 2점)
5. super-admin이 팀장 가입 승인 후 해당 팀장만 팀 CRUD 가능
6. pastor는 리포트 조회만 가능, 수정 버튼 숨김

## 데모 데이터

- **팀**: "백남여 4C" (id: team_4C)
- **팀장**: "김팀장" (id: leader_kim)
- **구역장**: "구역장A" (id: zone_a), "구역장B"
- **멤버**: 30명 (새신자/재적 혼합)

## 프로젝트 구조

\`\`\`
church/
├── src/                     # 프론트엔드 소스
│   ├── pages/
│   │   ├── login/          # 로그인/회원가입
│   │   ├── dashboard/      # 대시보드
│   │   ├── members/        # 멤버 관리
│   │   ├── attendance/     # 출석 체크
│   │   ├── evangelism/     # 새신자 등록
│   │   ├── reports/        # 리포트
│   │   └── admin/          # 관리자 페이지
│   ├── router/
│   │   ├── config.tsx      # 라우팅 설정
│   │   └── index.ts        # 라우터 초기화
│   └── main.tsx            # 앱 진입점
├── supabase/               # 백엔드 (Supabase)
│   ├── migrations/         # 데이터베이스 마이그레이션
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_scoring_functions.sql
│   ├── functions/          # Edge Functions (API)
│   │   ├── auth/           # 인증 API
│   │   ├── members/        # 멤버 관리 API
│   │   ├── attendance/     # 출석 체크 API
│   │   ├── reports/        # 리포트 API
│   │   └── admin/          # 관리자 API
│   ├── seed/               # 샘플 데이터
│   │   └── sample_data.sql
│   └── README.md           # 백엔드 문서
├── package.json
└── README.md
\`\`\`

## 문의

시스템 사용 중 문의사항이 있으시면 관리자에게 연락해주세요.

---
