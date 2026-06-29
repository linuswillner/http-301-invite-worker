import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { listLocalDatabases } from '@prisma/adapter-d1'

const db = listLocalDatabases().find((db) => !db.startsWith('metadata'))

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: `file:${db}`
  }
})
