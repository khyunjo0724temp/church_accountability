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
        const referrer = referralRecord?.referrer_id
          ? data.find((m: any) => m.id === referralRecord.referrer_id)
          : null;

        return {
          ...member,
          zone_leader_name: zoneLeader?.name || null,
          referrer_name: referrer?.name || null
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
            zone_leader_id: formData.is_zone_leader ? null : (formData.zone_leader_id || null)
          })
          .eq('id', editingMember.id);

        if (error) {
          console.error('수정 실패:', error);
          return;
        }

        // 새신자이고 전도자가 변경된 경우 referrals 업데이트
        if (formData.is_newbie && formData.referrer_id) {
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
            zone_leader_id: formData.is_zone_leader ? null : (formData.zone_leader_id || null)
          })
          .select()
          .single();

        if (error) {
          console.error('추가 실패:', error);
          return;
        }

        // 새신자인 경우 referrals 테이블에 전도자 정보 저장
        if (formData.is_newbie && formData.referrer_id && newMember) {
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
  const newbieMembers = members.filter(m => m.is_newbie);
  const membersByZoneLeader = new Map<string, Member[]>();

  members.forEach(member => {
    if (member.is_newbie) return; // 새신자는 별도 섹션

    if (member.is_zone_leader) {
      // 구역장은 자신의 그룹에 포함
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
  });


  const presentCount = Array.from(attendance.values()).filter(v => v).length;
  // 재적 멤버(새신자 아닌 사람) 중 결석자만 계산
  const regularMembersCount = members.filter(m => !m.is_newbie).length;
  const regularPresentCount = members.filter(m => !m.is_newbie && attendance.get(m.id)).length;
  const absentCount = regularMembersCount - regularPresentCount;

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
              <h1 className="text-xl font-bold text-gray-800">주간 출석 체크</h1>
            </div>
            <div className="flex items-center space-x-6">
              <button
                onClick={() => navigate('/attendance')}
                className="text-sm font-medium text-teal-600 border-b-2 border-teal-600 pb-1 cursor-pointer whitespace-nowrap"
              >
                출석 체크
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="text-sm font-medium text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap"
              >
                리포트 조회
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주일 선택
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousWeek}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-s-line text-xl text-gray-700"></i>
                </button>
                <div className="px-6 py-2 bg-teal-50 border-2 border-teal-500 rounded-lg">
                  <p className="text-lg font-bold text-teal-700">
                    {formatDisplayDate(selectedDate)}
                  </p>
                </div>
                <button
                  onClick={goToNextWeek}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-right-s-line text-xl text-gray-700"></i>
                </button>
              </div>
            </div>

            <div className="flex space-x-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">출석</p>
                <p className="text-2xl font-bold text-teal-600">{presentCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">결석</p>
                <p className="text-2xl font-bold text-orange-600">{absentCount}</p>
              </div>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">멤버 출석 체크</h3>
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-user-add-line text-lg"></i>
              <span>멤버 추가</span>
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
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection('newbies')}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <i className={`ri-arrow-${expandedSections.has('newbies') ? 'down' : 'right'}-s-line text-xl text-gray-700`}></i>
                      <h4 className="font-bold text-gray-800">새신자</h4>
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
                          className="flex items-center justify-between p-3 border border-gray-200 hover:border-gray-300 rounded-lg transition-all"
                        >
                          <div
                            className="flex items-center space-x-4 flex-1 cursor-pointer"
                            onClick={() => toggleAttendance(member.id)}
                          >
                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                              attendance.get(member.id)
                                ? 'bg-teal-600 border-teal-600'
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
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer ml-3"
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
                  <div key={leaderId} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection(leaderId)}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <i className={`ri-arrow-${expandedSections.has(leaderId) ? 'down' : 'right'}-s-line text-xl text-gray-700`}></i>
                        <h4 className="font-bold text-gray-800">{leaderName} 구역</h4>
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
                            className="flex items-center justify-between p-3 border border-gray-200 hover:border-gray-300 rounded-lg transition-all"
                          >
                            <div
                              className="flex items-center space-x-4 flex-1 cursor-pointer"
                              onClick={() => toggleAttendance(member.id)}
                            >
                              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                                attendance.get(member.id)
                                  ? 'bg-teal-600 border-teal-600'
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
                              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer ml-3"
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

        <div className="flex space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || members.length === 0}
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-4 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {saving ? '저장 중...' : '출석 저장'}
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-black/50 flex items-center justify-center p-4 z-50">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
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
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
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

              {formData.is_newbie && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    전도자 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required={formData.is_newbie}
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
              )}

              {formData.is_newbie && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    소속 구역장 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required={formData.is_newbie}
                    value={formData.zone_leader_id}
                    onChange={(e) => setFormData({ ...formData, zone_leader_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="">구역장을 선택하세요</option>
                    {zoneLeaders.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!formData.is_newbie && !formData.is_zone_leader && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    소속 구역장 <span className="text-red-500">*</span>
                  </label>
                  <select
                    required={!formData.is_newbie && !formData.is_zone_leader}
                    value={formData.zone_leader_id}
                    onChange={(e) => setFormData({ ...formData, zone_leader_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="">구역장을 선택하세요</option>
                    {zoneLeaders.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                {editingMember && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingMember.id)}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
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
