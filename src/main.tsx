import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// 서비스 워커 자동 업데이트 (autoUpdate 모드)
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    console.log('Service Worker 등록됨:', swUrl);
    // 주기적으로 업데이트 체크 (60초마다)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60000);
    }
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
