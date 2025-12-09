import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  weeklyAttendance: number;
  weeklyAbsent: number;
  weeklyPoints: number;
  monthlyPoints: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    weeklyAttendance: 0,
    weeklyAbsent: 0,
    weeklyPoints: 0,
    monthlyPoints: 0
  });
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);

      // 이번 주 일요일 계산
      const today = new Date();
      const day = today.getDay();
      const diff = day === 0 ? 0 : -day;
      const thisSunday = new Date(today);
      thisSunday.setDate(today.getDate() + diff);
      thisSunday.setHours(0, 0, 0, 0);

      const year = thisSunday.getFullYear();
      const month = String(thisSunday.getMonth() + 1).padStart(2, '0');
      const dayStr = String(thisSunday.getDate()).padStart(2, '0');
      const weekStartDate = `${year}-${month}-${dayStr}`;

      // 이번 주 출석 기록 가져오기
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('present, member_id')
        .eq('team_id', user.team_id)
        .eq('week_start_date', weekStartDate);

      if (attendanceError) {
        console.error('출석 기록 로드 실패:', attendanceError);
      }

      // 전체 멤버 수 가져오기
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id')
        .eq('team_id', user.team_id);

      if (membersError) {
        console.error('멤버 로드 실패:', membersError);
      }

      const totalMembers = membersData?.length || 0;
      const attendance = attendanceData?.filter(r => r.present).length || 0;
      const absent = totalMembers - attendance;

      // 포인트 데이터 (임시로 0)
      // TODO: points 테이블에서 실제 데이터 가져오기

      setStats({
        weeklyAttendance: attendance,
        weeklyAbsent: absent,
        weeklyPoints: 0,
        monthlyPoints: 0
      });
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('remember_device');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="https://public.readdy.ai/ai/img_res/6f5f4709-4636-4b57-8f60-15ce4bfa71df.png" 
                alt="로고" 
                className="h-10 w-auto object-contain"
              />
              <h1 className="text-xl font-bold text-gray-800">출석 관리</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.name}님</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">빠른 액션</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/attendance')}
              className="flex items-center justify-center space-x-3 bg-teal-600 hover:bg-teal-700 text-white font-medium py-4 px-6 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-checkbox-circle-line text-2xl"></i>
              <span>출석 체크</span>
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="flex items-center justify-center space-x-3 bg-purple-600 hover:bg-purple-700 text-white font-medium py-4 px-6 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-bar-chart-box-line text-2xl"></i>
              <span>리포트 조회</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}