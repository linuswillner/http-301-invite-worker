import {
  ButtonStyle,
  ComponentContext,
  ComponentType,
  MessageEmbedOptions,
  ModalInteractionContext,
  User
} from 'slash-create'
import { calculateUserDefaultAvatarIndex } from '@discordjs/rest'
import { RESTGetAPIGuildMemberResult, RESTGetAPIUserResult, Routes } from 'discord-api-types/v10'
import { Prisma } from './generated/prisma/client'
import { FullInvite } from './types'
import { prisma } from './db'
import logger from './logger'
import { createInviteLink, discordAPI, sendToInviteLog } from './discord-api'

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

export async function handleInviteModal(mctx: ModalInteractionContext) {
  const id = String(mctx.values.id)

  logger.info(
    `User ${mctx.user.globalName} (username \`${mctx.user.username}\`, ID \`${mctx.user.id}\`) is inviting user ${id}.`
  )

  // Try to get invitee user information, validating whether they are a real user
  let invitee: RESTGetAPIUserResult

  try {
    invitee = (await discordAPI.get(Routes.user(id))) as RESTGetAPIUserResult
  } catch (err) {
    logger.error('Failed to fetch invitee information:')
    logger.error(err instanceof Error ? err.stack : err)
    return await mctx.send({
      ephemeral: true,
      content: `❌ Could not find user with ID \`${id}\`. Are you sure you pasted in the correct ID?`
    })
  }

  // Reject invalid user types
  if (invitee.bot || invitee.system) {
    return await mctx.send({
      ephemeral: true,
      content: `❌ User with ID \`${id}\` (username: \`${invitee.username}\`) is a bot or system user that cannot accept an invite.`
    })
  }

  // Reject deleted users
  if (invitee.username.startsWith('deleted_user')) {
    return await mctx.send({
      ephemeral: true,
      content: `❌ User with ID \`${id}\` (username: \`${invitee.username}\`) is a deleted user.`
    })
  }

  // Try to get their guild membership to check if they're already here
  try {
    const member = (await discordAPI.get(Routes.guildMember(mctx.guildID!, invitee.id))) as RESTGetAPIGuildMemberResult

    return await mctx.send({
      ephemeral: true,
      content: `⚠️ User ${member.user.global_name} (username \`${member.user.username}\`, ID \`${member.user.id}\`) is already a member of this server.`
    })
  } catch (err) {
    logger.info(
      `Invitee could not be found in server; this is expected because they are not a member yet. (Error: ${err instanceof Error ? err.message : String(err)})`
    )
    logger.trace(err)
  }

  // Update invitee user info
  await prisma.userMetadata.upsert({
    where: { id: invitee.id },
    create: formatInvitee(invitee),
    update: formatInvitee(invitee)
  })

  // Update inviter user info
  await prisma.userMetadata.upsert({
    where: { id: mctx.user.id },
    create: formatInviter(mctx.user),
    update: formatInviter(mctx.user)
  })

  const invite = await prisma.invite.create({
    data: {
      interactionID: mctx.interactionID,
      description: String(mctx.values.description),
      invitee: {
        connect: { id: invitee.id }
      },
      inviter: {
        connect: { id: mctx.user.id }
      }
    },
    include: {
      invitee: true,
      inviter: true
    }
  })

  const embed = makeInviteEmbed(invite)

  await mctx.send({
    ephemeral: true,
    content:
      'This is a preview of your invitation. Please confirm the user is correct and it is otherwise to your liking.',
    embeds: [embed],
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.SUCCESS,
            custom_id: 'confirm-invite',
            label: "Yes, that's correct",
            emoji: { name: '✅' }
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DANGER,
            custom_id: 'cancel-invite',
            label: 'No, cancel'
          }
        ]
      }
    ]
  })
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

    if (invite.code) {
      return await ctx.send({
        ephemeral: true,
        content: `⚠️ That invitation has already been confirmed. Here is the link to share with the invitee: https://discord.gg/${invite.code}`
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

      await ctx.editParent({
        content: `✅ Invitation confirmed. Here is the invite link to share with the invitee: https://discord.gg/${code}`,
        components: [],
        embeds: []
      })
    } catch (err) {
      logger.error(`Failed to confirm invitation:`)
      logger.error(err instanceof Error ? err.stack : err)

      return await ctx.send({
        ephemeral: true,
        content: '❌ The invitation could not be confirmed. Please ask the sudo team for assistance.'
      })
    }
  } catch (err) {
    logger.error(`Failed to confirm invite:`)
    logger.error(err instanceof Error ? err.stack : err)
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
      logger.error(err instanceof Error ? err.stack : err)

      return await ctx.send({
        ephemeral: true,
        content: '❌ The invitation could not be deleted. Please ask the sudo team for assistance.'
      })
    }

    await ctx.editParent({ content: '✅ Invitation cancelled.', embeds: [], components: [] })
  } catch (err) {
    logger.error(`Failed to cancel invite:`)
    logger.error(err instanceof Error ? err.stack : err)
  }
}
