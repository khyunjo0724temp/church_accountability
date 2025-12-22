import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface PendingUser {
  id: string;
  name: string;
  phone: string;
  team_id: string;
  team_name?: string;
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          phone,
          team_id,
          created_at,
          teams (
            name
          )
        `)
        .eq('role', 'team-leader')
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('대기 중인 사용자 로드 실패:', error);
        return;
      }

      const usersWithTeam = (data || []).map((user: any) => ({
        ...user,
        team_name: user.teams?.name || '팀 없음'
      }));

      setPendingUsers(usersWithTeam);
    } catch (error) {
      console.error('대기 중인 사용자 로드 실패:', error);
    }
  };

  const handleApprove = async (userId: string, approve: boolean) => {
    try {
      if (approve) {
        const { error } = await supabase
          .from('users')
          .update({ approved: true })
          .eq('id', userId);

        if (error) {
          console.error('승인 실패:', error);
          alert('승인에 실패했습니다');
          return;
        }

        setSuccessMessage('승인되었습니다');
      } else {
        if (!confirm('정말 거부하시겠습니까? 사용자 정보가 삭제됩니다.')) {
          return;
        }

        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) {
          console.error('거부 실패:', error);
          alert('거부에 실패했습니다');
          return;
        }

        setSuccessMessage('거부되었습니다');
      }

      fetchPendingUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('처리 실패:', error);
      alert('처리에 실패했습니다');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img
                src="/logo.png"
                alt="로고"
                className="h-8 sm:h-10 w-auto object-contain"
              />
              <h1 className="text-base sm:text-xl font-bold text-gray-800">관리자 페이지</h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap px-2 py-1"
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">가입 승인 관리</h2>
          <p className="text-sm sm:text-base text-gray-600">팀장 가입 신청을 검토하고 승인하세요 (대기: {pendingUsers.length}명)</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        {pendingUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <i className="ri-user-search-line text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-600">대기 중인 가입 신청이 없습니다</p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4">
              {pendingUsers.map((user) => (
                <div key={user.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">이름</p>
                        <p className="text-base font-semibold text-gray-800">{user.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">팀</p>
                        <p className="text-base font-medium text-gray-800">{user.team_name}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">전화번호</p>
                      <p className="text-base text-gray-800">{user.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">신청일</p>
                      <p className="text-base text-gray-800">
                        {new Date(user.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleApprove(user.id, true)}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleApprove(user.id, false)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
                    >
                      거부
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">이름</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">전화번호</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">팀</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">신청일</th>
                      <th className="px-6 py-4 text-center text-sm font-medium text-gray-700">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-800">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.phone}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.team_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center space-x-2">
                            <button
                              onClick={() => handleApprove(user.id, true)}
                              className="bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleApprove(user.id, false)}
                              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              거부
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
