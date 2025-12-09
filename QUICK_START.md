# 🚀 빠른 시작 가이드

이 가이드는 교회 출석 관리 시스템을 로컬에서 빠르게 실행하는 방법을 안내합니다.

## 📋 사전 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Docker Desktop (Supabase 로컬 실행용)
- Git

## 🏃‍♂️ 5분 안에 시작하기

### 1단계: 프로젝트 클론 및 의존성 설치

\`\`\`bash
# 프로젝트 디렉토리로 이동
cd church

# 프론트엔드 의존성 설치
npm install
\`\`\`

### 2단계: Supabase CLI 설치

\`\`\`bash
# macOS
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 또는 NPM (모든 플랫폼)
npm install -g supabase
\`\`\`

### 3단계: Supabase 로컬 시작

\`\`\`bash
# Supabase 시작 (Docker 컨테이너 실행)
cd supabase
supabase start
\`\`\`

⏱️ 첫 실행 시 Docker 이미지 다운로드로 3-5분 소요될 수 있습니다.

실행이 완료되면 다음과 같은 정보가 출력됩니다:

\`\`\`
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

**중요**: `anon key` 값을 복사해두세요!

### 4단계: 데이터베이스 설정 및 샘플 데이터 로드

\`\`\`bash
# 마이그레이션 실행 및 샘플 데이터 로드
supabase db reset
\`\`\`

이 명령어는:
- 데이터베이스 스키마 생성
- RLS 정책 적용
- 점수 계산 함수 생성
- 샘플 데이터 로드 (팀, 사용자, 멤버 등)

### 5단계: 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

\`\`\`bash
# 프로젝트 루트로 돌아가기
cd ..

# .env 파일 생성
cat > .env << EOF
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<3단계에서 복사한 anon key>
EOF
\`\`\`

### 6단계: 프론트엔드 실행

\`\`\`bash
# 개발 서버 시작
npm run dev
\`\`\`

브라우저에서 http://localhost:5173 을 열어주세요!

## 🎉 테스트 계정으로 로그인

샘플 데이터에 다음 테스트 계정이 포함되어 있습니다:

| 역할 | 전화번호 | PIN | 설명 |
|------|----------|-----|------|
| 관리자 | 010-0000-0000 | 1234 | 모든 권한, 팀장 승인 |
| 팀장 | 010-1111-1111 | 1234 | 백남여 4C 팀 관리 |
| 목사님 | 010-9999-9999 | 1234 | 전체 리포트 조회 |

## 🛠️ 주요 도구 접근

- **프론트엔드**: http://localhost:5173
- **Supabase Studio**: http://localhost:54323 (데이터베이스 GUI)
- **API**: http://localhost:54321

## 📚 다음 단계

### 데이터베이스 탐색

Supabase Studio (http://localhost:54323)에서:
- 테이블 구조 확인
- SQL 편집기로 쿼리 실행
- RLS 정책 확인
- API 문서 자동 생성

### API 테스트

\`\`\`bash
# 로그인 테스트
curl -X POST http://localhost:54321/functions/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "010-1111-1111",
    "pin": "1234"
  }'
\`\`\`

### 샘플 데이터 확인

\`\`\`sql
-- psql로 접속
psql postgresql://postgres:postgres@localhost:54322/postgres

-- 팀 목록
SELECT * FROM teams;

-- 멤버 목록
SELECT * FROM members LIMIT 10;

-- 출석 기록
SELECT * FROM attendance_records;
\`\`\`

## 🔧 문제 해결

### Docker가 실행되지 않는 경우

\`\`\`bash
# Docker Desktop이 실행 중인지 확인
docker ps

# Docker Desktop 재시작 후 다시 시도
supabase stop
supabase start
\`\`\`

### Port 충돌

다른 서비스가 포트를 사용 중이면:

\`\`\`bash
# 사용 중인 포트 확인
lsof -i :54321
lsof -i :54322
lsof -i :54323

# 해당 프로세스 종료 후 다시 시작
supabase stop
supabase start
\`\`\`

### 데이터베이스 초기화

\`\`\`bash
# 데이터베이스 완전 초기화
supabase db reset
\`\`\`

### Supabase 완전히 중지

\`\`\`bash
# 모든 Supabase 컨테이너 중지 및 삭제
supabase stop
\`\`\`

## 📖 더 알아보기

- [프로젝트 README](./README.md) - 전체 프로젝트 개요
- [백엔드 문서](./supabase/README.md) - Supabase 상세 가이드
- [Supabase 공식 문서](https://supabase.com/docs)

## 💡 유용한 명령어

\`\`\`bash
# Supabase 상태 확인
supabase status

# 데이터베이스 마이그레이션 생성
supabase migration new <migration_name>

# Edge Function 로그 확인
supabase functions logs auth

# 프론트엔드 빌드
npm run build

# 프로덕션 미리보기
npm run preview
\`\`\`

## 🆘 도움이 필요하신가요?

- GitHub Issues에 문제를 등록해주세요
- [Supabase Discord](https://discord.supabase.com)에서 커뮤니티 도움 받기

---

**즐거운 개발 되세요! 🎊**
