import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// API-СЃРµСЂРІРµСЂ РїСЂРё СЂР°Р·СЂР°Р±РѕС‚РєРµ (npm run dev РїРѕРґРЅРёРјР°РµС‚ РµРіРѕ РЅР° СЌС‚РѕРј РїРѕСЂС‚Сѓ)
const api = `http://127.0.0.1:${process.env.API_PORT ?? 5190}`
// changeOrigin: false вЂ” СЃРµСЂРІРµСЂ РІРёРґРёС‚ РёСЃС…РѕРґРЅС‹Р№ Host Рё СЃРІРµСЂСЏРµС‚ СЃ РЅРёРј Origin (Р·Р°С‰РёС‚Р° РѕС‚ CSRF)
const target = { target: api, changeOrigin: false }
const proxy = { '/api': target, '/uploads': target }

// https://vite.dev/config/
export default defineConfig({
  base: '/WebCraft/',
  plugins: [react()],
  server: { port: 5180, proxy },
  preview: { port: 5181, proxy },
  build: {
    // 3D-С‡Р°РЅРє (three + drei + postprocessing) Р·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ Р»РµРЅРёРІРѕ, РїРѕСЃР»Рµ РёРЅС‚РµСЂС„РµР№СЃР°
    chunkSizeWarningLimit: 1200,
  },
})

