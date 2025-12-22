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

export default function Members() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [regularMembers, setRegularMembers] = useState<Member[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    is_newbie: false,
    is_team_leader: false,
    referrer_id: ''
  });

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

      // 재적 멤버 목록 (새신자 아닌 사람들)
      const regulars = membersWithInfo.filter((m: Member) => !m.is_newbie);
      setRegularMembers(regulars);
    } catch (error) {
      console.error('멤버 로드 실패:', error);
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
            is_team_leader: formData.is_team_leader
          })
          .eq('id', editingMember.id);

        if (error) {
          console.error('수정 실패:', error);
          return;
        }

        // 새신자이고 전도자가 변경된 경우 referrals 업데이트
        if (formData.is_newbie && formData.referrer_id) {
          // 기존 referral 삭제
          await supabase
            .from('referrals')
            .delete()
            .eq('new_member_id', editingMember.id);

          // 새 referral 추가
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
        const { error } = await supabase
          .from('members')
          .insert({
            team_id: user.team_id,
            name: formData.name,
            phone: formData.phone,
            is_newbie: formData.is_newbie,
            is_team_leader: formData.is_team_leader
          });

        if (error) {
          console.error('추가 실패:', error);
          return;
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
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const openAddModal = () => {
    setEditingMember(null);
    setFormData({
      name: '',
      phone: '',
      is_newbie: false,
      is_team_leader: false,
      referrer_id: ''
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
      is_team_leader: member.is_team_leader,
      referrer_id: referrerId
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/dashboard')} className="cursor-pointer">
                <img
                  src="/logo.png"
                  alt="로고"
                  className="h-10 w-auto object-contain"
                />
              </button>
              <h1 className="text-xl font-bold text-gray-800">멤버 관리</h1>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap"
            >
              대시보드로
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div className="mb-4 md:mb-0">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">팀원 목록</h2>
            <p className="text-gray-600">총 {members.length}명</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-6 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-user-add-line text-xl"></i>
            <span>멤버 추가</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {members.map((member) => (
            <div key={member.id} className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-base font-bold text-gray-800">{member.name}</h3>
                    {member.is_team_leader && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded whitespace-nowrap">
                        팀장
                      </span>
                    )}
                    {member.is_newbie && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full whitespace-nowrap">
                        새신자
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {member.is_newbie && member.referrer_name && (
                      <div className="flex items-center text-xs text-emerald-600">
                        <i className="ri-user-heart-line mr-1"></i>
                        <span>전도자: {member.referrer_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => openEditModal(member)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
                    title="수정"
                  >
                    <i className="ri-edit-line text-lg"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="삭제"
                  >
                    <i className="ri-delete-bin-line text-lg"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <i className="ri-user-line text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-600">등록된 멤버가 없습니다</p>
          </div>
        )}
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
                <p className="text-sm font-semibold text-gray-700">역할 <span className="text-red-500">*</span></p>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={!formData.is_newbie && !formData.is_team_leader}
                      onChange={() => setFormData({ ...formData, is_newbie: false, is_team_leader: false, referrer_id: '' })}
                      className="w-5 h-5 text-teal-600 border-gray-300 focus:ring-teal-500 cursor-pointer"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">재적</span>
                  </label>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={formData.is_team_leader}
                      onChange={() => setFormData({ ...formData, is_team_leader: true, is_newbie: false, referrer_id: '' })}
                      className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">팀장</span>
                  </label>

                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={formData.is_newbie}
                      onChange={() => setFormData({ ...formData, is_newbie: true, is_team_leader: false })}
                      className="w-5 h-5 text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">새신자</span>
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
                    {regularMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}{member.is_team_leader ? ' (팀장)' : ''}
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