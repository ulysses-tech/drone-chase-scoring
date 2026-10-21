import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: GitHub Pages 배포 시 저장소 이름이 경로가 됩니다 (예: /drone-chase-scoring/).
// Netlify·Vercel 등 루트 도메인에 배포할 때는 VITE_BASE 를 '/' 로 두면 됩니다.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || './',
  build: { chunkSizeWarningLimit: 1000 },
});
