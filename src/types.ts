import { Prisma, PrismaClient } from './generated/prisma/client'

export interface HonoBindings {
  Bindings: Env
  Variables: {
    prisma: PrismaClient
  }
}

export type FullInvite = Prisma.InviteGetPayload<{ include: { inviter: true; invitee: true } }>
