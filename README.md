# 📩 HTTP 301 invite worker

Discord bot running as a Cloudflare Worker for managing invitations to HTTP 301.

The beef: Members create invites for new members to the community using a slash command, which triggers a form interaction where they provide the user ID of the invitee and some context for the invitiation. The bot parses the user account details of the invitee and provides a preview for the inviter, letting the inviter confirm or cancel the invite. Once confirmed, the invite is posted to a public log channel for record-keeping, and the inviter is provided with a [targeted invite](https://docs.discord.com/developers/tutorials/using-community-invites#target-users-example-creating-targeted-supporter-invites) to give to the invitee.

With the native targeted invites feature, combined with creating an invite link that is only valid once, we achieve numerous security and integrity benefits, chiefly that we circumvent the need for a manual verification process to ensure that the invite hasn't spread to unintended audiences.

The system also implements a configurable invite cadence, letting members create an invite for someone only once every X months. The system lets people check when their next invite will be available with a different slash command. There is also an escape hatch for server owners to regenerate the invite, should it happen to expire or become lost somehow.

**💻 Keystone technology choices:**

- As it says on the tin, the entire system runs on a Cloudflare Worker
- Cloudflare D1 is used as a datastore and interacted with using Prisma, as the closest available storage that does not need extra setup; Prisma was chosen to eliminate DB driver boilerplate
- Discord slash commands are implemented using [slash-create](https://github.com/Snazzah/slash-create) for convenience and again eliminating as much boilerplate as possible
- Discord API interactions are done fairly low-level using [@discordjs/rest](https://discord.js.org/docs/packages/rest/main), since full-fat Discord.js would be far too heavy for the like 3 functions we need from it

## Development

To get started for development, you'll need:

- Node.js; version is in .nvmrc, use your Node version manager of choice such as [nvm](https://github.com/nvm-sh/nvm) or [mise](https://github.com/jdx/mise)
- A Cloudflare account, since this project uses Wrangler
- An alternate Discord account, since you can't invite yourself
- A suitable Discord server, with the following details filled into `.env` based on [`.env.example`](./.env.example):
  - Guild ID
  - Invite log channel ID
  - Invite target channel ID, as in the channel for which the invites will be generated
- A Discord bot, created in the Discord developer portal, configured into `.env` and added to the server with the following permissions:
  - View Channels
  - Manage Channels (required for inspecting existing invites)
  - Create Invite
  - Send Messages and Create Posts
  - Embed Links

Next, run the following commands to get started:

```bash
npm i
npm run cf:mktunnel
```

Then configure your newly created Cloudflare Tunnel and attach it to some suitable domain of yours, pointing the endpoint address to `http://localhost:8787`. DNS may take some time to propagate.

Once done, go to the app's page in the Discord developer portal and change the Interactions Endpoint URL to `https://tunnel.your-domain.tld/interactions`.

Now, you can start the development process:

```bash
npm run dev

# In a different window: you'll need to bring your local DB up to sync with the Prisma schema when you first create it
npx prisma migrate deploy
```
