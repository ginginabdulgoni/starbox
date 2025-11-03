import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, 'db', 'devices.json')

const adapter = new JSONFile(file)
const db = new Low(adapter, { devices: [] })

export async function initDB() {
  await db.read()
  return db  // 👈 INI WAJIB
}

export { db }
