export default {
  token: process.env.DISCORD_BOT_TOKEN,
  applicationId: process.env.DISCORD_APP_ID,
  commandPath: './src/commands',
  globalToGuild: process.env.DISCORD_GUILD_ID
}
