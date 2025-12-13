import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AttendanceList() {
  const navigate = useNavigate();

  useEffect(() => {
    // 이 페이지는 더 이상 사용되지 않으므로 reports로 리다이렉트
    navigate('/reports', { replace: true });
  }, [navigate]);

  return null;
}
