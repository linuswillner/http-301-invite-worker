import { ComponentContext, MessageEmbedOptions, User } from 'slash-create'
import { calculateUserDefaultAvatarIndex } from '@discordjs/rest'
import { RESTGetAPIUserResult } from 'discord-api-types/v10'
import { Prisma } from './generated/prisma/client'
import { FullInvite } from './types'
import { prisma } from './db'
import logger from './logger'
import { createInviteLink, sendToInviteLog } from './discord-api'

export const avatarURL = (userID: string, avatarID: string) =>
  `https://cdn.discordapp.com/avatars/${userID}/${avatarID}.${avatarID?.startsWith('a_') ? 'gif' : 'png'}`

export const defaultAvatarURL = (userID: string) =>
  `https://cdn.discordapp.com/embed/avatars/${calculateUserDefaultAvatarIndex(userID)}.png`

export function makeInviteEmbed(invite: FullInvite): MessageEmbedOptions {
  const { inviter, invitee, description, createdAt } = invite

  return {
    title: `📩 Invitation: ${invitee.displayName}`,
    color: 0x473bf0,
    timestamp: createdAt,
    fields: [
      { name: '🧑 Username', value: invitee.username },
      { name: '🙋 Display name', value: invitee.displayName ?? invitee.username },
      { name: '🔗 User ID', value: invitee.id },
      { name: '📄 Invitation context', value: description }
    ],
    thumbnail: {
      url: invitee.avatarURL
    },
    footer: {
      icon_url: inviter.avatarURL,
      text: `Invited by ${inviter.displayName} (${inviter.username})`
    }
  }
}

export function formatInvitee(invitee: RESTGetAPIUserResult): Prisma.UserMetadataCreateInput {
  return {
    id: invitee.id,
    username: invitee.username,
    displayName: invitee.global_name ?? invitee.username,
    avatarURL: invitee.avatar ? avatarURL(invitee.id, invitee.avatar) : defaultAvatarURL(invitee.id)
  }
}

export function formatInviter(inviter: User): Prisma.UserMetadataCreateInput {
  return {
    id: inviter.id,
    username: inviter.username,
    displayName: inviter.globalName ?? inviter.username,
    avatarURL: inviter.avatar ? avatarURL(inviter.id, inviter.avatar) : defaultAvatarURL(inviter.id)
  }
}

export async function confirmInvite(ctx: ComponentContext) {
  try {
    const invite = await prisma.invite.findFirst({
      where: { interactionID: ctx.message.interactionMetadata!.id },
      include: { inviter: true, invitee: true }
    })

    if (!invite) {
      logger.error(`Invite not found for interaction ID ${ctx.message.interactionMetadata!.id}`)

      return await ctx.send({
        ephemeral: true,
        content: '❌ The invitation could not be found. Please ask the sudo team for assistance.'
      })
    }

    try {
      const { code } = await createInviteLink(invite)

      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          valid: true,
          code
        }
      })

      logger.info(
        `User ${invite.inviter.username} (${invite.inviter.id}) submitted invitation for user ${invite.invitee.displayName} (${invite.invitee.username}, \`${invite.invitee.id}\`), with code ${code}`
      )

      await sendToInviteLog(ctx.message.embeds[0])

      await ctx.edit(ctx.message.id, {
        content: `✅ Invitation confirmed. Here is the invite link to share with the invitee: https://discord.gg/${code}`,
        components: [],
        embeds: []
      })
    } catch (err) {
      logger.error(`Failed to confirm invitation:`)
      logger.error(err)

      return await ctx.send({
        ephemeral: true,
        content: '❌ The invitation could not be confirmed. Please ask the sudo team for assistance.'
      })
    }
  } catch (err) {
    logger.error(`Failed to confirm invite:`)
    logger.error(err)
  }
}

export async function cancelInvite(ctx: ComponentContext) {
  try {
    const invite = await prisma.invite.findFirst({ where: { interactionID: ctx.message.interactionMetadata!.id } })

    if (!invite) {
      logger.warn(
        `Invite not found for interaction ID ${ctx.message.interactionMetadata!.id}, it might already have been deleted`
      )
      return
    }

    try {
      await prisma.invite.delete({ where: { id: invite.id } })
    } catch (err) {
      logger.error(`Failed to delete invite:`)
      logger.error(err)

      return await ctx.send({
        ephemeral: true,
        content: '❌ The invitation could not be deleted. Please ask the sudo team for assistance.'
      })
    }

    await ctx.edit(ctx.message.id, { content: '✅ Invitation cancelled.', components: [], embeds: [] })
  } catch (err) {
    logger.error(`Failed to cancel invite:`)
    logger.error(err)
  }
}
