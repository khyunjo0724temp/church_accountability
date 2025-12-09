import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, hashPin, verifyPin } from '../_shared/auth.ts'
import { ApiResponse } from '../_shared/types.ts'

serve(async (req) => {
  // CORS 처리
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    if (path === 'signup' && req.method === 'POST') {
      return await handleSignup(req)
    } else if (path === 'login' && req.method === 'POST') {
      return await handleLogin(req)
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

// 회원가입 처리
async function handleSignup(req: Request) {
  const { name, phone, pin, roleRequested, teamName } = await req.json()

  // 입력 검증
  if (!name || !phone || !pin || !roleRequested) {
    return new Response(
      JSON.stringify({ ok: false, error: '필수 항목을 모두 입력해주세요.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // PIN 길이 검증 (4자리)
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'PIN은 4자리 숫자여야 합니다.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseClient()

  // 전화번호 중복 확인
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .single()

  if (existingUser) {
    return new Response(
      JSON.stringify({ ok: false, error: '이미 등록된 전화번호입니다.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // PIN 해시화
  const pinHash = await hashPin(pin)

  // 팀 처리 (팀장인 경우)
  let teamId = null
  if (roleRequested === 'team-leader' && teamName) {
    // 팀 생성 또는 조회
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('name', teamName)
      .single()

    if (existingTeam) {
      teamId = existingTeam.id
    } else {
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({ name: teamName })
        .select()
        .single()

      if (teamError) throw teamError
      teamId = newTeam.id
    }
  }

  // 사용자 생성
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      name,
      phone,
      pin_hash: pinHash,
      role: roleRequested,
      team_id: teamId,
      approved: roleRequested !== 'team-leader', // 팀장은 승인 필요
    })
    .select()
    .single()

  if (error) throw error

  const message = roleRequested === 'team-leader'
    ? '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.'
    : '회원가입이 완료되었습니다.'

  return new Response(
    JSON.stringify({
      ok: true,
      data: { user_id: user.id },
      message,
    } as ApiResponse),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// 로그인 처리
async function handleLogin(req: Request) {
  const { phone, pin, deviceId, rememberDevice } = await req.json()

  // 입력 검증
  if (!phone || !pin) {
    return new Response(
      JSON.stringify({ ok: false, error: '전화번호와 PIN을 입력해주세요.' } as ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseClient()

  // 사용자 조회
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single()

  if (error || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: '전화번호 또는 PIN이 올바르지 않습니다.' } as ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // PIN 검증
  const isValidPin = await verifyPin(pin, user.pin_hash)
  if (!isValidPin) {
    return new Response(
      JSON.stringify({ ok: false, error: '전화번호 또는 PIN이 올바르지 않습니다.' } as ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 팀장인데 승인되지 않은 경우
  if (user.role === 'team-leader' && !user.approved) {
    return new Response(
      JSON.stringify({ ok: false, error: '관리자 승인 대기 중입니다.' } as ApiResponse),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Supabase Auth로 세션 생성
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: `${user.id}@church.internal`,
    password: pin,
  })

  // Auth 유저가 없으면 생성
  if (authError) {
    const { data: newAuthData, error: createError } = await supabase.auth.admin.createUser({
      email: `${user.id}@church.internal`,
      password: pin,
      email_confirm: true,
      user_metadata: { role: user.role, user_id: user.id },
    })

    if (createError) throw createError

    // 다시 로그인 시도
    const { data: retryAuthData, error: retryError } = await supabase.auth.signInWithPassword({
      email: `${user.id}@church.internal`,
      password: pin,
    })

    if (retryError) throw retryError
  }

  // 디바이스 저장 (자동 로그인용)
  if (deviceId && rememberDevice) {
    await supabase
      .from('devices')
      .upsert({
        user_id: user.id,
        device_id: deviceId,
        last_login_at: new Date().toISOString(),
      })
  }

  // 최종 세션 가져오기
  const { data: session } = await supabase.auth.getSession()

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        access_token: session?.session?.access_token,
        refresh_token: session?.session?.refresh_token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          team_id: user.team_id,
          approved: user.approved,
        },
      },
      message: '로그인 성공',
    } as ApiResponse),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
