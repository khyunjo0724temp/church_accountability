import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Member {
  id: string;
  name: string;
  phone: string;
  is_newbie: boolean;
  is_zone_leader: boolean;
}

export default function Evangelism() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    referrer_id: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      if (!user.team_id) {
        console.error('팀 ID가 없습니다');
        return;
      }

      const { data, error } = await supabase
        .from('members')
        .select('id, name, phone, is_newbie, is_zone_leader')
        .eq('team_id', user.team_id)
        .eq('is_newbie', false)
        .order('name');

      if (error) {
        console.error('멤버 로드 실패:', error);
        return;
      }

      setMembers(data || []);
    } catch (error) {
      console.error('멤버 로드 실패:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // 전도자 정보 가져오기
      const referrer = members.find(m => m.id === formData.referrer_id);
      const zoneLeaderId = referrer?.is_zone_leader ? referrer.id :
        members.find(m => m.is_zone_leader)?.id || null;

      // 새신자를 멤버로 추가
      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          team_id: user.team_id,
          name: formData.name,
          phone: formData.phone,
          is_newbie: true,
          is_zone_leader: false,
          zone_leader_id: zoneLeaderId
        })
        .select()
        .single();

      if (memberError) {
        console.error('멤버 추가 실패:', memberError);
        setErrorMessage('등록에 실패했습니다');
        return;
      }

      // 전도 관계 저장 (referrals 테이블)
      if (formData.referrer_id) {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const { error: referralError } = await supabase
          .from('referrals')
          .insert({
            team_id: user.team_id,
            new_member_id: newMember.id,
            referrer_id: formData.referrer_id,
            depth: 1,
            date: dateStr
          });

        if (referralError) {
          console.error('전도 관계 저장 실패:', referralError);
        }
      }

      setSuccessMessage('새신자가 등록되었습니다');
      setTimeout(() => {
        navigate('/members');
      }, 1500);
    } catch (error) {
      console.error('등록 실패:', error);
      setErrorMessage('서버 연결에 실패했습니다');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/dashboard')} className="cursor-pointer">
                <img
                  src="https://public.readdy.ai/ai/img_res/6f5f4709-4636-4b57-8f60-15ce4bfa71df.png"
                  alt="로고"
                  className="h-10 w-auto object-contain"
                />
              </button>
              <h1 className="text-xl font-bold text-gray-800">새신자 등록</h1>
            </div>
            <button
              onClick={() => navigate('/members')}
              className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer whitespace-nowrap"
            >
              멤버 관리로
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">전도 등록</h2>
            <p className="text-gray-600">새로 등록된 신자 정보를 입력해주세요</p>
          </div>

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="새신자 이름"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전도자 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.referrer_id}
                onChange={(e) => setFormData({ ...formData, referrer_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
              >
                <option value="">전도자를 선택하세요</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.phone}) {member.is_zone_leader ? '- 구역장' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                전도한 팀원을 선택해주세요 (새신자 제외)
              </p>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/members')}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                등록하기
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <h3 className="font-bold text-emerald-800 mb-3 flex items-center">
            <i className="ri-information-line mr-2"></i>
            점수 계산 안내
          </h3>
          <ul className="space-y-2 text-sm text-emerald-700">
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill mr-2 mt-0.5"></i>
              <span>새신자 출석 시: 새신자 본인 +1점 (매주 누적)</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill mr-2 mt-0.5"></i>
              <span>구역장이 전도: 구역장 +1점, 팀장 +1점</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill mr-2 mt-0.5"></i>
              <span>일반 팀원이 전도: 전도자 +1점, 구역장 +1점</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill mr-2 mt-0.5"></i>
              <span>새신자는 결석 집계에서 제외됩니다</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
