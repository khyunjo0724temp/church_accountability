import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Member {
  id: string;
  name: string;
  phone: string;
  is_newbie: boolean;
  is_zone_leader: boolean;
  is_team_leader: boolean;
  zone_leader_id: string | null;
  zone_leader_name?: string;
  referrer_name?: string;
  gender?: string;
  age?: number;
  region?: string;
}

export default function Attendance() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [savedAttendance, setSavedAttendance] = useState<Map<string, boolean>>(new Map()); // 저장된 출석 상태 (정렬용)
  const [absenceReasons, setAbsenceReasons] = useState<Map<string, string>>(new Map()); // 결석 사유
  const [selectedDate, setSelectedDate] = useState(getThisSunday());
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [zoneLeaders, setZoneLeaders] = useState<Member[]>([]);
  const [regularMembers, setRegularMembers] = useState<Member[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: '', // 'regular' | 'zone_leader' | 'newbie' | 'team_leader'
    zone_leader_id: '',
    referrer_id: '',
    gender: '',
    age: '',
    region: ''
  });
  const [activeTab, setActiveTab] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => {
    migrateZoneLeaders();
    fetchMembers();
  }, []);

  const migrateZoneLeaders = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.team_id) return;

      // 구역장들을 일반 재적 멤버로 변경
      await supabase
        .from('members')
        .update({
          is_zone_leader: false,
          zone_leader_id: null
        })
        .eq('team_id', user.team_id)
        .eq('is_zone_leader', true);

      console.log('구역장 마이그레이션 완료');
    } catch (error) {
      console.error('구역장 마이그레이션 실패:', error);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, members]);

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

  const fetchMembers = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      if (!user.team_id) {
        console.error('팀 ID가 없습니다');
        return;
      }

      // 팀 정보 가져오기
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', user.team_id)
        .single();

      if (teamData) {
        setTeamName(teamData.name);
      }

      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('team_id', user.team_id)
        .order('name');

      if (error) {
        console.error('멤버 로드 실패:', error);
        return;
      }

      // referrals 테이블에서 전도자 정보 가져오기
      const { data: referralsData } = await supabase
        .from('referrals')
        .select('new_member_id, referrer_id')
        .eq('team_id', user.team_id);

      // zone_leader, referrer 정보를 클라이언트에서 매핑
      const membersWithInfo = (data || []).map((member: any) => {
        const zoneLeader = member.zone_leader_id
          ? data.find((m: any) => m.id === member.zone_leader_id)
          : null;

        // 전도자 정보 찾기
        const referralRecord = referralsData?.find(r => r.new_member_id === member.id);
        let referrerName = null;

        if (referralRecord?.referrer_id) {
          // 먼저 members 테이블에서 찾기
          const referrer = data.find((m: any) => m.id === referralRecord.referrer_id);
          if (referrer) {
            referrerName = referrer.name;
          } else if (referralRecord.referrer_id === user.id) {
            // members에 없으면 팀장(로그인한 사용자)인지 확인
            referrerName = user.name;
          }
        }

        return {
          ...member,
          zone_leader_name: zoneLeader?.name || null,
          referrer_name: referrerName
        };
      });

      setMembers(membersWithInfo);

      // 구역장 목록 추출
      const leaders = membersWithInfo.filter((m: Member) => m.is_zone_leader);
      setZoneLeaders(leaders);

      // 재적 멤버 목록 (새신자 아닌 사람들)
      const regulars = membersWithInfo.filter((m: Member) => !m.is_newbie);
      setRegularMembers(regulars);

      // 초기 출석 상태 설정
      const initialAttendance = new Map<string, boolean>();
      membersWithInfo.forEach((m: Member) => {
        initialAttendance.set(m.id, false);
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('멤버 로드 실패:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoadingAttendance(true);
      const dateStr = formatDate(selectedDate);

      const { data, error } = await supabase
        .from('attendance_records')
        .select('member_id, present, absence_reason')
        .eq('week_start_date', dateStr);

      if (error) {
        console.error('출석 기록 로드 실패:', error);
        setLoadingAttendance(false);
        return;
      }

      // 기존 출석 기록으로 상태 업데이트
      const newAttendance = new Map<string, boolean>();
      const newAbsenceReasons = new Map<string, string>();
      members.forEach((m: Member) => {
        const record = data?.find(r => r.member_id === m.id);
        newAttendance.set(m.id, record?.present || false);
        if (record?.absence_reason) {
          newAbsenceReasons.set(m.id, record.absence_reason);
        }
      });
      setAttendance(newAttendance);
      setSavedAttendance(new Map(newAttendance)); // 저장된 상태도 업데이트 (정렬용)
      setAbsenceReasons(newAbsenceReasons);
      setLoadingAttendance(false);
    } catch (error) {
      console.error('출석 기록 로드 실패:', error);
      setLoadingAttendance(false);
    }
  };

  const toggleAttendance = async (memberId: string) => {
    const currentValue = attendance.get(memberId) || false;
    const newValue = !currentValue;

    // UI 즉시 업데이트
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(memberId, newValue);
      return newMap;
    });

    // 결석 사유 처리
    if (!newValue) {
      setAbsenceReasons(prevReasons => {
        const newReasons = new Map(prevReasons);
        if (!newReasons.has(memberId)) {
          newReasons.set(memberId, '개인사정');
        }
        return newReasons;
      });
    } else {
      setAbsenceReasons(prevReasons => {
        const newReasons = new Map(prevReasons);
        newReasons.delete(memberId);
        return newReasons;
      });
    }

    // DB에 즉시 저장
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const dateStr = formatDate(selectedDate);
      const member = members.find(m => m.id === memberId);

      if (!member) return;

      // 기존 레코드 삭제
      await supabase
        .from('attendance_records')
        .delete()
        .eq('week_start_date', dateStr)
        .eq('member_id', memberId);

      // 새신자는 출석만 기록, 재적은 출석/결석 모두 기록
      if (newValue || !member.is_newbie) {
        await supabase
          .from('attendance_records')
          .insert({
            team_id: user.team_id,
            member_id: memberId,
            week_start_date: dateStr,
            present: newValue,
            absence_reason: newValue ? null : (absenceReasons.get(memberId) || '개인사정')
          });
      }
    } catch (error) {
      console.error('출석 저장 실패:', error);
      // 실패 시 UI 되돌리기
      setAttendance(prev => {
        const newMap = new Map(prev);
        newMap.set(memberId, currentValue);
        return newMap;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const dateStr = formatDate(selectedDate);

      // 기존 출석 기록 삭제
      await supabase
        .from('attendance_records')
        .delete()
        .eq('week_start_date', dateStr)
        .eq('team_id', user.team_id);

      // 새로운 출석 기록 삽입
      // 새신자는 출석만 기록, 재적 멤버는 출석/결석 모두 기록
      const records = Array.from(attendance.entries())
        .filter(([member_id, present]) => {
          const member = members.find(m => m.id === member_id);
          // 새신자는 출석한 경우만 기록, 재적은 모두 기록
          if (member?.is_newbie) {
            return present; // 출석한 새신자만
          }
          return true; // 재적은 출석/결석 모두
        })
        .map(([member_id, present]) => ({
          team_id: user.team_id,
          member_id,
          week_start_date: dateStr,
          present,
          absence_reason: present ? null : (absenceReasons.get(member_id) || null)
        }));

      if (records.length > 0) {
        const { error } = await supabase
          .from('attendance_records')
          .insert(records);

        if (error) {
          console.error('저장 실패:', error);
          alert('출석 저장에 실패했습니다');
          return;
        }
      }

      setSuccessMessage('출석이 저장되었습니다');
    } catch (error) {
      console.error('저장 실패:', error);
      alert('출석 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 역할 필수 검증
    if (!formData.role) {
      alert('역할을 선택해주세요');
      return;
    }

    // 새신자일 때 전도자 필수 검증
    if (formData.role === 'newbie' && !formData.referrer_id) {
      alert('전도자를 선택해주세요');
      return;
    }

    // 이름 중복 검증
    const duplicateName = members.find(m => {
      // 수정할 때는 자기 자신은 제외
      if (editingMember && m.id === editingMember.id) {
        return false;
      }
      // 같은 이름이 있는지 확인
      return m.name === formData.name;
    });

    if (duplicateName) {
      alert(`같은 이름 "${formData.name}"이(가) 이미 존재합니다.\n다른 이름을 사용하거나 구별할 수 있는 표시를 추가해주세요.\n예: ${formData.name}A, ${formData.name}B`);
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // 역할에 따른 플래그 설정
      const is_zone_leader = false; // 구역장 역할 제거
      const is_newbie = formData.role === 'newbie';
      const is_team_leader = formData.role === 'team_leader';

      // zone_leader_id 계산
      let zone_leader_id = null;

      if (formData.role === 'team_leader') {
        // 팀장은 zone_leader_id가 없음
        zone_leader_id = null;
      } else if (formData.role === 'regular') {
        // 재적은 zone_leader_id 없음 (구역장 역할 제거)
        zone_leader_id = null;
      } else if (formData.role === 'newbie') {
        // 새신자는 zone_leader_id 없음 (구역장 역할 제거)
        zone_leader_id = null;
      }

      if (editingMember) {
        // 수정
        const updateData: any = {
          name: formData.name,
          phone: formData.phone,
          is_newbie: is_newbie,
          is_zone_leader: is_zone_leader,
          is_team_leader: is_team_leader,
          zone_leader_id: zone_leader_id
        };

        // 새신자인 경우 성별, 연령, 지역 추가
        if (is_newbie) {
          updateData.gender = formData.gender || null;
          updateData.age = formData.age ? parseInt(formData.age) : null;
          updateData.region = formData.region || null;
        }

        const { error } = await supabase
          .from('members')
          .update(updateData)
          .eq('id', editingMember.id);

        if (error) {
          console.error('수정 실패:', error);
          return;
        }

        // 새신자인 경우에만 referrals 업데이트
        if (is_newbie && formData.referrer_id) {
          await supabase
            .from('referrals')
            .delete()
            .eq('new_member_id', editingMember.id);

          const today = new Date();
          const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          await supabase
            .from('referrals')
            .insert({
              team_id: user.team_id,
              new_member_id: editingMember.id,
              referrer_id: formData.referrer_id,
              depth: 1,
              date: dateStr
            });
        }

        fetchMembers();
        closeModal();
      } else {
        // 추가
        const insertData: any = {
          team_id: user.team_id,
          name: formData.name,
          phone: formData.phone,
          is_newbie: is_newbie,
          is_zone_leader: is_zone_leader,
          is_team_leader: is_team_leader,
          zone_leader_id: zone_leader_id
        };

        // 새신자인 경우 성별, 연령, 지역 추가
        if (is_newbie) {
          insertData.gender = formData.gender || null;
          insertData.age = formData.age ? parseInt(formData.age) : null;
          insertData.region = formData.region || null;
        }

        const { data: newMember, error } = await supabase
          .from('members')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('추가 실패:', error);
          return;
        }

        // 새신자인 경우에만 referrals 테이블에 전도자 정보 저장
        if (is_newbie && formData.referrer_id && newMember) {
          const today = new Date();
          const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          await supabase
            .from('referrals')
            .insert({
              team_id: user.team_id,
              new_member_id: newMember.id,
              referrer_id: formData.referrer_id,
              depth: 1,
              date: dateStr
            });
        }

        fetchMembers();
        closeModal();
      }
    } catch (error) {
      console.error('저장 실패:', error);
    }
  };

  const handleDeleteClick = (id: string) => {
    // 삭제할 멤버 찾기
    const member = members.find(m => m.id === id);
    if (!member) return;

    // 삭제 확인 모달 표시
    setMemberToDelete({ id: member.id, name: member.name });
    setDeleteConfirmName('');
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;

    // 이름 확인
    if (deleteConfirmName !== memberToDelete.name) {
      alert('멤버 이름이 일치하지 않습니다');
      return;
    }

    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', memberToDelete.id);

      if (error) {
        console.error('삭제 실패:', error);
        return;
      }

      setShowDeleteConfirm(false);
      setMemberToDelete(null);
      setDeleteConfirmName('');
      fetchMembers();
      closeModal();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const openAddModal = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      phone: '',
      role: '', // 필수 선택
      zone_leader_id: '',
      referrer_id: '', // 전도자 직접 선택
      gender: '',
      age: '',
      region: ''
    });
    setShowAddModal(true);
  };

  const openEditModal = async (member: Member) => {
    setEditingMember(member);

    // 역할 결정
    let role = 'regular';
    if (member.is_team_leader) {
      role = 'team_leader';
    } else if (member.is_newbie) {
      role = 'newbie';
    }
    // 구역장은 재적으로 처리 (is_zone_leader는 무시)

    // 새신자인 경우 referrer_id 가져오기
    let referrerId = '';
    if (member.is_newbie) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const { data: referralData } = await supabase
        .from('referrals')
        .select('referrer_id')
        .eq('new_member_id', member.id)
        .eq('team_id', user.team_id)
        .single();

      referrerId = referralData?.referrer_id || '';
    }

    setFormData({
      name: member.name,
      phone: member.phone,
      role: role,
      zone_leader_id: member.zone_leader_id || '',
      referrer_id: referrerId,
      gender: member.gender || '',
      age: member.age ? String(member.age) : '',
      region: member.region || ''
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
  };

  // 멤버를 그룹화
  // 새신자를 정렬: 전도자별로 그룹화하고, 출석한 사람이 위로 (저장된 출석 상태 기준)
  const newbieMembers = (() => {
    const newbies = members.filter(m => m.is_newbie);

    // 전도자별로 그룹화
    const byReferrer = new Map<string, Member[]>();
    newbies.forEach(member => {
      const referrerKey = member.referrer_name || '전도자 없음';
      if (!byReferrer.has(referrerKey)) {
        byReferrer.set(referrerKey, []);
      }
      byReferrer.get(referrerKey)!.push(member);
    });

    // 각 그룹 내에서 출석한 사람을 먼저 정렬 (저장된 출석 상태 기준)
    byReferrer.forEach((group) => {
      group.sort((a, b) => {
        const aPresent = savedAttendance.get(a.id) ? 1 : 0;
        const bPresent = savedAttendance.get(b.id) ? 1 : 0;
        return bPresent - aPresent; // 출석한 사람이 위로
      });
    });

    // 그룹을 출석자 수가 많은 순서로 정렬 (저장된 출석 상태 기준)
    const sortedGroups = Array.from(byReferrer.entries()).sort((a, b) => {
      const aAttendCount = a[1].filter(m => savedAttendance.get(m.id)).length;
      const bAttendCount = b[1].filter(m => savedAttendance.get(m.id)).length;
      return bAttendCount - aAttendCount;
    });

    // 정렬된 그룹을 하나의 배열로 합치기
    return sortedGroups.flatMap(([_, group]) => group);
  })();
  // 팀장 섹션: 팀장 본인 + 팀장이 전도한 멤버들 (구역장에 배정되지 않은 재적)
  const teamLeaderMembers = members.filter(m =>
    !m.is_newbie && (m.is_team_leader || (!m.zone_leader_id && !m.is_zone_leader))
  );
  const membersByZoneLeader = new Map<string, Member[]>();

  members.forEach(member => {
    if (member.is_newbie) return; // 새신자는 별도 섹션

    if (member.is_zone_leader) {
      // 구역장은 자신의 그룹에 포함 (zone_leader_id 없어도 OK)
      const leaderId = member.id;
      if (!membersByZoneLeader.has(leaderId)) {
        membersByZoneLeader.set(leaderId, []);
      }
      membersByZoneLeader.get(leaderId)!.unshift(member); // 구역장을 맨 앞에
    } else if (member.zone_leader_id) {
      // 구역장이 배정된 일반 멤버
      if (!membersByZoneLeader.has(member.zone_leader_id)) {
        membersByZoneLeader.set(member.zone_leader_id, []);
      }
      membersByZoneLeader.get(member.zone_leader_id)!.push(member);
    }
    // else: zone_leader_id도 없고 is_zone_leader도 아니면 팀장 직속 (teamLeaderMembers)
  });


  // 통계 계산
  const regularMembersCount = members.filter(m => !m.is_newbie).length;
  const regularPresentCount = members.filter(m => !m.is_newbie && attendance.get(m.id)).length;
  const newbieAttendanceCount = members.filter(m => m.is_newbie && attendance.get(m.id)).length;
  const totalAttendanceCount = regularPresentCount + newbieAttendanceCount;
  const absentCount = regularMembersCount - regularPresentCount;

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
            <h2 className="text-xl font-bold text-gray-900">메뉴</h2>
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
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors"
              style={{ backgroundColor: '#1E88E5', color: 'white' }}
            >
              <i className="ri-checkbox-circle-line text-xl" style={{ color: 'white' }}></i>
              <span style={{ color: 'white' }}>출석 체크</span>
            </button>
            <button
              onClick={() => {
                navigate('/reports');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-bar-chart-line text-xl text-gray-600"></i>
              <span className="text-gray-900">출석 & 전도</span>
            </button>
          </div>

          {/* 로그아웃 버튼 */}
          <div className="absolute bottom-6 left-6 right-6">
            <button
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('access_token');
                localStorage.removeItem('remember_device');
                navigate('/login');
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
              onClick={goToPreviousWeek}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
              disabled={loadingAttendance}
            >
              <i className="ri-arrow-left-s-line text-2xl text-gray-700"></i>
            </button>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
              disabled={loadingAttendance}
            >
              <i className="ri-arrow-right-s-line text-2xl text-gray-700"></i>
            </button>
          </div>
        </div>

        {loadingAttendance && (
          <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-3">
              <i className="ri-loader-4-line text-5xl animate-spin" style={{ color: '#1E88E5' }}></i>
              <span className="text-xl font-semibold text-gray-900">로딩 중...</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#4CAF50' }}>
                  <i className="ri-check-line text-4xl text-white"></i>
                </div>
                <p className="text-xl font-bold text-gray-900 text-center">{successMessage}</p>
                <button
                  onClick={() => setSuccessMessage('')}
                  className="w-full py-3 rounded-lg font-bold text-white transition-colors cursor-pointer"
                  style={{ backgroundColor: '#1E88E5' }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && memberToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF5350' }}>
                  <i className="ri-delete-bin-line text-4xl text-white"></i>
                </div>
                <p className="text-xl font-bold text-gray-900 text-center">정말로 삭제하시겠습니까?</p>
                <p className="text-base font-medium text-gray-600 text-center">삭제된 멤버는 복구할 수 없습니다.</p>

                <div className="w-full">
                  <p className="text-sm font-semibold text-gray-700 mb-2 text-center">
                    삭제하려면 <span className="text-red-600">"{memberToDelete.name}"</span>을(를) 입력하세요
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder="멤버 이름 입력"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base text-center"
                    autoFocus
                  />
                </div>

                <div className="flex space-x-3 w-full">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setMemberToDelete(null);
                      setDeleteConfirmName('');
                    }}
                    className="flex-1 py-3 rounded-lg font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteConfirmName !== memberToDelete.name}
                    className="flex-1 py-3 rounded-lg font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: deleteConfirmName === memberToDelete.name ? '#EF5350' : '#9CA3AF'
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 멤버 출석 체크 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">{teamName} 출석 체크</h3>
            <button
              onClick={openAddModal}
              className="flex items-center space-x-1.5 text-primary-600 hover:text-primary-700 font-bold py-2 px-3 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer whitespace-nowrap text-base"
            >
              <i className="ri-user-add-line text-lg"></i>
              <span>추가</span>
            </button>
          </div>

          {/* 탭 카테고리 */}
          <div className="flex overflow-x-auto gap-2 mb-4 pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <button
                  onClick={() => setActiveTab('all')}
                  className="px-5 py-2.5 whitespace-nowrap transition-all cursor-pointer text-base font-semibold"
                  style={{
                    backgroundColor: activeTab === 'all' ? '#2D2D2D' : 'white',
                    color: activeTab === 'all' ? 'white' : '#000000',
                    border: activeTab === 'all' ? 'none' : '1px solid #E5E7EB',
                    borderRadius: '999px'
                  }}
                >
                  전체
                </button>
                <button
                  onClick={() => setActiveTab('newbies')}
                  className="px-5 py-2.5 whitespace-nowrap transition-all cursor-pointer text-base font-semibold"
                  style={{
                    backgroundColor: activeTab === 'newbies' ? '#2D2D2D' : 'white',
                    color: activeTab === 'newbies' ? 'white' : '#000000',
                    border: activeTab === 'newbies' ? 'none' : '1px solid #E5E7EB',
                    borderRadius: '999px'
                  }}
                >
                  새신자
                </button>
                <button
                  onClick={() => setActiveTab('regular')}
                  className="px-5 py-2.5 whitespace-nowrap transition-all cursor-pointer text-base font-semibold"
                  style={{
                    backgroundColor: activeTab === 'regular' ? '#2D2D2D' : 'white',
                    color: activeTab === 'regular' ? 'white' : '#000000',
                    border: activeTab === 'regular' ? 'none' : '1px solid #E5E7EB',
                    borderRadius: '999px'
                  }}
                >
                  재적
                </button>
              </div>

              {/* 선택된 탭의 멤버 목록 */}
              <div className="space-y-4">
                {(() => {
                  let displayMembers: Member[] = [];

                  if (activeTab === 'all') {
                    displayMembers = members;
                  } else if (activeTab === 'newbies') {
                    displayMembers = newbieMembers;
                  } else if (activeTab === 'regular') {
                    displayMembers = members.filter(m => !m.is_newbie);
                  }

                  return displayMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-gray-200 hover:border-gray-300 rounded-xl transition-all bg-white"
                  >
                    <div
                      className="flex items-center space-x-4 flex-1 cursor-pointer"
                      onClick={() => toggleAttendance(member.id)}
                    >
                      <div
                        className="w-6 h-6 rounded-md border-2 flex items-center justify-center relative"
                        style={{
                          backgroundColor: attendance.get(member.id) ? '#1E88E5' : 'white',
                          borderColor: attendance.get(member.id) ? '#1E88E5' : '#D1D5DB'
                        }}
                      >
                        <i
                          className="ri-check-line text-white text-lg absolute"
                          style={{
                            opacity: attendance.get(member.id) ? 1 : 0,
                            transition: 'opacity 0.2s'
                          }}
                        ></i>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{member.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!attendance.get(member.id) && !member.is_newbie && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <select
                            value={absenceReasons.get(member.id) || ''}
                            onChange={async (e) => {
                              const value = e.target.value;
                              let reason = value;

                              if (value === 'custom') {
                                const customReason = prompt('결석 사유를 입력하세요:');
                                if (customReason) {
                                  reason = customReason;
                                  setAbsenceReasons(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(member.id, customReason);
                                    return newMap;
                                  });
                                } else {
                                  return;
                                }
                              } else {
                                setAbsenceReasons(prev => {
                                  const newMap = new Map(prev);
                                  if (value) {
                                    newMap.set(member.id, value);
                                  } else {
                                    newMap.delete(member.id);
                                  }
                                  return newMap;
                                });
                              }

                              // DB에 즉시 저장
                              try {
                                const user = JSON.parse(localStorage.getItem('user') || '{}');
                                const dateStr = formatDate(selectedDate);

                                await supabase
                                  .from('attendance_records')
                                  .update({ absence_reason: reason })
                                  .eq('week_start_date', dateStr)
                                  .eq('member_id', member.id);
                              } catch (error) {
                                console.error('결석 사유 저장 실패:', error);
                              }
                            }}
                            className="px-3 py-2 text-base font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl cursor-pointer appearance-none transition-colors"
                            style={{
                              minWidth: '100px',
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.5rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1.5em 1.5em',
                              paddingRight: '2.5rem'
                            }}
                          >
                            <option value="개인사정">개인사정</option>
                            <option value="타지">타지</option>
                            <option value="질병">질병</option>
                            <option value="출장">출장</option>
                            <option value="custom">기타</option>
                          </select>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(member);
                        }}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
                        title="수정"
                      >
                        <i className="ri-edit-line text-lg"></i>
                      </button>
                    </div>
                  </div>
                  ));
                })()}
              </div>

              {members.length === 0 && (
                <div className="text-center py-12">
                  <i className="ri-user-line text-6xl text-gray-300 mb-4"></i>
                  <p className="text-gray-600">등록된 멤버가 없습니다</p>
                </div>
              )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-3xl font-bold text-gray-800 mb-6">
              {editingMember ? '멤버 수정' : '멤버 추가'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="pt-2 space-y-3">
                <p className="text-base font-bold text-gray-700">역할 <span className="text-red-500">*</span></p>

                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="regular"
                      checked={formData.role === 'regular'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value, zone_leader_id: '', referrer_id: '' })}
                      className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="ml-3 text-base font-semibold text-gray-700">재적</span>
                  </label>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="team_leader"
                      checked={formData.role === 'team_leader'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value, zone_leader_id: '', referrer_id: '' })}
                      className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="ml-3 text-base font-semibold text-gray-700">팀장</span>
                  </label>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="newbie"
                      checked={formData.role === 'newbie'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value, zone_leader_id: '', referrer_id: '' })}
                      className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="ml-3 text-base font-semibold text-gray-700">새신자</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                  placeholder="01012345678"
                />
              </div>

              {/* 새신자인 경우 추가 정보 입력 */}
              {formData.role === 'newbie' && (
                <>
                  <div>
                    <label className="block text-base font-bold text-gray-700 mb-2">
                      연령 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                      placeholder="나이를 입력하세요"
                      min="0"
                      max="150"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-bold text-gray-700 mb-2">
                      지역(동까지만 입력) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                      placeholder="예: 역삼동"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-bold text-gray-700 mb-2">
                      전도자 <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.referrer_id}
                      onChange={(e) => setFormData({ ...formData, referrer_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base cursor-pointer"
                    >
                      <option value="">전도자를 선택하세요</option>
                      {members.filter(m => !m.is_newbie).map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                          {member.is_team_leader ? ' (팀장)' : member.is_zone_leader ? ' (구역장)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-base font-bold text-gray-700 mb-2">
                      성별 <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base cursor-pointer"
                    >
                      <option value="">선택하세요</option>
                      <option value="남">남</option>
                      <option value="여">여</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex space-x-3 pt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                {editingMember && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(editingMember.id)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 font-bold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  style={{ backgroundColor: '#1E88E5', color: 'white' }}
                >
                  {editingMember ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
