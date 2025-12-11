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
}

export default function Attendance() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [savedAttendance, setSavedAttendance] = useState<Map<string, boolean>>(new Map()); // 저장된 출석 상태 (정렬용)
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
    is_newbie: false,
    is_zone_leader: false,
    zone_leader_id: '',
    referrer_id: ''
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (members.length > 0) {
      fetchAttendance();
    }
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

  const fetchMembers = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      if (!user.team_id) {
        console.error('팀 ID가 없습니다');
        return;
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
      const dateStr = formatDate(selectedDate);

      const { data, error } = await supabase
        .from('attendance_records')
        .select('member_id, present')
        .eq('week_start_date', dateStr);

      if (error) {
        console.error('출석 기록 로드 실패:', error);
        return;
      }

      // 기존 출석 기록으로 상태 업데이트
      const newAttendance = new Map<string, boolean>();
      members.forEach((m: Member) => {
        const record = data?.find(r => r.member_id === m.id);
        newAttendance.set(m.id, record?.present || false);
      });
      setAttendance(newAttendance);
      setSavedAttendance(new Map(newAttendance)); // 저장된 상태도 업데이트 (정렬용)
    } catch (error) {
      console.error('출석 기록 로드 실패:', error);
    }
  };

  const toggleAttendance = (memberId: string) => {
    setAttendance(prev => {
      const newMap = new Map(prev);
      newMap.set(memberId, !prev.get(memberId));
      return newMap;
    });
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
          present
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
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('저장 실패:', error);
      alert('출석 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // 전도자에 따라 zone_leader_id 자동 계산
      let calculatedZoneLeaderId = null;

      if (formData.referrer_id === user.id) {
        // 팀장이 전도 → 팀장 직속 (zone_leader_id = null)
        calculatedZoneLeaderId = null;
      } else {
        // 일반 멤버가 전도
        const referrer = members.find(m => m.id === formData.referrer_id);
        if (referrer) {
          if (referrer.is_zone_leader) {
            // 구역장이 전도 → 해당 구역장 직속
            calculatedZoneLeaderId = referrer.id;
          } else {
            // 재적이 전도 → 전도자의 구역장 직속
            calculatedZoneLeaderId = referrer.zone_leader_id;
          }
        }
      }

      if (editingMember) {
        // 수정
        const { error } = await supabase
          .from('members')
          .update({
            name: formData.name,
            phone: formData.phone,
            is_newbie: formData.is_newbie,
            is_zone_leader: formData.is_zone_leader,
            is_team_leader: false,
            zone_leader_id: formData.is_zone_leader ? null : calculatedZoneLeaderId
          })
          .eq('id', editingMember.id);

        if (error) {
          console.error('수정 실패:', error);
          return;
        }

        // 전도자가 변경된 경우 referrals 업데이트
        if (formData.referrer_id) {
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
        const { data: newMember, error } = await supabase
          .from('members')
          .insert({
            team_id: user.team_id,
            name: formData.name,
            phone: formData.phone,
            is_newbie: formData.is_newbie,
            is_zone_leader: formData.is_zone_leader,
            is_team_leader: false,
            zone_leader_id: formData.is_zone_leader ? null : calculatedZoneLeaderId
          })
          .select()
          .single();

        if (error) {
          console.error('추가 실패:', error);
          return;
        }

        // 전도자가 있는 경우 referrals 테이블에 전도자 정보 저장
        if (formData.referrer_id && newMember) {
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

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('삭제 실패:', error);
        return;
      }

      fetchMembers();
      closeModal();
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const openAddModal = () => {
    setEditingMember(null);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setFormData({
      name: '',
      phone: '',
      is_newbie: false,
      is_zone_leader: false,
      zone_leader_id: '',
      referrer_id: user.id || '' // 팀장을 기본 전도자로 설정
    });
    setShowAddModal(true);
  };

  const openEditModal = async (member: Member) => {
    setEditingMember(member);

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
      is_newbie: member.is_newbie,
      is_zone_leader: member.is_zone_leader,
      zone_leader_id: member.zone_leader_id || '',
      referrer_id: referrerId
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
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


  const presentCount = Array.from(attendance.values()).filter(v => v).length;
  // 재적 멤버(새신자 아닌 사람) 중 결석자만 계산
  const regularMembersCount = members.filter(m => !m.is_newbie).length;
  const regularPresentCount = members.filter(m => !m.is_newbie && attendance.get(m.id)).length;
  const absentCount = regularMembersCount - regularPresentCount;

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
            <h1 className="text-lg font-bold text-gray-900">출석 체크</h1>
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
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors"
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
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 text-gray-700 rounded-lg font-medium cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-bar-chart-box-line text-xl text-gray-600"></i>
              <span className="text-gray-900">리포트 조회</span>
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
            >
              <i className="ri-arrow-left-s-line text-2xl text-gray-700"></i>
            </button>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <button
              onClick={goToNextWeek}
              className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-arrow-right-s-line text-2xl text-gray-700"></i>
            </button>
          </div>
        </div>

        {/* 출석/결석 통계 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-50 rounded-xl p-4 text-center">
              <div className="flex justify-center mb-2">
                <i className="ri-user-follow-line text-2xl text-primary-600"></i>
              </div>
              <p className="text-xs font-medium text-gray-600 mb-1">출석</p>
              <p className="text-2xl font-bold text-primary-600">{presentCount}</p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <div className="flex justify-center mb-2">
                <i className="ri-user-unfollow-line text-2xl text-gray-600"></i>
              </div>
              <p className="text-xs font-medium text-gray-600 mb-1">결석</p>
              <p className="text-2xl font-bold text-gray-900">{absentCount}</p>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {/* 멤버 출석 체크 카드 */}
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">멤버 출석 체크</h3>
            <button
              onClick={openAddModal}
              className="flex items-center space-x-1.5 text-primary-600 hover:text-primary-700 font-semibold py-2 px-3 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer whitespace-nowrap text-sm"
            >
              <i className="ri-user-add-line text-lg"></i>
              <span>추가</span>
            </button>
          </div>

          {members.length === 0 ? (
            <div className="text-center py-12">
              <i className="ri-user-line text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-600">등록된 멤버가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 새신자 섹션 */}
              {newbieMembers.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('newbies')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <i className={`ri-arrow-${expandedSections.has('newbies') ? 'down' : 'right'}-s-line text-xl text-gray-700`}></i>
                      <h4 className="font-bold text-gray-800">새신자 명단</h4>
                      <span className="text-sm text-gray-600">
                        ({newbieMembers.filter(m => attendance.get(m.id)).length}/{newbieMembers.length} 출석)
                      </span>
                    </div>
                  </button>
                  {expandedSections.has('newbies') && (
                    <div className="p-3 space-y-2 bg-white">
                      {newbieMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 border border-gray-200 hover:border-gray-300 rounded-xl transition-all"
                        >
                          <div
                            className="flex items-center space-x-4 flex-1 cursor-pointer"
                            onClick={() => toggleAttendance(member.id)}
                          >
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                              attendance.get(member.id)
                                ? 'bg-primary-500 border-primary-500'
                                : 'border-gray-300'
                            }`}>
                              {attendance.get(member.id) && (
                                <i className="ri-check-line text-white text-lg"></i>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{member.name}</p>
                              {member.referrer_name && (
                                <p className="text-xs text-gray-500 mt-1">전도자: {member.referrer_name}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(member);
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer ml-3"
                            title="수정"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 팀장 섹션 */}
              {teamLeaderMembers.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('teamleader')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <i className={`ri-arrow-${expandedSections.has('teamleader') ? 'down' : 'right'}-s-line text-xl text-gray-700`}></i>
                      <h4 className="font-bold text-gray-800">팀장</h4>
                      <span className="text-sm text-gray-600">
                        ({teamLeaderMembers.filter(m => attendance.get(m.id)).length}/{teamLeaderMembers.length} 출석)
                      </span>
                    </div>
                  </button>
                  {expandedSections.has('teamleader') && (
                    <div className="p-3 space-y-2 bg-white">
                      {teamLeaderMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 border border-gray-200 hover:border-gray-300 rounded-xl transition-all"
                        >
                          <div
                            className="flex items-center space-x-4 flex-1 cursor-pointer"
                            onClick={() => toggleAttendance(member.id)}
                          >
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                              attendance.get(member.id)
                                ? 'bg-primary-500 border-primary-500'
                                : 'border-gray-300'
                            }`}>
                              {attendance.get(member.id) && (
                                <i className="ri-check-line text-white text-lg"></i>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{member.name}</p>
                              {member.referrer_name && (
                                <p className="text-xs text-gray-500 mt-1">전도자: {member.referrer_name}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(member);
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer ml-3"
                            title="수정"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 구역장별 섹션 */}
              {Array.from(membersByZoneLeader.entries()).map(([leaderId, groupMembers]) => {
                const leader = groupMembers.find(m => m.id === leaderId);
                const leaderName = leader?.name || '알 수 없음';
                const presentInGroup = groupMembers.filter(m => attendance.get(m.id)).length;

                return (
                  <div key={leaderId} className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(leaderId)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <i className={`ri-arrow-${expandedSections.has(leaderId) ? 'down' : 'right'}-s-line text-xl text-gray-700`}></i>
                        <h4 className="font-bold text-gray-800">{leaderName} 구역 재정명단</h4>
                        <span className="text-sm text-gray-600">
                          ({presentInGroup}/{groupMembers.length} 출석)
                        </span>
                      </div>
                    </button>
                    {expandedSections.has(leaderId) && (
                      <div className="p-3 space-y-2 bg-white">
                        {groupMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 border border-gray-200 hover:border-gray-300 rounded-xl transition-all"
                          >
                            <div
                              className="flex items-center space-x-4 flex-1 cursor-pointer"
                              onClick={() => toggleAttendance(member.id)}
                            >
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                                attendance.get(member.id)
                                  ? 'bg-primary-500 border-primary-500'
                                  : 'border-gray-300'
                              }`}>
                                {attendance.get(member.id) && (
                                  <i className="ri-check-line text-white text-lg"></i>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="font-medium text-gray-800">{member.name}</p>
                                  {member.is_zone_leader && (
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded whitespace-nowrap">
                                      구역장
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(member);
                              }}
                              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer ml-3"
                              title="수정"
                            >
                              <i className="ri-edit-line text-lg"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || members.length === 0}
            className="flex-1 font-semibold py-4 rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            style={{ backgroundColor: '#1E88E5', color: 'white' }}
          >
            {saving ? '저장 중...' : '출석 저장'}
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingMember ? '멤버 수정' : '멤버 추가'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  placeholder="01012345678"
                />
              </div>

              <div className="pt-2 space-y-3 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700">역할</p>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_zone_leader"
                    checked={formData.is_zone_leader}
                    onChange={(e) => setFormData({ ...formData, is_zone_leader: e.target.checked, zone_leader_id: e.target.checked ? '' : formData.zone_leader_id })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                  />
                  <label htmlFor="is_zone_leader" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                    구역장
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_newbie"
                    checked={formData.is_newbie}
                    onChange={(e) => setFormData({ ...formData, is_newbie: e.target.checked })}
                    className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="is_newbie" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                    새신자
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  전도자 <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.referrer_id}
                  onChange={(e) => setFormData({ ...formData, referrer_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                >
                  <option value="">전도자를 선택하세요</option>
                  {(() => {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    return (
                      <>
                        <option key={user.id} value={user.id}>
                          {user.name} (팀장)
                        </option>
                        {regularMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}{member.is_zone_leader ? ' (구역장)' : ''}
                          </option>
                        ))}
                      </>
                    );
                  })()}
                </select>
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                {editingMember && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingMember.id)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 font-semibold py-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
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
