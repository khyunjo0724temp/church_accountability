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
        return {
          user_id: userId,
          name: member?.name || '알 수 없음',
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
              <h1 className="text-xl font-bold text-gray-800">리포트</h1>
            </div>
            <div className="flex items-center space-x-6">
              <button
                onClick={() => navigate('/attendance')}
                className="text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap"
              >
                출석 체크
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="text-sm font-medium text-teal-600 border-b-2 border-teal-600 pb-1 cursor-pointer whitespace-nowrap"
              >
                리포트 조회
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-start space-x-2 mb-6">
            <button
              onClick={goToPrevious}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-xl text-gray-700"></i>
            </button>
            <div className="px-8 py-3 bg-teal-50 border-2 border-teal-500 rounded-lg min-w-[200px] text-center">
              <p className="text-lg font-bold text-teal-700">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={goToNext}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-xl text-gray-700"></i>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setPeriod('week');
                  setSelectedDate(getThisSunday());
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  period === 'week'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주간
              </button>
              <button
                onClick={() => {
                  setPeriod('month');
                  setSelectedDate(new Date());
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  period === 'month'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                월간
              </button>
              <button
                onClick={() => {
                  setPeriod('year');
                  setSelectedDate(new Date());
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  period === 'year'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                연간
              </button>
            </div>

            <button
              onClick={handleExport}
              className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-download-line text-sm"></i>
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">총 출석</p>
                <p className="text-3xl font-bold text-teal-600">
                  {reportData?.totals?.attendance || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                <i className="ri-user-follow-line text-2xl text-teal-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">총 결석</p>
                <p className="text-3xl font-bold text-orange-600">
                  {reportData?.totals?.absent || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <i className="ri-user-unfollow-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">개인별 점수</h3>
            <div className="space-y-3">
              {reportData?.per_user_points?.slice(0, 10).map((user, index) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-800">{user.name}</span>
                  </div>
                  <span className="font-bold text-teal-600">{user.points}점</span>
                </div>
              )) || (
                <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">결석 명단</h3>
            <div className="space-y-3">
              {reportData?.absentees?.map((absentee, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="font-medium text-gray-800">{absentee.name}</span>
                  <span className="text-sm text-gray-600">{absentee.phone}</span>
                </div>
              )) || (
                <p className="text-center text-gray-500 py-8">결석자가 없습니다</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
