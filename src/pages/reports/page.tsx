import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ReportData {
  totals: {
    attendance: number;
    absent: number;
    weeklyPoints: number;
    monthlyPoints: number;
  };
  per_user_points: Array<{
    user_id: string;
    name: string;
    points: number;
  }>;
  absentees: Array<{
    name: string;
    phone: string;
  }>;
}

export default function Reports() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      return `${month}월 ${day}일`;
    } else if (period === 'month') {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return `${year}년 ${month}월`;
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
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);

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
        .eq('team_id', user.team_id)
        .gte('week_start_date', startDate)
        .lte('week_start_date', endDate);

      if (attendanceError) {
        console.error('출석 기록 로드 실패:', attendanceError);
      }

      // 전체 멤버 수 가져오기
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, name, phone, is_newbie, is_team_leader')
        .eq('team_id', user.team_id);

      if (membersError) {
        console.error('멤버 로드 실패:', membersError);
      }

      // referrals 데이터 가져오기
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('new_member_id, referrer_id')
        .eq('team_id', user.team_id);

      if (referralsError) {
        console.error('전도 관계 로드 실패:', referralsError);
      }

      const totalMembers = membersData?.length || 0;
      const totalAttendance = attendanceData?.filter(r => r.present).length || 0;
      // 재적 멤버의 결석만 계산 (새신자는 결석 기록이 없음)
      const totalAbsent = attendanceData?.filter(r => !r.present).length || 0;

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

      // 점수 계산
      const pointsMap = new Map<string, number>();

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

            // 최종 전도자에게 점수 추가
            pointsMap.set(referrerId, (pointsMap.get(referrerId) || 0) + 1);
          }
        }
      }

      // 점수를 배열로 변환하고 정렬
      const perUserPoints = Array.from(pointsMap.entries()).map(([userId, points]) => {
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
          points: points
        };
      }).sort((a, b) => b.points - a.points);

      // 총 점수 계산
      const totalPoints = Array.from(pointsMap.values()).reduce((sum, p) => sum + p, 0);

      setReportData({
        totals: {
          attendance: totalAttendance,
          absent: totalAbsent,
          weeklyPoints: period === 'week' ? totalPoints : 0,
          monthlyPoints: period === 'month' ? totalPoints : 0
        },
        per_user_points: perUserPoints,
        absentees: absentees
      });
    } catch (error) {
      console.error('리포트 로드 실패:', error);
    }
  };

  const handleExport = () => {
    alert('CSV 내보내기 기능은 곧 제공됩니다');
  };

  const totalPoints = period === 'week' ? (reportData?.totals?.weeklyPoints || 0) :
    period === 'month' ? (reportData?.totals?.monthlyPoints || 0) :
    (reportData?.totals?.weeklyPoints || 0);

  return (
    <div className="min-h-screen bg-page">
      {/* 헤더 */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img
              src="https://public.readdy.ai/ai/img_res/6f5f4709-4636-4b57-8f60-15ce4bfa71df.png"
              alt="로고"
              className="h-7 w-auto object-contain"
            />
            <h1 className="text-lg font-bold text-gray-900">리포트</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
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
                navigate('/reports');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors"
              style={{ backgroundColor: '#1E88E5', color: 'white' }}
            >
              <i className="ri-bar-chart-box-line text-xl" style={{ color: 'white' }}></i>
              <span style={{ color: 'white' }}>리포트 조회</span>
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
              onClick={goToPrevious}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-2xl text-gray-700"></i>
            </button>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
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

        {/* 재적 출석 현황 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            재적 출석 현황
          </h2>

          {/* 출석/결석 통계 */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-primary-50 rounded-xl p-4 text-center">
              <div className="flex justify-center mb-2">
                <i className="ri-user-follow-line text-2xl text-primary-600"></i>
              </div>
              <p className="text-xs font-medium text-gray-600 mb-1">총 출석</p>
              <p className="text-2xl font-bold text-primary-600">
                {reportData?.totals?.attendance || 0}
              </p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <div className="flex justify-center mb-2">
                <i className="ri-user-unfollow-line text-2xl text-gray-600"></i>
              </div>
              <p className="text-xs font-medium text-gray-600 mb-1">총 결석</p>
              <p className="text-2xl font-bold text-gray-900">
                {reportData?.totals?.absent || 0}
              </p>
            </div>
          </div>

          {/* 결석 명단 */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">결석 명단</h3>
            <div className="space-y-2">
              {reportData?.absentees && reportData.absentees.length > 0 ? (
                reportData.absentees.map((absentee, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{absentee.name}</span>
                    <span className="text-xs text-gray-600">{absentee.phone}</span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-gray-500">결석자가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 전도 점수 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-5">
            전도 점수
          </h2>

          {/* 원형 프로그레스 + 총점 */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative w-36 h-36 mb-3">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* 배경 원 */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#E3F2FD"
                  strokeWidth="8"
                />
                {/* 진행 원 */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#1E88E5"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(totalPoints / Math.max(totalPoints, 10)) * 264} 264`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-primary-600">{totalPoints}</p>
                <p className="text-xs text-gray-600 font-medium">점</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 font-medium">총 전도 점수</p>
          </div>

          {/* 개인별 점수 리스트 */}
          {reportData?.per_user_points && reportData.per_user_points.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">개인별 점수</h3>
              <div className="space-y-2">
                {reportData.per_user_points.slice(0, 10).map((user, index) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {/* 순위 숫자 */}
                      <span className="text-sm font-semibold text-gray-600 w-5">
                        {index + 1}
                      </span>
                      {/* 이름 */}
                      <span className="text-sm font-semibold text-gray-900">
                        {user.name}
                      </span>
                    </div>
                    {/* 점수 */}
                    <span className="text-base font-bold text-primary-600">
                      {user.points}점
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
