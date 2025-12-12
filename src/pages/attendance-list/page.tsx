import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface AttendanceData {
  totalAttendance: number;
  regularAttendance: number;
  newbieAttendance: number;
  regularAbsent: number;
  absentees: Array<{
    name: string;
    phone: string;
  }>;
}

export default function AttendanceList() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getThisSunday());
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function getThisSunday(): Date {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 0 : -day;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + diff);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일`;
  }

  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedDate]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      const dateStr = formatDate(selectedDate);

      // 출석 기록 가져오기
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('member_id, present')
        .eq('team_id', user.team_id)
        .eq('week_start_date', dateStr);

      if (attendanceError) {
        console.error('출석 기록 로드 실패:', attendanceError);
      }

      // 멤버 정보 가져오기
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, name, phone, is_newbie')
        .eq('team_id', user.team_id);

      if (membersError) {
        console.error('멤버 로드 실패:', membersError);
      }

      // 총 출석
      const totalAttendance = attendanceRecords?.filter(r => r.present).length || 0;

      // 재적 출석
      const regularAttendance = attendanceRecords?.filter(r => {
        const member = membersData?.find(m => m.id === r.member_id);
        return r.present && member && !member.is_newbie;
      }).length || 0;

      // 새신자 출석
      const newbieAttendance = attendanceRecords?.filter(r => {
        const member = membersData?.find(m => m.id === r.member_id);
        return r.present && member && member.is_newbie;
      }).length || 0;

      // 재적 결석
      const regularAbsent = attendanceRecords?.filter(r => {
        const member = membersData?.find(m => m.id === r.member_id);
        return !r.present && member && !member.is_newbie;
      }).length || 0;

      // 결석자 명단 (재적만)
      const absentMemberIds = attendanceRecords
        ?.filter(r => !r.present)
        .map(r => r.member_id) || [];

      const absentees = membersData
        ?.filter(m => !m.is_newbie && absentMemberIds.includes(m.id))
        .map(m => ({
          name: m.name,
          phone: (m as any).phone || ''
        })) || [];

      setAttendanceData({
        totalAttendance,
        regularAttendance,
        newbieAttendance,
        regularAbsent,
        absentees
      });

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #FAFAFA 0%, #FFFFFF 100%)' }}>
      {/* 헤더 */}
      <nav className="bg-white/80 backdrop-blur-lg" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="https://public.readdy.ai/ai/img_res/6f5f4709-4636-4b57-8f60-15ce4bfa71df.png"
              alt="로고"
              className="h-8 w-auto object-contain"
            />
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
          >
            <i className="ri-menu-line text-xl text-gray-700"></i>
          </button>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-lg font-bold text-gray-900">메뉴</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-gray-900"></i>
            </button>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                navigate('/attendance');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 text-gray-700 rounded-lg font-medium cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-checkbox-circle-line text-xl text-gray-600"></i>
              <span className="text-gray-900">출석 체크</span>
            </button>
            <button
              onClick={() => {
                navigate('/attendance-list');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors"
              style={{ backgroundColor: '#1E88E5', color: 'white' }}
            >
              <i className="ri-file-list-3-line text-xl" style={{ color: 'white' }}></i>
              <span style={{ color: 'white' }}>재적 명단</span>
            </button>
            <button
              onClick={() => {
                navigate('/reports');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 text-gray-700 rounded-lg font-medium cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-user-add-line text-xl text-gray-600"></i>
              <span className="text-gray-900">전도 명단</span>
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-md mx-auto px-5 py-5">
        {/* 날짜 선택 */}
        <div className="mb-5">
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={goToPreviousWeek}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
              disabled={loading}
            >
              <i className="ri-arrow-left-s-line text-2xl text-gray-700"></i>
            </button>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
              disabled={loading}
            >
              <i className="ri-arrow-right-s-line text-2xl text-gray-700"></i>
            </button>
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-3">
              <i className="ri-loader-4-line text-5xl animate-spin" style={{ color: '#1E88E5' }}></i>
              <span className="text-lg font-medium text-gray-900">로딩 중...</span>
            </div>
          </div>
        )}

        {/* 총 출석 & 출석 통계 카드 */}
        <div className="bg-white rounded-3xl p-8 mb-6" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)' }}>
          {/* 총 출석 헤더 */}
          <div className="mb-8 pb-8 border-b border-gray-100">
            <div className="flex items-baseline space-x-3">
              <h1 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">총출석</h1>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                {attendanceData?.totalAttendance || 0}
              </span>
              <span className="text-xl font-medium text-gray-400">명</span>
            </div>
          </div>

          {/* 출석 현황 */}
          <h2 className="text-sm font-semibold text-gray-700 mb-8">출석 현황</h2>
          <div className="space-y-6">
            {/* 재적 출석 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50/50 flex items-center justify-center">
                  <i className="ri-user-line text-lg" style={{ color: '#1E88E5' }}></i>
                </div>
                <span className="text-base font-medium text-gray-700">재적 출석</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {attendanceData?.regularAttendance || 0}
              </span>
            </div>

            {/* 새신자 출석 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-2xl bg-green-50/50 flex items-center justify-center">
                  <i className="ri-user-add-line text-lg text-green-600"></i>
                </div>
                <span className="text-base font-medium text-gray-700">새신자 출석</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {attendanceData?.newbieAttendance || 0}
              </span>
            </div>

            {/* 재적 결석 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-2xl bg-gray-100/80 flex items-center justify-center">
                  <i className="ri-user-unfollow-line text-lg text-gray-500"></i>
                </div>
                <span className="text-base font-medium text-gray-700">재적 결석</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {attendanceData?.regularAbsent || 0}
              </span>
            </div>
          </div>
        </div>

        {/* 결석 명단 카드 */}
        <div className="bg-white rounded-3xl p-8" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)' }}>
          <h2 className="text-sm font-semibold text-gray-700 mb-6">결석 명단</h2>
          <div className="space-y-3">
            {attendanceData?.absentees && attendanceData.absentees.length > 0 ? (
              attendanceData.absentees.map((absentee, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-4 px-5 bg-gray-50/50 hover:bg-gray-100/50 rounded-2xl transition-all"
                >
                  <span className="text-base font-semibold text-gray-900">{absentee.name}</span>
                  <span className="text-sm font-mono text-gray-500">{absentee.phone}</span>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-check-line text-2xl text-gray-400"></i>
                </div>
                <p className="text-base font-medium text-gray-500">결석자가 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">모든 재적 멤버가 출석했습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
