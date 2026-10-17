import { migrate } from '../db/index.ts'
import { seedDemo } from '../db/seed.ts'

/*
 *   npm run db:migrate — применить новые миграции
 *   npm run db:seed    — добавить отсутствующие демо-записи (существующие не трогаются)
 */

const cmd = process.argv[2]
const applied = migrate()
if (cmd === 'migrate') {
  console.log(applied.length ? `Применено миграций: ${applied.length}` : 'Схема актуальна')
} else if (cmd === 'seed') {
  seedDemo()
} else {
  console.log('Команды: migrate | seed')
  process.exitCode = 1
}
