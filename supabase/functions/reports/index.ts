import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getUserFromRequest, isTeamLeaderOfTeam, hasRole } from '../_shared/auth.ts'
import { ApiResponse } from '../_shared/types.ts'

serve(async (req) => {
  // CORS 처리
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // 인증 확인
    const user = await getUserFromRequest(req)
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: '인증이 필요합니다.' } as ApiResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(p => p)

    // GET /reports/team/:teamId - 팀 리포트 조회
    if (req.method === 'GET' && pathParts.includes('team')) {
      const teamId = pathParts[pathParts.indexOf('team') + 1]
      return await getTeamReport(req, user, teamId)
    }

    // GET /admin/all-reports - 전체 리포트 조회
    if (req.method === 'GET' && pathParts.includes('all-reports')) {
      return await getAllReports(req, user)
    }

    return new Response(
      JSON.stringify({ ok: false, error: 'Not found' } as ApiResponse),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message } as ApiResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// 팀 리포트 조회
async function getTeamReport(req: Request, user: any, teamId: string) {
  // 권한 확인 (같은 팀이거나 pastor/super-admin)
  if (!isTeamLeaderOfTeam(user, teamId) && user.team_id !== teamId && !hasRole(user, ['pastor', 'super-admin'])) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'week' // week, month, year
  const startDate = url.searchParams.get('start')
  const endDate = url.searchParams.get('end')

  let start: string, end: string

  if (startDate && endDate) {
    start = startDate
    end = endDate
  } else {
    // 기본값 계산
    const now = new Date()
    if (period === 'week') {
      start = getWeekStartDate(now)
      end = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]
    } else {
      start = getWeekStartDate(now)
      end = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  }

  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 리포트 조회 함수 호출
  const { data, error } = await supabase.rpc('get_team_report', {
    p_team_id: teamId,
    p_start_date: start,
    p_end_date: end,
  })

  if (error) throw error

  return new Response(
    JSON.stringify({
      ok: true,
      data,
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 전체 리포트 조회 (pastor, super-admin 전용)
async function getAllReports(req: Request, user: any) {
  // 권한 확인 (pastor, super-admin만)
  if (!hasRole(user, ['pastor', 'super-admin'])) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'week'
  const startDate = url.searchParams.get('start')
  const endDate = url.searchParams.get('end')

  let start: string, end: string

  if (startDate && endDate) {
    start = startDate
    end = endDate
  } else {
    const now = new Date()
    if (period === 'week') {
      start = getWeekStartDate(now)
      end = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
      end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0]
    } else {
      start = getWeekStartDate(now)
      end = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  }

  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 전체 리포트 조회 함수 호출
  const { data, error } = await supabase.rpc('get_all_teams_report', {
    p_start_date: start,
    p_end_date: end,
  })

  if (error) throw error

  return new Response(
    JSON.stringify({
      ok: true,
      data,
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 주 시작일 계산 (일요일)
function getWeekStartDate(date: Date): string {
  const day = date.getDay()
  const diff = date.getDate() - day
  const sunday = new Date(date.setDate(diff))
  return sunday.toISOString().split('T')[0]
}
