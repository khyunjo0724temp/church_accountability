import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pin: '',
    teamName: '',
    rememberDevice: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
      setError('PIN은 4자리 숫자여야 합니다');
      return;
    }

    try {
      if (isLogin) {
        // 로그인 로직
        // 1. users 테이블에서 전화번호로 사용자 찾기
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', formData.phone)
          .single();

        if (userError || !user) {
          setError('전화번호 또는 PIN이 올바르지 않습니다');
          return;
        }

        // 2. PIN 확인 (실제로는 bcrypt 비교해야 하지만, 간단히 문자열 비교)
        // TODO: 실제 환경에서는 백엔드에서 bcrypt.compare 사용
        if (user.pin_hash !== formData.pin) {
          setError('전화번호 또는 PIN이 올바르지 않습니다');
          return;
        }

        // 3. 팀장인데 승인되지 않은 경우
        if (user.role === 'team-leader' && !user.approved) {
          setError('관리자 승인 대기 중입니다');
          return;
        }

        // 4. 세션 저장
        localStorage.setItem('user', JSON.stringify(user));
        if (formData.rememberDevice) {
          localStorage.setItem('remember_device', 'true');
        }
        navigate('/attendance');
      } else {
        // 회원가입 로직
        // 1. 전화번호 중복 확인
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', formData.phone)
          .single();

        if (existingUser) {
          setError('이미 등록된 전화번호입니다');
          return;
        }

        // 2. 팀 생성 또는 조회
        let teamId = null;
        if (formData.teamName) {
          const { data: existingTeam } = await supabase
            .from('teams')
            .select('id')
            .eq('name', formData.teamName)
            .single();

          if (existingTeam) {
            teamId = existingTeam.id;
          } else {
            const { data: newTeam, error: teamError } = await supabase
              .from('teams')
              .insert({ name: formData.teamName })
              .select()
              .single();

            if (teamError) {
              setError('팀 생성에 실패했습니다');
              return;
            }
            teamId = newTeam.id;
          }
        }

        // 3. 사용자 생성
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            name: formData.name,
            phone: formData.phone,
            pin_hash: formData.pin, // TODO: 실제로는 bcrypt로 해시해야 함
            role: 'team-leader',
            team_id: teamId,
            approved: false // 팀장은 승인 필요
          });

        if (insertError) {
          setError('회원가입에 실패했습니다: ' + insertError.message);
          return;
        }

        setSuccess('회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.');
        setTimeout(() => setIsLogin(true), 2000);
      }
    } catch (err) {
      setError('오류가 발생했습니다: ' + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-8">
            <img
              src="/logo.png"
              alt="교회 로고"
              className="h-20 w-auto object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            {isLogin ? '로그인' : '회원가입'}
          </h1>
          <p className="text-center text-gray-600 text-sm mb-8">
            {isLogin ? '출석 관리 시스템에 오신 것을 환영합니다' : '팀장으로 등록하시겠습니까?'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="이름을 입력하세요"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전화번호
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="01012345678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                4자리 PIN
              </label>
              <input
                type="password"
                required
                maxLength={4}
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="4자리 숫자"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  팀명 (선택)
                </label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="예: 백남여 4C"
                />
              </div>
            )}

            {isLogin && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={formData.rememberDevice}
                  onChange={(e) => setFormData({ ...formData, rememberDevice: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-700 cursor-pointer">
                  이 기기 기억하기
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full text-white font-medium py-3 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: '#1E88E5' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1976D2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1E88E5'}
            >
              {isLogin ? '로그인' : '회원가입'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-sm text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap"
            >
              {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          문의사항이 있으시면 관리자에게 연락해주세요
        </p>
      </div>
    </div>
  );
}