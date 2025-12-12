import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface AttendanceData {
  totalAttendance: number;
  regularAttendance: number;
  newbieAttendance: number;
  regularAbsent: number;
  absentees: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  regularAttendees: Array<{
    id: string;
    name: string;
    phone: string;
  }>;
  newbieAttendees: Array<{
    id: string;
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
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ name: string; dates: string[] } | null>(null);
  const [teamName, setTeamName] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [listModalData, setListModalData] = useState<{ title: string; members: Array<{ name: string; phone: string }> } | null>(null);

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
    return `${month}월 ${day}일 주일`;
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

      // 팀 정보 가져오기
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', user.team_id)
        .single();

      if (teamData) {
        setTeamName(teamData.name);
      }

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

      // 재적 출석자 명단
      const regularAttendeeMemberIds = attendanceRecords
        ?.filter(r => r.present)
        .map(r => r.member_id) || [];

      const regularAttendees = membersData
        ?.filter(m => !m.is_newbie && regularAttendeeMemberIds.includes(m.id))
        .map(m => ({
          id: m.id,
          name: m.name,
          phone: (m as any).phone || ''
        })) || [];

      // 새신자 출석자 명단
      const newbieAttendees = membersData
        ?.filter(m => m.is_newbie && regularAttendeeMemberIds.includes(m.id))
        .map(m => ({
          id: m.id,
          name: m.name,
          phone: (m as any).phone || ''
        })) || [];

      // 결석자 명단 (재적만)
      const absentMemberIds = attendanceRecords
        ?.filter(r => !r.present)
        .map(r => r.member_id) || [];

      const absentees = membersData
        ?.filter(m => !m.is_newbie && absentMemberIds.includes(m.id))
        .map(m => ({
          id: m.id,
          name: m.name,
          phone: (m as any).phone || ''
        })) || [];

      setAttendanceData({
        totalAttendance,
        regularAttendance,
        newbieAttendance,
        regularAbsent,
        absentees,
        regularAttendees,
        newbieAttendees
      });

    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberAttendanceHistory = async (memberId: string, memberName: string) => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);

      // 해당 멤버의 결석 기록 가져오기 (present = false인 것만)
      const { data: records, error } = await supabase
        .from('attendance_records')
        .select('week_start_date')
        .eq('member_id', memberId)
        .eq('team_id', user.team_id)
        .eq('present', false)
        .order('week_start_date', { ascending: false });

      if (error) {
        console.error('결석 이력 로드 실패:', error);
        return;
      }

      const dates = records?.map(r => {
        const date = new Date(r.week_start_date);
        return formatDisplayDate(date);
      }) || [];

      setSelectedMember({ name: memberName, dates });
      setShowAttendanceModal(true);
    } catch (error) {
      console.error('결석 이력 로드 실패:', error);
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
              <h1 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{teamName} 총출석</h1>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                {attendanceData?.totalAttendance || 0}
              </span>
              <span className="text-xl font-medium text-gray-400">명</span>
            </div>
          </div>

          {/* 출석 현황 */}
          <h2 className="text-sm font-semibold text-gray-700 mb-8">{teamName} 출석 현황</h2>
          <div className="space-y-6">
            {/* 재적 출석 */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50/50 transition-all cursor-pointer"
              onClick={() => {
                setListModalData({
                  title: '재적 출석',
                  members: attendanceData?.regularAttendees || []
                });
                setShowListModal(true);
              }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50/50 flex items-center justify-center">
                  <i className="ri-user-line text-lg" style={{ color: '#1E88E5' }}></i>
                </div>
                <span className="text-base font-medium text-gray-700">재적 출석</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  {attendanceData?.regularAttendance || 0}
                </span>
                <i className="ri-arrow-right-s-line text-xl text-gray-400"></i>
              </div>
            </div>

            {/* 새신자 출석 */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50/50 transition-all cursor-pointer"
              onClick={() => {
                setListModalData({
                  title: '새신자 출석',
                  members: attendanceData?.newbieAttendees || []
                });
                setShowListModal(true);
              }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-2xl bg-green-50/50 flex items-center justify-center">
                  <i className="ri-user-add-line text-lg text-green-600"></i>
                </div>
                <span className="text-base font-medium text-gray-700">새신자 출석</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  {attendanceData?.newbieAttendance || 0}
                </span>
                <i className="ri-arrow-right-s-line text-xl text-gray-400"></i>
              </div>
            </div>

            {/* 재적 결석 */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50/50 transition-all cursor-pointer"
              onClick={() => {
                setListModalData({
                  title: '재적 결석',
                  members: attendanceData?.absentees || []
                });
                setShowListModal(true);
              }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-2xl bg-gray-100/80 flex items-center justify-center">
                  <i className="ri-user-unfollow-line text-lg text-gray-500"></i>
                </div>
                <span className="text-base font-medium text-gray-700">재적 결석</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">
                  {attendanceData?.regularAbsent || 0}
                </span>
                <i className="ri-arrow-right-s-line text-xl text-gray-400"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 명단 모달 */}
      {showListModal && listModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{listModalData.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">총 {listModalData.members?.length || 0}명</p>
                </div>
                <button
                  onClick={() => setShowListModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-700"></i>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                {listModalData.members && listModalData.members.length > 0 ? (
                  listModalData.members.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-gray-600 w-6">
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {member.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-600">
                        {member.phone}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">명단이 없습니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowListModal(false)}
                className="w-full py-3 rounded-lg font-semibold text-white transition-colors cursor-pointer"
                style={{ backgroundColor: '#1E88E5' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 출석 이력 모달 */}
      {showAttendanceModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedMember.name}님의 결석 기록</h3>
                  <p className="text-sm text-gray-600 mt-1">총 {selectedMember.dates?.length || 0}회</p>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl text-gray-700"></i>
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                {selectedMember.dates && selectedMember.dates.length > 0 ? (
                  selectedMember.dates.map((date, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-gray-600 w-6">
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {date}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">결석 기록이 없습니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="w-full py-3 rounded-lg font-semibold text-white transition-colors cursor-pointer"
                style={{ backgroundColor: '#1E88E5' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
