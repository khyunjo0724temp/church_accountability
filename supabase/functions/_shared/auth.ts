import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { User, UserRole } from './types.ts'

// Supabase 클라이언트 생성
export function getSupabaseClient(authHeader?: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  })
}

// JWT에서 사용자 ID 추출
export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = getSupabaseClient(authHeader)

  try {
    // JWT 검증 (Supabase에서 자동으로 처리)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null

    // 사용자 정보 조회
    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (dbError || !data) return null
    return data as User
  } catch {
    return null
  }
}

// PIN 해시 생성
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return await bcrypt.hash(pin, salt)
}

// PIN 검증
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(pin, hash)
}

// JWT 토큰 생성 (커스텀)
export async function generateToken(userId: string, role: UserRole): Promise<string> {
  const supabase = getSupabaseClient()

  // Supabase Auth에 사용자 생성 또는 가져오기
  // 실제로는 전화번호를 이메일로 변환하여 사용
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${userId}@church.internal`,
    user_metadata: { role, user_id: userId },
  })

  if (error) throw error

  // 세션 토큰 반환
  return data.user.id
}

// 권한 확인
export function hasRole(user: User, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(user.role)
}

export function isTeamLeaderOfTeam(user: User, teamId: string): boolean {
  return user.role === 'team-leader' && user.team_id === teamId && user.approved
}
