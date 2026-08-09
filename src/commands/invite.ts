import { SlashCommand, SlashCreator, CommandContext, ComponentType, TextInputStyle } from 'slash-create'
import { addMonths, subMonths } from 'date-fns'
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

    void ctx.sendModal({
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
    })
  }
}
