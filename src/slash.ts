import { CloudflareWorkerServer, SlashCreator } from 'slash-create'
import commands from './commands'
import logger from './logger'
import { cancelInvite, confirmInvite } from './invitation'

export function makeSlashCreator(env: Env, server: CloudflareWorkerServer) {
  const creator = new SlashCreator({
    applicationID: env.DISCORD_APP_ID,
    publicKey: env.DISCORD_PUBLIC_KEY,
    token: env.DISCORD_BOT_TOKEN
  })

  creator.withServer(server).registerCommands(commands)

  creator.on('warn', (message) => logger.warn(message))
  creator.on('error', (error) => logger.error(error))
  creator.on('commandRun', (command, _, ctx) =>
    logger.info(`${ctx.user.username} (${ctx.user.id}) ran command ${command.commandName}`)
  )
  creator.on('commandError', (command, error) => logger.error(error, `Command ${command.commandName} errored`))

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  creator.registerGlobalComponent('confirm-invite', confirmInvite)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  creator.registerGlobalComponent('cancel-invite', cancelInvite)

  return creator
}
