import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getUserFromRequest, isTeamLeaderOfTeam, hasRole } from '../_shared/auth.ts'
import { ApiResponse } from '../_shared/types.ts'

serve(async (req) => {
  // CORS 처리
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(p => p)

    // 인증 확인
    const user = await getUserFromRequest(req)
    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, error: '인증이 필요합니다.' } as ApiResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /teams/:teamId/members - 팀 멤버 목록 조회
    if (req.method === 'GET' && pathParts.includes('teams')) {
      const teamId = pathParts[pathParts.indexOf('teams') + 1]
      return await getTeamMembers(req, user, teamId)
    }

    // POST /teams/:teamId/members - 멤버 추가
    if (req.method === 'POST' && pathParts.includes('teams')) {
      const teamId = pathParts[pathParts.indexOf('teams') + 1]
      return await createMember(req, user, teamId)
    }

    // PUT /members/:id - 멤버 수정
    if (req.method === 'PUT' && pathParts.includes('members')) {
      const memberId = pathParts[pathParts.indexOf('members') + 1]
      return await updateMember(req, user, memberId)
    }

    // DELETE /members/:id - 멤버 삭제
    if (req.method === 'DELETE' && pathParts.includes('members')) {
      const memberId = pathParts[pathParts.indexOf('members') + 1]
      return await deleteMember(req, user, memberId)
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

// 팀 멤버 목록 조회
async function getTeamMembers(req: Request, user: any, teamId: string) {
  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 권한 확인 (같은 팀이거나 pastor/super-admin)
  if (!isTeamLeaderOfTeam(user, teamId) && user.team_id !== teamId && !hasRole(user, ['pastor', 'super-admin'])) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const url = new URL(req.url)
  const week = url.searchParams.get('week') // YYYY-WW 형식

  // 멤버 목록 조회
  const { data: members, error } = await supabase
    .from('members')
    .select(`
      *,
      zone_leader:zone_leaders(id, name, phone)
    `)
    .eq('team_id', teamId)
    .order('name')

  if (error) throw error

  // 주간 출석 요약 (week 파라미터가 있는 경우)
  let attendanceSummary = null
  if (week) {
    // week를 날짜로 변환 (예: 2025-W02 -> 2025-01-06)
    const [year, weekNum] = week.split('-W')
    const weekStartDate = getWeekStartDate(parseInt(year), parseInt(weekNum))

    const { data: attendanceData } = await supabase
      .from('attendance_records')
      .select('member_id, present')
      .eq('team_id', teamId)
      .eq('week_start_date', weekStartDate)

    if (attendanceData) {
      const attendanceMap = new Map(attendanceData.map(a => [a.member_id, a.present]))
      attendanceSummary = {
        week: week,
        week_start_date: weekStartDate,
        total_present: attendanceData.filter(a => a.present).length,
        total_absent: attendanceData.filter(a => !a.present).length,
        attendance_map: Object.fromEntries(attendanceMap),
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        members,
        attendanceSummary,
      },
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 멤버 추가
async function createMember(req: Request, user: any, teamId: string) {
  // 권한 확인 (팀장만)
  if (!isTeamLeaderOfTeam(user, teamId)) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { name, phone, is_newbie, zone_leader_id, referrer_id, referrer_type } = await req.json()

  if (!name) {
    return new Response(
      JSON.stringify({ ok: false, error: '이름은 필수입니다.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 멤버 생성
  const { data: member, error } = await supabase
    .from('members')
    .insert({
      team_id: teamId,
      name,
      phone,
      is_newbie: is_newbie || false,
      zone_leader_id,
    })
    .select()
    .single()

  if (error) throw error

  // 전도 관계 등록 (새신자이고 referrer_id가 있는 경우)
  if (is_newbie && referrer_id && referrer_type) {
    const { error: referralError } = await supabase
      .from('referrals')
      .insert({
        new_member_id: member.id,
        referrer_id,
        referrer_type,
        team_id: teamId,
        depth: 1,
        date: new Date().toISOString().split('T')[0],
      })

    if (referralError) console.error('Referral creation error:', referralError)

    // 전도 점수 계산
    await supabase.rpc('calculate_referral_points', {
      p_team_id: teamId,
      p_new_member_id: member.id,
      p_referrer_id: referrer_id,
      p_referrer_type: referrer_type,
      p_date: new Date().toISOString().split('T')[0],
    })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      data: { member },
      message: '멤버가 추가되었습니다.',
    } as ApiResponse),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 멤버 수정
async function updateMember(req: Request, user: any, memberId: string) {
  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 멤버 조회하여 팀 확인
  const { data: member } = await supabase
    .from('members')
    .select('team_id')
    .eq('id', memberId)
    .single()

  if (!member) {
    return new Response(
      JSON.stringify({ ok: false, error: '멤버를 찾을 수 없습니다.' } as ApiResponse),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 권한 확인 (팀장만)
  if (!isTeamLeaderOfTeam(user, member.team_id)) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { name, phone, is_newbie, zone_leader_id } = await req.json()

  const updateData: any = {}
  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (is_newbie !== undefined) updateData.is_newbie = is_newbie
  if (zone_leader_id !== undefined) updateData.zone_leader_id = zone_leader_id

  const { data: updatedMember, error } = await supabase
    .from('members')
    .update(updateData)
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({
      ok: true,
      data: { member: updatedMember },
      message: '멤버가 수정되었습니다.',
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 멤버 삭제
async function deleteMember(req: Request, user: any, memberId: string) {
  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  // 멤버 조회하여 팀 확인
  const { data: member } = await supabase
    .from('members')
    .select('team_id')
    .eq('id', memberId)
    .single()

  if (!member) {
    return new Response(
      JSON.stringify({ ok: false, error: '멤버를 찾을 수 없습니다.' } as ApiResponse),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 권한 확인 (팀장만)
  if (!isTeamLeaderOfTeam(user, member.team_id)) {
    return new Response(
      JSON.stringify({ ok: false, error: '권한이 없습니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)

  if (error) throw error

  return new Response(
    JSON.stringify({
      ok: true,
      message: '멤버가 삭제되었습니다.',
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 주 시작일 계산 (일요일)
function getWeekStartDate(year: number, week: number): string {
  const jan1 = new Date(year, 0, 1)
  const daysToFirstSunday = (7 - jan1.getDay()) % 7
  const firstSunday = new Date(year, 0, 1 + daysToFirstSunday)
  const targetDate = new Date(firstSunday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000)
  return targetDate.toISOString().split('T')[0]
}
