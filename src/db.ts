import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from './generated/prisma/client'
import logger from './logger'

let prisma: PrismaClient

export { prisma }

export function makePrismaClient(env: Env) {
  if (!prisma) {
    const client = new PrismaClient({
      adapter: new PrismaD1(env.db),
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'query', emit: 'event' }
      ]
    })

    client.$on('warn', (e) => logger.warn(e))
    client.$on('error', (e) => logger.error(e))
    client.$on('query', (e) => logger.trace(e))
    client.$on('info', (e) => logger.info(e))

    prisma = client
  }

  return prisma
}
