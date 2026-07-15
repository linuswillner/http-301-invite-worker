import { CommandContext, SlashCommand, SlashCreator } from 'slash-create'

export default class PingCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'ping',
      description: 'Check if the bot is responding.',
      guildIDs: [process.env.DISCORD_GUILD_ID]
    })
  }

  async run(ctx: CommandContext) {
    const nowSeconds = (Date.now() / 1000).toFixed(0)

    await ctx.send({
      content: `🏓 Pong! Received your command at <t:${nowSeconds}:F> (<t:${nowSeconds}:R>).`
    })
  }
}
