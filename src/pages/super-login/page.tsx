import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function SuperLogin() {
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
      // 관리자 계정 확인
      const { data: admin, error: adminError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', formData.username)
        .eq('role', 'admin')
        .single();

      if (adminError || !admin) {
        setError('관리자 계정 정보가 올바르지 않습니다');
        return;
      }

      // 비밀번호 확인
      if (admin.pin_hash !== formData.password) {
        setError('관리자 계정 정보가 올바르지 않습니다');
        return;
      }

      // 세션 저장
      localStorage.setItem('user', JSON.stringify(admin));
      navigate('/admin');
    } catch (err) {
      setError('로그인에 실패했습니다: ' + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full flex items-center justify-center">
              <i className="ri-shield-keyhole-line text-3xl text-white"></i>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-white mb-2">
            관리자 로그인
          </h1>
          <p className="text-center text-purple-200 text-sm mb-8">
            Super Admin Access Only
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Username
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter admin username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter admin password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-3 rounded-lg transition-all transform hover:scale-105 cursor-pointer"
            >
              Access Admin Panel
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-purple-300 hover:text-white text-sm transition-colors cursor-pointer"
            >
              일반 로그인으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
