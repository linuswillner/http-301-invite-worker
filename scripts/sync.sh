#!/usr/bin/env bash

set -euo pipefail

source .env

npx slash-up sync \
   --token "$DISCORD_BOT_TOKEN" \
   --application-id "$DISCORD_APP_ID" \
   --command-path ./src/commands \
   --global-to-guild "$DISCORD_GUILD_ID"
