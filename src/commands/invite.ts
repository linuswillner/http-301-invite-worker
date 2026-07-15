import {
  SlashCommand,
  SlashCreator,
  CommandContext,
  ComponentType,
  TextInputStyle,
  ButtonStyle
} from 'slash-create/web'
import { addMonths, subMonths } from 'date-fns'
import { discordAPI } from '../discord-api'
import { RESTGetAPIGuildMemberResult, RESTGetAPIUserResult, Routes } from 'discord-api-types/v10'
import logger from '../logger'
import { formatInvitee, formatInviter, makeInviteEmbed } from '../invitation'
import { prisma } from '../db'

export default class InviteCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'invite',
      description: 'Invite someone to HTTP 301.',
      guildIDs: [process.env.DISCORD_GUILD_ID]
    })
  }

  async run(ctx: CommandContext) {
    const latestInviteWithinCadence = await prisma.invite.findFirst({
      where: {
        inviter: { id: ctx.user.id },
        createdAt: { gte: subMonths(new Date(), Number(process.env.INVITE_CADENCE_MONTHS)) }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestInviteWithinCadence) {
      const timeOfNextInvite = addMonths(latestInviteWithinCadence.createdAt, Number(process.env.INVITE_CADENCE_MONTHS))

      const timeInSeconds = (timeOfNextInvite.getTime() / 1000).toFixed(0)

      return await ctx.send({
        ephemeral: true,
        content: `⚠️ You have already invited someone within the last ${process.env.INVITE_CADENCE_MONTHS} months. You may invite someone again on <t:${timeInSeconds}:F> (<t:${timeInSeconds}:R>).\n\nIf you've lost the invite link or are trying to generate a new one, ask the sudo team for assistance.`
      })
    }

    await ctx.sendModal(
      {
        title: 'Invite a user to HTTP 301',
        custom_id: 'invite',
        components: [
          {
            type: ComponentType.TEXT_DISPLAY,
            content:
              'Fill in this form to invite someone to HTTP 301. All information will be posted to the invite log for the benefit of other community members.'
          },
          {
            type: ComponentType.ACTION_ROW,
            components: [
              {
                type: ComponentType.TEXT_INPUT,
                style: TextInputStyle.SHORT,
                custom_id: 'id',
                label: 'User ID'
              }
            ]
          },
          {
            type: ComponentType.TEXT_DISPLAY,
            content:
              'Please provide a brief description of how you know this person and why you think they are a valuable addition to the HTTP 301 community.'
          },
          {
            type: ComponentType.ACTION_ROW,
            components: [
              {
                type: ComponentType.TEXT_INPUT,
                style: TextInputStyle.PARAGRAPH,
                max_length: 1024,
                custom_id: 'description',
                label: 'Invitation context (max 1024 characters)'
              }
            ]
          },
          {
            type: ComponentType.TEXT_DISPLAY,
            content:
              '**Note:** After submitting, you will receive a follow-up message to ensure you are inviting the correct user. The invite will only become valid after confirming this.'
          }
        ]
      },
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (mctx) => {
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
          logger.error(err)
          return await mctx.send({
            ephemeral: true,
            content: `❌ Could not find user with ID \`${id}\`. Are you sure you pasted in the correct ID?`
          })
        }

        // Try to get their guild membership to check if they're already here
        try {
          const member = (await discordAPI.get(
            Routes.guildMember(mctx.guildID!, invitee.id)
          )) as RESTGetAPIGuildMemberResult

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
    )
  }
}
