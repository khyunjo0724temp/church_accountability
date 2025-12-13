import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Team {
  id: string;
  name: string;
  created_at: string;
}

export default function PastorDashboard() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // 로그인 확인
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      navigate('/pastor-login');
      return;
    }

    const userData = JSON.parse(userStr);
    if (userData.role !== 'pastor') {
      navigate('/pastor-login');
      return;
    }

    setUser(userData);
    fetchTeams();
  }, [navigate]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamClick = (teamId: string | null) => {
    if (teamId === null) {
      // 전체보기: team_id 파라미터 없이 이동 (모든 팀 데이터)
      navigate('/reports?view=all');
    } else {
      navigate(`/reports?team_id=${teamId}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/pastor-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img
                src="https://public.readdy.ai/ai/img_res/6f5f4709-4636-4b57-8f60-15ce4bfa71df.png"
                alt="교회 로고"
                className="h-8 w-auto object-contain"
              />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-logout-box-line"></i>
              <span className="text-sm font-medium">로그아웃</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">팀 목록</h2>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <i className="ri-team-line text-5xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">등록된 팀이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 전체보기 카드 */}
            <div
              onClick={() => handleTeamClick(null)}
              className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-blue-400 p-6 group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <i className="ri-dashboard-line text-2xl text-white"></i>
                </div>
                <i className="ri-arrow-right-line text-xl text-white/80 group-hover:text-white group-hover:translate-x-1 transition-all"></i>
              </div>
              <h3 className="text-xl font-bold text-white">전체보기</h3>
              <p className="text-sm text-white/80 mt-1">모든 팀 통합 현황</p>
            </div>

            {/* 개별 팀 카드들 */}
            {teams.map((team) => (
              <div
                key={team.id}
                onClick={() => handleTeamClick(team.id)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-200 hover:border-blue-300 p-6 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <i className="ri-team-line text-2xl text-blue-600"></i>
                  </div>
                  <i className="ri-arrow-right-line text-xl text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
