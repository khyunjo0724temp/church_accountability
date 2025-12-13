import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function PastorLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 목사님 계정 확인
      const { data: pastor, error: pastorError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', formData.username)
        .eq('role', 'pastor')
        .single();

      if (pastorError || !pastor) {
        setError('목사님 계정 정보가 올바르지 않습니다');
        return;
      }

      // 비밀번호 확인
      if (pastor.pin_hash !== formData.password) {
        setError('목사님 계정 정보가 올바르지 않습니다');
        return;
      }

      // 세션 저장
      localStorage.setItem('user', JSON.stringify(pastor));
      navigate('/pastor-dashboard');
    } catch (err) {
      setError('로그인에 실패했습니다: ' + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-blue-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
              <i className="ri-user-star-line text-3xl text-white"></i>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-white mb-2">
            목사님 로그인
          </h1>
          <p className="text-center text-blue-200 text-sm mb-8">
            Pastor Dashboard Access
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Username
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-lg transition-all transform hover:scale-105 cursor-pointer"
            >
              목사님 대시보드 접속
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-blue-300 hover:text-white text-sm transition-colors cursor-pointer"
            >
              일반 로그인으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
