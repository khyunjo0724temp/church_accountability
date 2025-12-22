import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// 서비스 워커 자동 업데이트
let updatePending = false;
let idleTimer: NodeJS.Timeout | null = null;

const performUpdate = registerSW({
  onNeedRefresh() {
    console.log('새 버전이 감지되었습니다. 자동으로 업데이트합니다.');
    updatePending = true;

    // 유휴 상태 감지: 30초 동안 활동이 없으면 새로고침
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (updatePending) {
          console.log('유휴 상태 감지: 앱을 업데이트합니다.');
          performUpdate();
        }
      }, 30000); // 30초
    };

    // 사용자 활동 감지
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetIdleTimer, { passive: true });
    });

    resetIdleTimer();

    // 페이지 전환 시 자동 업데이트
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      if (updatePending) {
        console.log('페이지 전환 감지: 앱을 업데이트합니다.');
        performUpdate();
      }
      return originalPushState.apply(this, args);
    };

    history.replaceState = function(...args) {
      if (updatePending) {
        console.log('페이지 전환 감지: 앱을 업데이트합니다.');
        performUpdate();
      }
      return originalReplaceState.apply(this, args);
    };
  },
  onOfflineReady() {
    console.log('앱이 오프라인에서 사용 가능합니다.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
