import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API-сервер при разработке (npm run dev поднимает его на этом порту)
const api = `http://127.0.0.1:${process.env.API_PORT ?? 5190}`
// changeOrigin: false — сервер видит исходный Host и сверяет с ним Origin (защита от CSRF)
const target = { target: api, changeOrigin: false }
const proxy = { '/api': target, '/uploads': target }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, proxy },
  preview: { port: 5181, proxy },
  build: {
    // 3D-чанк (three + drei + postprocessing) загружается лениво, после интерфейса
    chunkSizeWarningLimit: 1200,
  },
})
