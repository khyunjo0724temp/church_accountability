import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getUserFromRequest, hasRole } from '../_shared/auth.ts'
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

    // super-admin 권한 확인
    if (!hasRole(user, ['super-admin'])) {
      return new Response(
        JSON.stringify({ ok: false, error: '관리자 권한이 필요합니다.' } as ApiResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(p => p)

    // GET /admin/pending-team-leaders - 승인 대기 팀장 목록
    if (req.method === 'GET' && pathParts.includes('pending-team-leaders')) {
      return await getPendingTeamLeaders(req, user)
    }

    // POST /admin/approve-user - 사용자 승인/거절
    if (req.method === 'POST' && pathParts.includes('approve-user')) {
      return await approveUser(req, user)
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

// 승인 대기 팀장 목록 조회
async function getPendingTeamLeaders(req: Request, user: any) {
  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  const { data: pending, error } = await supabase
    .from('users')
    .select(`
      id,
      name,
      phone,
      role,
      team_id,
      teams(id, name),
      created_at
    `)
    .eq('role', 'team-leader')
    .eq('approved', false)
    .order('created_at', { ascending: false })

  if (error) throw error

  return new Response(
    JSON.stringify({
      ok: true,
      data: { pending },
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 사용자 승인/거절
async function approveUser(req: Request, user: any) {
  const { user_id, approve, role_assigned } = await req.json()

  if (!user_id || approve === undefined) {
    return new Response(
      JSON.stringify({ ok: false, error: '필수 항목을 모두 입력해주세요.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseClient(req.headers.get('Authorization')!)

  if (approve) {
    // 승인
    const updateData: any = { approved: true }
    if (role_assigned) {
      updateData.role = role_assigned
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user_id)
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        ok: true,
        data: { user: data },
        message: '사용자가 승인되었습니다.',
      } as ApiResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } else {
    // 거절 (삭제)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)

    if (error) throw error

    return new Response(
      JSON.stringify({
        ok: true,
        message: '사용자가 거절되었습니다.',
      } as ApiResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
