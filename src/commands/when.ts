import { CommandContext, SlashCommand, SlashCreator } from 'slash-create'
import { prisma } from '../db'
import { addMonths, subMonths } from 'date-fns'

export default class WhenCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'when',
      description: 'Check when you can invite someone again.',
      guildIDs: [process.env.DISCORD_GUILD_ID]
    })
  }

  async run(ctx: CommandContext) {
    const latestInviteWithinCadence = await prisma.invite.findFirst({
      where: {
        inviter: { id: ctx.user.id },
        createdAt: { gte: subMonths(new Date(), Number(process.env.INVITE_CADENCE_MONTHS)) }
      },
      include: {
        invitee: true
      },
      orderBy: { createdAt: 'desc' }
    })

    if (latestInviteWithinCadence) {
      const timeOfThisInvite = latestInviteWithinCadence.createdAt
      const timeOfNextInvite = addMonths(latestInviteWithinCadence.createdAt, Number(process.env.INVITE_CADENCE_MONTHS))

      const thisSeconds = (timeOfThisInvite.getTime() / 1000).toFixed(0)
      const nextSeconds = (timeOfNextInvite.getTime() / 1000).toFixed(0)

      return await ctx.send({
        ephemeral: true,
        content: `🕒 You last invited <@${latestInviteWithinCadence.invitee.id}> (${latestInviteWithinCadence.invitee.username}) on <t:${thisSeconds}:F> (<t:${thisSeconds}:R>).\n\n⏳ You may invite someone again on <t:${nextSeconds}:F> (<t:${nextSeconds}:R>).`
      })
    }

    await ctx.send({
      content: `✅ You have an invite available! Use \`/invite\` to get started.`,
      ephemeral: true
    })
  }
}
