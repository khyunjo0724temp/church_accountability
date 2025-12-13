import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ReportData {
  totals: {
    attendance: number;
    regularAttendance: number;
    newbieAttendance: number;
    absent: number;
    weeklyPoints: number;
    monthlyPoints: number;
    yearlyPoints: number;
  };
  per_user_points: Array<{
    user_id: string;
    name: string;
    points: number;
    referredMembers: Array<{ name: string; phone: string; date: string }>;
  }>;
  absentees: Array<{
    name: string;
    phone: string;
  }>;
  // 주간 출석 현황 데이터 (주간 탭에서만 사용)
  weeklyAttendance?: {
    totalAttendance: number;
    regularAttendance: number;
    newbieAttendance: number;
    regularAbsent: number;
    regularAttendees: Array<{ id: string; name: string; phone: string }>;
    newbieAttendees: Array<{ id: string; name: string; phone: string }>;
    absentees: Array<{ id: string; name: string; phone: string }>;
  };
}

export default function Reports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedReferrer, setSelectedReferrer] = useState<{
    name: string;
    members: Array<{ name: string; phone: string; date: string }>;
  } | null>(null);
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

  const [selectedDate, setSelectedDate] = useState(getThisSunday());

  useEffect(() => {
    fetchReport();
  }, [period, selectedDate]);

  function formatDisplayDate(date: Date): string {
    if (period === 'week') {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}월 ${day}일 주일`;
    } else if (period === 'month') {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return `${year}년 ${month}월`;
    } else {
      return `${date.getFullYear()}년`;
    }
  }

  function formatTitleDate(date: Date): string {
    if (period === 'week') {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}월 ${day}일`;
    } else if (period === 'month') {
      const month = date.getMonth() + 1;
      return `${month}월`;
    } else {
      return `${date.getFullYear()}년`;
    }
  }

  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (period === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (period === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (period === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (period === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setSelectedDate(newDate);
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);

      // URL 파라미터에서 team_id 가져오기 (목사님이 특정 팀 조회할 때)
      // 없으면 로그인한 사용자의 team_id 사용
      const teamId = searchParams.get('team_id') || user.team_id;

      // 팀 정보 가져오기
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      if (teamData) {
        setTeamName(teamData.name);
      }

      let startDate = '';
      let endDate = '';

      if (period === 'week') {
        // 주간: 선택된 일요일 하나만
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        startDate = `${year}-${month}-${day}`;
        endDate = startDate;
      } else if (period === 'month') {
        // 월간: 해당 월의 모든 일요일
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      } else {
        // 연간: 해당 년도의 모든 일요일
        const year = selectedDate.getFullYear();
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }

      // 출석 기록 가져오기
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('member_id, present, week_start_date')
        .eq('team_id', teamId)
        .gte('week_start_date', startDate)
        .lte('week_start_date', endDate);

      if (attendanceError) {
        console.error('출석 기록 로드 실패:', attendanceError);
      }

      // 전체 멤버 수 가져오기
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, name, phone, is_newbie, is_team_leader')
        .eq('team_id', teamId);

      if (membersError) {
        console.error('멤버 로드 실패:', membersError);
      }

      // referrals 데이터 가져오기
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('new_member_id, referrer_id, date')
        .eq('team_id', teamId);

      if (referralsError) {
        console.error('전도 관계 로드 실패:', referralsError);
      }

      const totalMembers = membersData?.length || 0;
      const totalAttendance = attendanceData?.filter(r => r.present).length || 0;
      // 재적 멤버의 결석만 계산 (새신자는 결석 기록이 없음)
      const totalAbsent = attendanceData?.filter(r => !r.present).length || 0;

      // 재적 출석 계산
      const regularAttendance = attendanceData?.filter(r => {
        const member = membersData?.find(m => m.id === r.member_id);
        return r.present && member && !member.is_newbie;
      }).length || 0;

      // 새신자 출석 계산
      const newbieAttendance = attendanceData?.filter(r => {
        const member = membersData?.find(m => m.id === r.member_id);
        return r.present && member && member.is_newbie;
      }).length || 0;

      // 결석자 찾기 (가장 최근 주에서, 재적 멤버만)
      const latestWeek = attendanceData?.reduce((latest, record) => {
        return record.week_start_date > latest ? record.week_start_date : latest;
      }, '');

      const latestRecords = attendanceData?.filter(r => r.week_start_date === latestWeek) || [];
      const absentMemberIds = latestRecords
        .filter(r => !r.present)
        .map(r => r.member_id);

      // 재적 멤버(새신자가 아닌 사람) 중 결석자만
      const absentees = membersData
        ?.filter(m => !m.is_newbie && absentMemberIds.includes(m.id))
        .map(m => ({
          name: m.name,
          phone: (m as any).phone || ''
        })) || [];

      // 점수 계산 및 전도 명단 저장
      const pointsMap = new Map<string, { count: number; members: Array<{ name: string; phone: string; date: string }> }>();

      // 출석한 새신자들에 대해 점수 계산
      const presentRecords = attendanceData?.filter(r => r.present) || [];

      for (const record of presentRecords) {
        const member = membersData?.find(m => m.id === record.member_id);

        // 새신자만 점수 계산 (새신자 본인은 점수 없음)
        if (member?.is_newbie) {
          // 이 새신자를 전도한 사람 찾기
          const referral = referralsData?.find(r => r.new_member_id === member.id);

          if (referral) {
            let referrerId = referral.referrer_id;

            // 전도자가 새신자인지 확인
            const referrer = membersData?.find(m => m.id === referrerId);

            if (referrer?.is_newbie) {
              // 전도자도 새신자라면, 그 새신자의 전도자에게 점수
              const referrerReferral = referralsData?.find(r => r.new_member_id === referrerId);
              if (referrerReferral) {
                referrerId = referrerReferral.referrer_id;
              }
            }

            // 최종 전도자에게 점수 추가 및 명단 저장
            const current = pointsMap.get(referrerId) || { count: 0, members: [] };
            current.count += 1;

            // 출석 날짜 포맷팅 (record.week_start_date를 사용)
            const attendanceDate = new Date(record.week_start_date);
            const month = attendanceDate.getMonth() + 1;
            const day = attendanceDate.getDate();
            const formattedDate = `${month}월 ${day}일`;

            current.members.push({
              name: member.name,
              phone: (member as any).phone || '',
              date: formattedDate
            });
            pointsMap.set(referrerId, current);
          }
        }
      }

      // 점수를 배열로 변환하고 정렬
      const perUserPoints = Array.from(pointsMap.entries()).map(([userId, data]) => {
        const member = membersData?.find(m => m.id === userId);
        let userName = '알 수 없음';

        if (member) {
          userName = member.name;
        } else if (userId === user.id) {
          // members에 없으면 팀장(로그인한 사용자)인지 확인
          userName = user.name;
        }

        return {
          user_id: userId,
          name: userName,
          points: data.count,
          referredMembers: data.members
        };
      }).sort((a, b) => b.points - a.points);

      // 총 점수 계산
      const totalPoints = Array.from(pointsMap.values()).reduce((sum, p) => sum + p.count, 0);

      // 주간 탭일 때만 출석 현황 데이터 추가
      let weeklyAttendanceData = undefined;
      if (period === 'week') {
        // 재적 출석자 명단
        const regularAttendeeMemberIds = attendanceData
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

        // 재적 결석자 명단
        const absentMemberIds = attendanceData
          ?.filter(r => !r.present)
          .map(r => r.member_id) || [];

        const absenteesWithId = membersData
          ?.filter(m => !m.is_newbie && absentMemberIds.includes(m.id))
          .map(m => ({
            id: m.id,
            name: m.name,
            phone: (m as any).phone || ''
          })) || [];

        // 재적 결석 수 계산
        const regularAbsent = attendanceData?.filter(r => {
          const member = membersData?.find(m => m.id === r.member_id);
          return !r.present && member && !member.is_newbie;
        }).length || 0;

        weeklyAttendanceData = {
          totalAttendance: totalAttendance,
          regularAttendance: regularAttendance,
          newbieAttendance: newbieAttendance,
          regularAbsent: regularAbsent,
          regularAttendees: regularAttendees,
          newbieAttendees: newbieAttendees,
          absentees: absenteesWithId
        };
      }

      setReportData({
        totals: {
          attendance: totalAttendance,
          regularAttendance: regularAttendance,
          newbieAttendance: newbieAttendance,
          absent: totalAbsent,
          weeklyPoints: period === 'week' ? totalPoints : 0,
          monthlyPoints: period === 'month' ? totalPoints : 0,
          yearlyPoints: period === 'year' ? totalPoints : 0
        },
        per_user_points: perUserPoints,
        absentees: absentees,
        weeklyAttendance: weeklyAttendanceData
      });
    } catch (error) {
      console.error('리포트 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    alert('CSV 내보내기 기능은 곧 제공됩니다');
  };

  const totalPoints = period === 'week' ? (reportData?.totals?.weeklyPoints || 0) :
    period === 'month' ? (reportData?.totals?.monthlyPoints || 0) :
    (reportData?.totals?.yearlyPoints || 0);

  // 목사님이 조회하는 경우인지 확인 (team_id 파라미터가 있으면 목사님 조회)
  const isPastorView = searchParams.get('team_id') !== null;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #FAFAFA 0%, #FFFFFF 100%)' }}>
      {/* 헤더 (목사님 조회시에는 숨김) */}
      {!isPastorView && (
        <nav className="bg-white/80 backdrop-blur-lg" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
          <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center">
              <img
                src="https://public.readdy.ai/ai/img_res/6f5f4709-4636-4b57-8f60-15ce4bfa71df.png"
                alt="로고"
                className="h-7 w-auto object-contain"
              />
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-menu-line text-xl text-gray-700"></i>
            </button>
          </div>
        </nav>
      )}

      {/* Sidebar Overlay (목사님 조회시에는 숨김) */}
      {!isPastorView && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar (목사님 조회시에는 숨김) */}
      {!isPastorView && (
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
                  navigate('/reports');
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors"
                style={{ backgroundColor: '#1E88E5', color: 'white' }}
              >
                <i className="ri-bar-chart-line text-xl" style={{ color: 'white' }}></i>
                <span style={{ color: 'white' }}>출석 & 전도</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="max-w-md mx-auto px-5 py-5">

        {/* 날짜 선택 */}
        <div className="mb-5">
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={goToPrevious}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-2xl text-gray-700"></i>
            </button>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={goToNext}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
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

        {/* Segmented Control 탭 */}
        <div className="bg-white rounded-xl p-1 mb-5 shadow-sm">
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => {
                setPeriod('week');
                setSelectedDate(getThisSunday());
              }}
              className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                period === 'week'
                  ? ''
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={period === 'week' ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
            >
              주간
            </button>
            <button
              onClick={() => {
                setPeriod('month');
                setSelectedDate(new Date());
              }}
              className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                period === 'month'
                  ? ''
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={period === 'month' ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
            >
              월간
            </button>
            <button
              onClick={() => {
                setPeriod('year');
                setSelectedDate(new Date());
              }}
              className={`py-2 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                period === 'year'
                  ? ''
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={period === 'year' ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
            >
              연간
            </button>
          </div>
        </div>

        {/* 출석 현황 카드 (주간 탭에서만 표시) */}
        {period === 'week' && reportData?.weeklyAttendance && (
          <div className="bg-white rounded-3xl p-8 mb-6" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)' }}>
            {/* 총 출석 헤더 */}
            <div className="mb-8 pb-8 border-b border-gray-100">
              <div className="flex items-baseline space-x-3">
                <h1 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{teamName} 총출석</h1>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                  {reportData.weeklyAttendance.totalAttendance || 0}
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
                    members: reportData.weeklyAttendance?.regularAttendees || []
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
                    {reportData.weeklyAttendance.regularAttendance || 0}
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
                    members: reportData.weeklyAttendance?.newbieAttendees || []
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
                    {reportData.weeklyAttendance.newbieAttendance || 0}
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
                    members: reportData.weeklyAttendance?.absentees || []
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
                    {reportData.weeklyAttendance.regularAbsent || 0}
                  </span>
                  <i className="ri-arrow-right-s-line text-xl text-gray-400"></i>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 전도 인원 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <div className="space-y-4">
            {/* 총 전도 인원 원형 그래프 */}
            <div className="py-6 flex flex-col items-center justify-center border-b border-gray-100">
              <div className="relative w-32 h-32 mb-4">
                {/* 배경 원 */}
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#E5E7EB"
                    strokeWidth="12"
                    fill="none"
                  />
                  {/* 진행 원 */}
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#1E88E5"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - Math.min(totalPoints / 50, 1))}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                {/* 중앙 텍스트 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color: '#1E88E5' }}>{totalPoints}</p>
                    <p className="text-xs text-gray-600 font-medium">명</p>
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{teamName} {formatTitleDate(selectedDate)} 총 전도 인원</h3>
            </div>

            {/* 개인별 전도 인원 리스트 */}
            {reportData?.per_user_points && reportData.per_user_points.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-6">개인별 전도인원</h3>
                <div className="space-y-3">
                  {reportData.per_user_points.slice(0, 10).map((user, index) => (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between py-4 px-5 bg-gray-50/50 hover:bg-gray-100/50 rounded-2xl transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedReferrer({
                          name: user.name,
                          members: user.referredMembers || []
                        });
                        setShowReferralModal(true);
                      }}
                    >
                      <span className="text-base font-semibold text-gray-900">{user.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-gray-500">{user.points}명</span>
                        <i className="ri-arrow-right-s-line text-lg text-gray-400"></i>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 전도 명단 모달 */}
        {showReferralModal && selectedReferrer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
              {/* 모달 헤더 */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedReferrer.name} {formatTitleDate(selectedDate)} 전도 횟수
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">총 {selectedReferrer.members?.length || 0}명</p>
                  </div>
                  <button
                    onClick={() => setShowReferralModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-close-line text-2xl text-gray-700"></i>
                  </button>
                </div>
              </div>

              {/* 모달 내용 */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {selectedReferrer.members && selectedReferrer.members.length > 0 ? (
                    selectedReferrer.members.map((member, index) => (
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
                          {member.date}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-500">전도 명단이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 모달 푸터 */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowReferralModal(false)}
                  className="w-full py-3 rounded-lg font-semibold text-white transition-colors cursor-pointer"
                  style={{ backgroundColor: '#1E88E5' }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}
