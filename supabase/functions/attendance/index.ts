import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getUserFromRequest, isTeamLeaderOfTeam } from '../_shared/auth.ts'
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

    if (req.method === 'POST') {
      return await saveAttendance(req, user)
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

// 출석 체크 저장
async function saveAttendance(req: Request, user: any) {
  const { team_id, week_start_date, records } = await req.json()

  // 입력 검증
  if (!team_id || !week_start_date || !Array.isArray(records)) {
    return new Response(
      JSON.stringify({ ok: false, error: '필수 항목을 모두 입력해주세요.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 권한 확인 (팀장만)
  if (!isTeamLeaderOfTeam(user, team_id)) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 출석 일괄 처리 함수 호출
  const { data, error } = await supabase.rpc('process_attendance_batch', {
    p_team_id: team_id,
    p_week_start_date: week_start_date,
    p_records: records,
  })

  if (error) throw error

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        attendance_saved: true,
        computed_points: data?.points_added || [],
      },
      message: '출석이 저장되었습니다.',
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
