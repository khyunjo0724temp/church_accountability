import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

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
    newbieAttendees: Array<{ id: string; name: string; phone: string; referrer_name?: string }>;
    absentees: Array<{ id: string; name: string; phone: string; absence_reason?: string }>;
  };
}

interface Team {
  id: string;
  name: string;
  team_color: string;
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
  const [listModalData, setListModalData] = useState<{ title: string; members: Array<{ name: string; phone: string; absence_reason?: string; referrer_name?: string }> } | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<any>(null);

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
    // 초기 로드 시 user와 teams 가져오기
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      // pastor인 경우 teams 목록 가져오기
      if (parsedUser.role === 'pastor') {
        fetchTeams();
      }
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [period, selectedDate, searchParams]);

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
    }
  };

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

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

      // URL 파라미터 확인
      const viewAll = searchParams.get('view') === 'all'; // 전체보기 여부
      const teamColorParam = searchParams.get('team_color'); // 청팀/백팀
      const teamIdParam = searchParams.get('team_id');

      let teamId = null;
      let teamIds: string[] = []; // 청팀/백팀 필터링용

      if (viewAll) {
        setTeamName('전체 팀');
      } else if (teamColorParam) {
        // 청팀 또는 백팀 필터링
        const { data: colorTeams } = await supabase
          .from('teams')
          .select('id, name')
          .eq('team_color', teamColorParam);

        teamIds = colorTeams?.map(t => t.id) || [];
        setTeamName(teamColorParam);
      } else {
        // 개별 팀
        teamId = teamIdParam || user.team_id;
        const { data: teamData } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .single();

        if (teamData) {
          setTeamName(teamData.name);
        }
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
      let attendanceData = null;
      let attendanceError = null;

      if (viewAll || teamId || (teamIds.length > 0)) {
        let attendanceQuery = supabase
          .from('attendance_records')
          .select('member_id, present, week_start_date, absence_reason')
          .gte('week_start_date', startDate)
          .lte('week_start_date', endDate);

        if (teamId) {
          attendanceQuery = attendanceQuery.eq('team_id', teamId);
        } else if (teamIds.length > 0) {
          attendanceQuery = attendanceQuery.in('team_id', teamIds);
        }
        // viewAll이면 필터링 안 함

        const result = await attendanceQuery;
        attendanceData = result.data;
        attendanceError = result.error;
      }

      if (attendanceError) {
        console.error('출석 기록 로드 실패:', attendanceError);
      }

      // 전체 멤버 수 가져오기
      let membersData = null;
      let membersError = null;

      if (viewAll || teamId || (teamIds.length > 0)) {
        let membersQuery = supabase
          .from('members')
          .select('id, name, phone, is_newbie, is_team_leader');

        if (teamId) {
          membersQuery = membersQuery.eq('team_id', teamId);
        } else if (teamIds.length > 0) {
          membersQuery = membersQuery.in('team_id', teamIds);
        }
        // viewAll이면 필터링 안 함

        const result = await membersQuery;
        membersData = result.data;
        membersError = result.error;
      }

      if (membersError) {
        console.error('멤버 로드 실패:', membersError);
      }

      // referrals 데이터 가져오기
      let referralsData = null;
      let referralsError = null;

      if (viewAll || teamId || (teamIds.length > 0)) {
        let referralsQuery = supabase
          .from('referrals')
          .select('new_member_id, referrer_id, date');

        if (teamId) {
          referralsQuery = referralsQuery.eq('team_id', teamId);
        } else if (teamIds.length > 0) {
          referralsQuery = referralsQuery.in('team_id', teamIds);
        }
        // viewAll이면 필터링 안 함

        const result = await referralsQuery;
        referralsData = result.data;
        referralsError = result.error;
      }

      if (referralsError) {
        console.error('전도 관계 로드 실패:', referralsError);
      }

      // users 테이블에서 전도자 정보 가져오기 (members에 없는 팀장들)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, phone');

      if (usersError) {
        console.error('사용자 로드 실패:', usersError);
      }

      // 출석 기록이 있는지 확인 (한 명이라도 체크했는지)
      const hasAttendanceRecords = (attendanceData?.length || 0) > 0;

      const totalMembers = membersData?.length || 0;

      let totalAttendance = 0;
      let totalAbsent = 0;
      let regularAttendance = 0;
      let newbieAttendance = 0;
      let absentees: Array<{ name: string; phone: string }> = [];

      if (hasAttendanceRecords) {
        // 출석 기록이 있으면: 체크 안 된 재적 멤버는 결석 처리

        // 재적 멤버만 필터링
        const regularMembers = membersData?.filter(m => !m.is_newbie) || [];

        // 재적 출석 계산
        regularAttendance = attendanceData?.filter(r => {
          const member = membersData?.find(m => m.id === r.member_id);
          return r.present && member && !member.is_newbie;
        }).length || 0;

        // 재적 결석 계산: 재적 전체 - 재적 출석
        totalAbsent = regularMembers.length - regularAttendance;

        // 새신자 출석 계산
        newbieAttendance = attendanceData?.filter(r => {
          const member = membersData?.find(m => m.id === r.member_id);
          return r.present && member && member.is_newbie;
        }).length || 0;

        // 총 출석: 재적 출석 + 새신자 출석
        totalAttendance = regularAttendance + newbieAttendance;

        // 결석자 찾기: 출석 기록이 없거나 present=false인 재적 멤버
        const presentMemberIds = attendanceData
          ?.filter(r => r.present)
          .map(r => r.member_id) || [];

        absentees = regularMembers
          .filter(m => !presentMemberIds.includes(m.id))
          .map(m => ({
            name: m.name,
            phone: (m as any).phone || ''
          }));
      } else {
        // 출석 기록이 없으면: 모두 0
        totalAttendance = 0;
        totalAbsent = 0;
        regularAttendance = 0;
        newbieAttendance = 0;
        absentees = [];
      }

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
        const userAccount = usersData?.find(u => u.id === userId);
        let userName = '알 수 없음';

        if (member) {
          userName = member.name;
        } else if (userAccount) {
          // members에 없으면 users 테이블에서 확인 (팀장들)
          userName = userAccount.name;
        } else if (userId === user.id) {
          // 로그인한 사용자인지 확인
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
      if (period === 'week' && hasAttendanceRecords) {
        // 출석 기록이 있을 때만 상세 데이터 생성

        // 중복 제거 헬퍼 함수 (id 기준)
        const uniqueById = <T extends { id: string }>(arr: T[]): T[] => {
          const seen = new Set<string>();
          return arr.filter(item => {
            if (seen.has(item.id)) {
              return false;
            }
            seen.add(item.id);
            return true;
          });
        };

        // 재적 멤버 전체
        const regularMembers = membersData?.filter(m => !m.is_newbie) || [];

        // 재적 출석자 명단
        const regularAttendeeMemberIds = attendanceData
          ?.filter(r => r.present)
          .map(r => r.member_id) || [];

        const regularAttendees = uniqueById(
          membersData
            ?.filter(m => !m.is_newbie && regularAttendeeMemberIds.includes(m.id))
            .map(m => ({
              id: m.id,
              name: m.name,
              phone: (m as any).phone || ''
            })) || []
        );

        // 새신자 출석자 명단
        const newbieAttendees = uniqueById(
          membersData
            ?.filter(m => m.is_newbie && regularAttendeeMemberIds.includes(m.id))
            .map(m => {
              // 이 새신자를 전도한 사람 찾기
              const referral = referralsData?.find(r => r.new_member_id === m.id);
              let referrerName = undefined;

              if (referral) {
                // 전도자 정보 찾기 (membersData 또는 usersData에서)
                const referrerMember = membersData?.find(member => member.id === referral.referrer_id);
                const referrerUser = usersData?.find(user => user.id === referral.referrer_id);
                referrerName = referrerMember?.name || referrerUser?.name;
              }

              return {
                id: m.id,
                name: m.name,
                phone: (m as any).phone || '',
                referrer_name: referrerName
              };
            }) || []
        );

        // 재적 결석자 명단: 출석 기록이 없거나 present=false인 재적 멤버
        const absenteesWithId = uniqueById(
          regularMembers
            .filter(m => !regularAttendeeMemberIds.includes(m.id))
            .map(m => {
              const record = attendanceData?.find(r => r.member_id === m.id);
              return {
                id: m.id,
                name: m.name,
                phone: (m as any).phone || '',
                absence_reason: (record as any)?.absence_reason || undefined
              };
            })
        );

        weeklyAttendanceData = {
          totalAttendance: totalAttendance,
          regularAttendance: regularAttendance,
          newbieAttendance: newbieAttendance,
          regularAbsent: totalAbsent,
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

  const handleWeeklyExport = async () => {
    try {
      // URL 파라미터 확인
      const teamColorParam = searchParams.get('team_color');
      const dateStr = formatDate(selectedDate);
      const dateDisplay = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;

      // 팀 데이터 가져오기
      let teamsQuery = supabase.from('teams').select('id, name, team_color').order('name');
      if (teamColorParam) {
        teamsQuery = teamsQuery.eq('team_color', teamColorParam);
      }
      const { data: teamsData } = await teamsQuery;
      const teamIds = teamsData?.map(t => t.id) || [];

      // 전체 멤버 가져오기
      let membersQuery = supabase
        .from('members')
        .select('id, name, phone, team_id, is_newbie, is_team_leader, is_zone_leader, zone_leader_id');
      if (teamIds.length > 0) {
        membersQuery = membersQuery.in('team_id', teamIds);
      }
      const { data: allMembers } = await membersQuery;

      // 출석 기록 가져오기
      const { data: attendanceData } = await supabase
        .from('attendance_records')
        .select('member_id, present, absence_reason')
        .eq('week_start_date', dateStr);

      // 전도 기록 가져오기 (이번 주)
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('new_member_id, referrer_id')
        .gte('created_at', dateStr);

      // 엑셀 데이터 생성
      const excelData: any[] = [];

      // 헤더 행
      excelData.push([
        '결재', '담당자', '담임목사', `${teamColorParam || '전체'} 주일 결석자 내역서`, '', '', '', '', '', ''
      ]);
      excelData.push([
        '', '', '', `(${dateDisplay})`, '', '', '', '', '', ''
      ]);
      excelData.push([]); // 빈 행

      // 컬럼 헤더
      excelData.push([
        '팀명',
        '재적',
        '출석',
        '결석',
        '새가족',
        '전도',
        '정착',
        '결석자(명단) / 전화번호 / 결석사유',
        '비고'
      ]);

      // 출석 기록이 있는지 확인
      const hasAttendanceRecords = (attendanceData?.length || 0) > 0;

      // 각 팀별 데이터
      teamsData?.forEach(team => {
        const members = allMembers?.filter(m => m.team_id === team.id) || [];

        if (members.length === 0) return;

        // 재적 멤버만 (새신자 제외)
        const regularMembers = members.filter(m => !m.is_newbie);
        const totalMembers = regularMembers.length;

        let presentMembersCount = 0;
        let absentMembersCount = 0;
        let absentInfo = '';

        if (hasAttendanceRecords) {
          // 출석 기록이 있으면: 체크 안 된 재적 멤버는 결석 처리

          // 재적 출석만 (새신자 출석 제외)
          const presentMembers = regularMembers.filter(m =>
            attendanceData?.some(a => a.member_id === m.id && a.present)
          );
          presentMembersCount = presentMembers.length;

          // 재적 결석: 재적 전체 - 재적 출석
          absentMembersCount = totalMembers - presentMembersCount;

          // 결석자 명단: 출석 기록이 없거나 present=false인 재적 멤버
          const presentMemberIds = attendanceData
            ?.filter(a => a.present)
            .map(a => a.member_id) || [];

          const absentMembers = regularMembers.filter(m => !presentMemberIds.includes(m.id));

          absentInfo = absentMembers.map(m => {
            const attendance = attendanceData?.find(a => a.member_id === m.id);
            return `${m.name} - ${m.phone || ''} - ${attendance?.absence_reason || ''}`;
          }).join('\n');
        }

        // 새신자 출석
        const newbieMembers = members.filter(m =>
          m.is_newbie && attendanceData?.some(a => a.member_id === m.id && a.present)
        );

        // 전도 인원 계산 (이 팀 멤버가 전도한 새신자 수)
        const evangelismCount = referralsData?.filter(r =>
          members.some(m => m.id === r.referrer_id)
        ).length || 0;

        excelData.push([
          team.name,
          totalMembers,
          presentMembersCount,
          absentMembersCount,
          newbieMembers.length,
          evangelismCount,
          0, // 정착 (추후 구현)
          absentInfo,
          ''
        ]);
      });

      // 전체 재적 행
      // 재적 멤버만 (새신자 제외)
      const regularMembers = allMembers?.filter(m => !m.is_newbie) || [];
      const totalCount = regularMembers.length;

      let totalPresent = 0;
      let totalAbsent = 0;

      if (hasAttendanceRecords) {
        // 출석 기록이 있으면: 체크 안 된 재적 멤버는 결석 처리

        // 재적 출석만 (새신자 출석 제외)
        totalPresent = regularMembers.filter(m =>
          attendanceData?.some(a => a.member_id === m.id && a.present)
        ).length;

        // 재적 결석: 재적 전체 - 재적 출석
        totalAbsent = totalCount - totalPresent;
      }

      // 새신자 출석
      const totalNewbies = allMembers?.filter(m =>
        m.is_newbie && attendanceData?.some(a => a.member_id === m.id && a.present)
      ).length || 0;

      excelData.push([]);
      excelData.push([
        '전체 재적',
        totalCount,
        totalPresent,
        totalAbsent,
        totalNewbies,
        referralsData?.length || 0,
        0,
        '',
        ''
      ]);

      // 워크시트 생성
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);

      // 컬럼 너비 설정
      worksheet['!cols'] = [
        { wch: 20 }, // 팀명
        { wch: 8 },  // 재적
        { wch: 8 },  // 출석
        { wch: 8 },  // 결석
        { wch: 8 },  // 새가족
        { wch: 8 },  // 전도
        { wch: 8 },  // 정착
        { wch: 50 }, // 결석자 정보
        { wch: 15 }  // 비고
      ];

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '주일 결석자 내역서');

      // 파일명 생성
      const fileName = `${teamColorParam || '전체'}_주일_결석자_내역서_${selectedDate.getFullYear()}년_${selectedDate.getMonth() + 1}월_${selectedDate.getDate()}일.xlsx`;

      // 파일 다운로드
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('주간 엑셀 내보내기 실패:', error);
      alert('엑셀 내보내기에 실패했습니다');
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);

      // URL 파라미터 확인
      const teamColorParam = searchParams.get('team_color');
      const viewAll = searchParams.get('view') === 'all';

      // 팀 데이터 가져오기 (팀 색상 필터링)
      let teamsQuery = supabase.from('teams').select('id, name').order('name');

      if (teamColorParam) {
        teamsQuery = teamsQuery.eq('team_color', teamColorParam);
      }

      const { data: teamsData, error: teamsError } = await teamsQuery;
      if (teamsError) throw teamsError;

      // 팀 ID 목록 추출
      const teamIds = teamsData?.map(t => t.id) || [];

      // 새신자 가져오기 (팀 ID로 필터링)
      let newbiesQuery = supabase
        .from('members')
        .select('id, name, phone, gender, age, region, team_id')
        .eq('is_newbie', true);

      if (teamIds.length > 0) {
        newbiesQuery = newbiesQuery.in('team_id', teamIds);
      }

      const { data: newbiesData, error: newbiesError } = await newbiesQuery.order('name');
      if (newbiesError) throw newbiesError;

      // 전도자 정보 가져오기
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select('new_member_id, referrer_id');

      if (referralsError) throw referralsError;

      // 전도자 이름 조회를 위한 members와 users 가져오기
      const { data: membersData } = await supabase
        .from('members')
        .select('id, name');

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name');

      // 날짜 범위 계산
      let startDate = '';
      let endDate = '';
      let dateColumns: { label: string; date: string }[] = [];

      if (period === 'month') {
        // 월간: 해당 월의 모든 일요일
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        // 해당 월의 모든 일요일 찾기
        const sundays: Date[] = [];
        const current = new Date(firstDay);

        // 첫 번째 일요일 찾기
        while (current.getDay() !== 0) {
          current.setDate(current.getDate() + 1);
        }

        // 모든 일요일 수집
        while (current <= lastDay) {
          sundays.push(new Date(current));
          current.setDate(current.getDate() + 7);
        }

        // 주차별 컬럼 생성 (1월 1주, 1월 2주, ...)
        dateColumns = sundays.map((sunday, index) => ({
          label: `${month + 1}월 ${index + 1}주`,
          date: `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
        }));
      } else if (period === 'year') {
        // 연간: 해당 년도의 모든 월
        const year = selectedDate.getFullYear();
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;

        // 월별 컬럼 생성 (1월, 2월, 3월, ...)
        dateColumns = Array.from({ length: 12 }, (_, i) => ({
          label: `${i + 1}월`,
          date: `${year}-${String(i + 1).padStart(2, '0')}`
        }));
      } else if (period === 'week') {
        // 주간: 주일 결석자 내역서 생성
        await handleWeeklyExport();
        setLoading(false);
        return;
      } else {
        alert('지원하지 않는 기간입니다');
        setLoading(false);
        return;
      }

      // 출석 기록 가져오기
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('member_id, present, week_start_date')
        .gte('week_start_date', startDate)
        .lte('week_start_date', endDate);

      if (attendanceError) throw attendanceError;

      // 엑셀 데이터 생성
      const columnTotals: { [key: string]: number } = {};
      dateColumns.forEach(col => {
        columnTotals[col.label] = 0;
      });
      let grandTotal = 0;

      const excelData = newbiesData?.map((newbie, index) => {
        const team = teamsData?.find(t => t.id === newbie.team_id);
        const referral = referralsData?.find(r => r.new_member_id === newbie.id);

        let referrerName = '';
        if (referral) {
          const referrerMember = membersData?.find(m => m.id === referral.referrer_id);
          const referrerUser = usersData?.find(u => u.id === referral.referrer_id);
          referrerName = referrerMember?.name || referrerUser?.name || '';
        }

        const row: any = {
          '소속': team?.name || '',
          '이름': newbie.name,
          '성별': newbie.gender || '',
          '연령': newbie.age ? `${newbie.age}세` : '',
          '전화번호': newbie.phone || '',
          '지역': newbie.region || '',
          '전도자': referrerName
        };

        // 출석 데이터 추가
        let totalAttendance = 0;
        dateColumns.forEach(col => {
          let isPresent = false;

          if (period === 'month') {
            // 월간: 특정 일요일의 출석 여부
            isPresent = attendanceData?.some(
              a => a.member_id === newbie.id && a.present && a.week_start_date === col.date
            ) || false;
          } else if (period === 'year') {
            // 연간: 해당 월에 한 번이라도 출석했는지
            isPresent = attendanceData?.some(
              a => a.member_id === newbie.id &&
                   a.present &&
                   a.week_start_date.startsWith(col.date)
            ) || false;
          }

          row[col.label] = isPresent ? 'O' : '';
          if (isPresent) {
            totalAttendance++;
            columnTotals[col.label]++;
            grandTotal++;
          }
        });

        row['합계'] = totalAttendance;

        return row;
      }) || [];

      // 이름 기준으로 가나다순 정렬
      excelData.sort((a, b) => {
        return a['이름'].localeCompare(b['이름'], 'ko-KR');
      });

      // 합계 행 추가
      const totalRow: any = {
        '소속': '',
        '이름': '',
        '성별': '',
        '연령': '',
        '전화번호': '',
        '지역': '',
        '전도자': ''
      };

      dateColumns.forEach(col => {
        totalRow[col.label] = columnTotals[col.label];
      });

      totalRow['합계'] = grandTotal;

      excelData.push(totalRow);

      // 배열의 배열로 변환 (순번 컬럼 추가를 위해)
      const headers = ['', '소속', '이름', '성별', '연령', '전화번호', '지역', '전도자', ...dateColumns.map(c => c.label), '합계'];

      const rows = excelData.map((row, index) => {
        const isTotal = row['소속'] === '' && row['이름'] === '' && index === excelData.length - 1;
        return [
          isTotal ? '합계' : index + 1, // 순번 컬럼에 합계 또는 번호
          row['소속'],
          row['이름'],
          row['성별'],
          row['연령'],
          row['전화번호'],
          row['지역'],
          row['전도자'],
          ...dateColumns.map(col => row[col.label]),
          row['합계']
        ];
      });

      // 워크시트 생성 (배열의 배열 방식)
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // 컬럼 너비 설정
      const columnWidths = [
        { wch: 8 },  // 순번
        { wch: 15 }, // 소속
        { wch: 10 }, // 이름
        { wch: 8 },  // 성별
        { wch: 8 },  // 연령
        { wch: 15 }, // 전화번호
        { wch: 12 }, // 지역
        { wch: 10 }, // 전도자
        ...dateColumns.map(() => ({ wch: 10 })), // 날짜 컬럼들
        { wch: 8 }   // 합계
      ];
      worksheet['!cols'] = columnWidths;

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '새신자 출석');

      // 파일명 생성
      let fileNamePrefix = '새신자_출석';
      if (teamColorParam) {
        fileNamePrefix = `${teamColorParam}_${fileNamePrefix}`;
      }

      const fileName = period === 'month'
        ? `${fileNamePrefix}_${selectedDate.getFullYear()}년_${selectedDate.getMonth() + 1}월.xlsx`
        : `${fileNamePrefix}_${selectedDate.getFullYear()}년.xlsx`;

      // 파일 다운로드
      XLSX.writeFile(workbook, fileName);

      setLoading(false);
    } catch (error) {
      console.error('엑셀 내보내기 실패:', error);
      alert('엑셀 내보내기에 실패했습니다');
      setLoading(false);
    }
  };

  const totalPoints = period === 'week' ? (reportData?.totals?.weeklyPoints || 0) :
    period === 'month' ? (reportData?.totals?.monthlyPoints || 0) :
    (reportData?.totals?.yearlyPoints || 0);

  // 목사님인지 확인
  const isPastor = user?.role === 'pastor';
  // 현재 보고 있는 뷰 확인
  const viewAll = searchParams.get('view') === 'all';
  const teamColorParam = searchParams.get('team_color');
  const currentTeamId = searchParams.get('team_id');

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #FAFAFA 0%, #FFFFFF 100%)' }}>
      {/* 헤더 */}
      <nav className="bg-white/80 backdrop-blur-lg" style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
        <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="로고"
              className="h-10 w-auto object-contain"
            />
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-menu-line text-2xl text-gray-700"></i>
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
            <h2 className="text-xl font-bold text-gray-900">메뉴</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-3xl text-gray-900"></i>
            </button>
          </div>

          <div className="space-y-2">
            {isPastor ? (
              <>
                {/* 목사님 메뉴: 전체 + 청팀 + 백팀 + 팀 목록 */}
                <button
                  onClick={() => {
                    navigate('/reports?view=all');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    viewAll
                      ? 'text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  style={viewAll ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
                >
                  <span className={viewAll ? 'text-white' : 'text-gray-900'}>전체</span>
                </button>

                {/* 청팀 버튼 */}
                <button
                  onClick={() => {
                    navigate('/reports?team_color=청팀');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    teamColorParam === '청팀'
                      ? 'text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  style={teamColorParam === '청팀' ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
                >
                  <span className={teamColorParam === '청팀' ? 'text-white' : 'text-gray-900'}>청팀</span>
                </button>

                {/* 백팀 버튼 */}
                <button
                  onClick={() => {
                    navigate('/reports?team_color=백팀');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    teamColorParam === '백팀'
                      ? 'text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  style={teamColorParam === '백팀' ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
                >
                  <span className={teamColorParam === '백팀' ? 'text-white' : 'text-gray-900'}>백팀</span>
                </button>

                {/* 교육부서 버튼 */}
                <button
                  onClick={() => {
                    navigate('/reports?team_color=교육부서');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    teamColorParam === '교육부서'
                      ? 'text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  style={teamColorParam === '교육부서' ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
                >
                  <span className={teamColorParam === '교육부서' ? 'text-white' : 'text-gray-900'}>교육부서</span>
                </button>

                {/* 구분선 */}
                <div className="border-t border-gray-200 my-2"></div>

                {/* 개별 팀 목록 */}
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      navigate(`/reports?team_id=${team.id}`);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      currentTeamId === team.id
                        ? 'text-white'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                    style={currentTeamId === team.id ? { backgroundColor: '#1E88E5', color: 'white' } : {}}
                  >
                    <span className={currentTeamId === team.id ? 'text-white' : 'text-gray-900'}>{team.name}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {/* 팀장 메뉴: 출석 체크, 출석 & 전도 */}
                <button
                  onClick={() => {
                    navigate('/attendance');
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors"
                >
                  <i className="ri-checkbox-circle-line text-2xl text-gray-600"></i>
                  <span className="text-gray-900">출석 체크</span>
                </button>
                <button
                  onClick={() => {
                    navigate('/reports');
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors"
                  style={{ backgroundColor: '#1E88E5', color: 'white' }}
                >
                  <i className="ri-bar-chart-line text-2xl" style={{ color: 'white' }}></i>
                  <span style={{ color: 'white' }}>출석 & 전도</span>
                </button>
              </>
            )}
          </div>

          {/* 로그아웃 버튼 */}
          <div className="absolute bottom-6 left-6 right-6">
            <button
              onClick={() => {
                localStorage.removeItem('user');
                navigate(isPastor ? '/pastor-login' : '/login');
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-semibold cursor-pointer transition-colors"
            >
              <i className="ri-logout-box-line text-2xl"></i>
              <span>로그아웃</span>
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
              <i className="ri-arrow-left-s-line text-3xl text-gray-700"></i>
            </button>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={goToNext}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-3xl text-gray-700"></i>
            </button>
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-3">
              <i className="ri-loader-4-line text-5xl animate-spin" style={{ color: '#1E88E5' }}></i>
              <span className="text-xl font-semibold text-gray-900">로딩 중...</span>
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
              className={`py-2 px-4 rounded-lg text-base font-bold transition-all cursor-pointer ${
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
              className={`py-2 px-4 rounded-lg text-base font-bold transition-all cursor-pointer ${
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
              className={`py-2 px-4 rounded-lg text-base font-bold transition-all cursor-pointer ${
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

        {/* 내보내기 버튼 (전체/청팀/백팀/교육부서 탭에서 표시) */}
        {(viewAll || teamColorParam) && (
          <div className="mb-5 flex justify-end">
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
            >
              <i className="ri-file-excel-line text-xl"></i>
              <span>엑셀 다운로드</span>
            </button>
          </div>
        )}

        {/* 출석 현황 카드 (주간 탭에서만 표시) */}
        {period === 'week' && reportData?.weeklyAttendance && (
          <div className="bg-white rounded-3xl p-8 mb-6" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)' }}>
            {/* 총 출석 헤더 */}
            <div className="mb-8 pb-8 border-b border-gray-100">
              <div className="flex items-baseline space-x-3">
                <h1 className="text-base font-bold text-gray-500 uppercase tracking-wide">{teamName} 총출석</h1>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-4xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                  {reportData.weeklyAttendance.totalAttendance || 0}
                </span>
                <span className="text-2xl font-semibold text-gray-400">명</span>
              </div>
            </div>

            {/* 출석 현황 */}
            <h2 className="text-base font-bold text-gray-700 mb-8">{teamName} 출석 현황</h2>
            <div className="space-y-6">
              {/* 재적 출석 */}
              <div
                className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50/50 transition-all cursor-pointer"
                onClick={() => {
                  setListModalData({
                    title: `${formatTitleDate(selectedDate)} 재적 출석(${teamName})`,
                    members: reportData.weeklyAttendance?.regularAttendees || []
                  });
                  setShowListModal(true);
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50/50 flex items-center justify-center">
                    <i className="ri-user-line text-xl" style={{ color: '#1E88E5' }}></i>
                  </div>
                  <span className="text-lg font-semibold text-gray-700">재적 출석</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {reportData.weeklyAttendance.regularAttendance || 0}
                  </span>
                  <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
                </div>
              </div>

              {/* 새신자 출석 */}
              <div
                className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50/50 transition-all cursor-pointer"
                onClick={() => {
                  setListModalData({
                    title: `${formatTitleDate(selectedDate)} 새신자 출석(${teamName})`,
                    members: reportData.weeklyAttendance?.newbieAttendees || []
                  });
                  setShowListModal(true);
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-50/50 flex items-center justify-center">
                    <i className="ri-user-add-line text-xl text-green-600"></i>
                  </div>
                  <span className="text-lg font-semibold text-gray-700">새신자 출석</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {reportData.weeklyAttendance.newbieAttendance || 0}
                  </span>
                  <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
                </div>
              </div>

              {/* 재적 결석 */}
              <div
                className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50/50 transition-all cursor-pointer"
                onClick={() => {
                  setListModalData({
                    title: `${formatTitleDate(selectedDate)} 재적 결석(${teamName})`,
                    members: reportData.weeklyAttendance?.absentees || []
                  });
                  setShowListModal(true);
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-2xl bg-gray-100/80 flex items-center justify-center">
                    <i className="ri-user-unfollow-line text-xl text-gray-500"></i>
                  </div>
                  <span className="text-lg font-semibold text-gray-700">재적 결석</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {reportData.weeklyAttendance.regularAbsent || 0}
                  </span>
                  <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
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
                    <p className="text-sm text-gray-600 font-semibold">명</p>
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{formatTitleDate(selectedDate)} 총 전도인원 ({teamName})</h3>
            </div>

            {/* 개인별 전도 인원 리스트 */}
            {reportData?.per_user_points && reportData.per_user_points.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-gray-700 mb-6">{teamName} 개인별 전도인원</h3>
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
                      <span className="text-lg font-bold text-gray-900">{user.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-mono text-gray-500">{user.points}명</span>
                        <i className="ri-arrow-right-s-line text-xl text-gray-400"></i>
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
                    <h3 className="text-2xl font-bold text-gray-900">
                      {selectedReferrer.name} {formatTitleDate(selectedDate)} 전도 횟수
                    </h3>
                    <p className="text-base text-gray-600 mt-1">총 {selectedReferrer.members?.length || 0}명</p>
                  </div>
                  <button
                    onClick={() => setShowReferralModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-close-line text-3xl text-gray-700"></i>
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
                          <span className="text-base font-bold text-gray-600 w-6">
                            {index + 1}
                          </span>
                          <span className="text-base font-bold text-gray-900">
                            {member.name}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600">
                          {member.date}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-base text-gray-500">전도 명단이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 모달 푸터 */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowReferralModal(false)}
                  className="w-full py-3 rounded-lg font-bold text-white transition-colors cursor-pointer"
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
                    <h3 className="text-2xl font-bold text-gray-900">{listModalData.title}</h3>
                    <p className="text-base text-gray-600 mt-1">총 {listModalData.members?.length || 0}명</p>
                  </div>
                  <button
                    onClick={() => setShowListModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-close-line text-3xl text-gray-700"></i>
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
                          <span className="text-base font-bold text-gray-600 w-6">
                            {index + 1}
                          </span>
                          <span className="text-base font-bold text-gray-900">
                            {member.name}
                          </span>
                        </div>
                        {listModalData.title.includes('결석') && (
                          <span className="text-sm text-gray-600">
                            {member.absence_reason || '개인사정'}
                          </span>
                        )}
                        {listModalData.title.includes('새신자') && member.referrer_name && (
                          <span className="text-sm text-gray-600">
                            전도자: {member.referrer_name}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-base text-gray-500">명단이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 모달 푸터 */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowListModal(false)}
                  className="w-full py-3 rounded-lg font-bold text-white transition-colors cursor-pointer"
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
