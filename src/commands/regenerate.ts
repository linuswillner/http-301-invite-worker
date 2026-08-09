import { AutocompleteContext, CommandContext, CommandOptionType, SlashCommand, SlashCreator } from 'slash-create'
import logger from '../logger'
import { prisma } from '../db'
import { createInviteLink, discordAPI, getPendingInvites } from '../discord-api'
import { RESTGetAPIGuildMemberResult, Routes } from 'discord-api-types/v10'

export default class RegenerateCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'regenerate',
      description: 'Regenerate an invite link.',
      guildIDs: [process.env.DISCORD_GUILD_ID],
      requiredPermissions: ['ADMINISTRATOR'],
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'invite',
          description: 'The invite for which to regenerate the invite link (search by username).',
          autocomplete: true,
          required: true
        }
      ]
    })
  }

  async autocomplete(ctx: AutocompleteContext) {
    const { focused, options } = ctx

    switch (focused) {
      case 'invite': {
        const input: string = String(options.invite)

        const invites = await prisma.invite.findMany({
          where: {
            invitee: {
              username: { contains: input }
            }
          },
          orderBy: {
            invitee: { username: 'asc' }
          },
          include: {
            invitee: true,
            inviter: true
          },
          take: 25
        })

        return invites.map((invite) => ({
          name: `[${invite.id.slice(0, 8)}...] ${invite.invitee.username}, invited by ${invite.inviter.username}`,
          value: invite.id
        }))
      }
      default:
        logger.warn(`Unknown autocompletable field ${focused} for command ${this.commandName}`)
        break
    }
  }

  async run(ctx: CommandContext) {
    const { options } = ctx
    const { invite: id } = options

    if (!id) {
      return await ctx.send({
        content: '❌ No invite ID provided.',
        ephemeral: true
      })
    }

    const invite = await prisma.invite.findFirst({
      where: { id: String(id) },
      include: {
        invitee: true,
        inviter: true
      }
    })

    if (!invite) {
      return await ctx.send({
        content: `❌ No invite found with ID \`${id}\`.`,
        ephemeral: true
      })
    }

    const { code } = invite

    const invites = await getPendingInvites()

    if (invites.find((invite) => invite.code === code)) {
      return await ctx.send({
        content: `✅ An invite code is still valid for that invitation. Link: https://discord.gg/${code}`,
        ephemeral: true
      })
    }

    // Check that invitee is not in the server
    // Try to get their guild membership to check if they're already here
    try {
      const member = (await discordAPI.get(
        Routes.guildMember(ctx.guildID!, invite.invitee.id)
      )) as RESTGetAPIGuildMemberResult

      return await ctx.send({
        ephemeral: true,
        content: `⚠️ User ${member.user.global_name} (username \`${member.user.username}\`, ID \`${member.user.id}\`) is already a member of this server.`
      })
    } catch (err) {
      logger.info(
        `Invitee could not be found in server; this is expected because they are not a member yet. (Error: ${err instanceof Error ? err.message : String(err)})`
      )
      logger.trace(err)
    }

    try {
      const { code } = await createInviteLink(invite)

      await prisma.invite.update({
        where: { id: invite.id },
        data: {
          code
        }
      })

      await ctx.send({
        content: `✅ Invite regenerated. Here is the link: https://discord.gg/${code}`,
        ephemeral: true
      })
    } catch (err) {
      logger.error(`Failed to regenerate invite link:`)
      logger.error(err instanceof Error ? err.stack : err)

      await ctx.send({
        content: '❌ Failed to regenerate invite link.',
        ephemeral: true
      })
    }
  }
}
