import { REST } from '@discordjs/rest'
import { RESTGetAPIChannelInvitesResult, RESTPostAPIChannelInviteResult, Routes } from 'discord-api-types/v10'
import { MessageEmbed } from 'slash-create'
import { FullInvite } from './types'

let discordAPI: REST

export function makeDiscordRESTClient(env: Env) {
  if (!discordAPI) {
    discordAPI = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN)
  }
}

export { discordAPI }

export async function sendToInviteLog(embed: MessageEmbed) {
  await discordAPI.post(Routes.channelMessages(process.env.LOG_CHANNEL_ID), {
    body: {
      embeds: [embed],
      allowed_mentions: { parse: [] }
    }
  })
}

export async function createInviteLink(invite: FullInvite) {
  const body = new FormData()

  // Relevant Discord-side documentation: https://docs.discord.com/developers/tutorials/using-community-invites#target-users-example-creating-targeted-supporter-invites

  body.append(
    'target_users_file',
    // We will include both the inviter and invitee as target users; the inviter is included purely for UX reasons, to prevent them getting confused by the invite rendering
    // as "invalid invite" if they are not the target user. They cannot actually claim the invite, since they are already in the server, so it's only for cosmetic purposes.
    new Blob([`${invite.invitee.id}\n${invite.inviter.id}`], { type: 'text/csv' }),
    'target_users.csv'
  )

  body.append(
    'payload_json',
    JSON.stringify({
      max_age: 604800, // Expire in 7 days if not claimed
      max_uses: 1, // Only one use
      unique: true // Don't reuse existing
    })
  )

  return (await discordAPI.post(Routes.channelInvites(process.env.INVITE_TARGET_CHANNEL_ID), {
    passThroughBody: true,
    body,
    headers: {
      'X-Audit-Log-Reason': `Invite for user ${invite.invitee.id} (${invite.invitee.username}) on behalf of user ${invite.inviter.id} (${invite.inviter.username})`
    }
  })) as RESTPostAPIChannelInviteResult
}

export async function getPendingInvites() {
  return (await discordAPI.get(
    Routes.channelInvites(process.env.INVITE_TARGET_CHANNEL_ID)
  )) as RESTGetAPIChannelInvitesResult
}
