import { CloudflareWorkerServer, SlashCreator } from 'slash-create'
import { makeSlashCreator } from './slash'
import { makePrismaClient } from './db'
import { makeDiscordRESTClient } from './discord-api'

const slashCreateCFServer = new CloudflareWorkerServer()

let slash: SlashCreator

export default {
  async fetch(request, env, ctx): Promise<Response> {
    if (!slash) {
      slash = makeSlashCreator(env, slashCreateCFServer)
    }

    makePrismaClient(env)
    makeDiscordRESTClient(env)

    // slash-creates types are way too unnecessarily broad here
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return slashCreateCFServer.fetch(request, env, ctx)
  }
} satisfies ExportedHandler<Env>
