# GFTV PolicySpot Discord Bot — Setup Guide

## 1. Discord Developer Portal

1. Go to **https://discord.com/developers/applications** and sign in.
2. Click **New Application** → name it `GFTV PolicySpot` → **Create**.
3. Open the **Bot** tab on the left.
   - Click **Add Bot** (confirm when prompted).
   - Under **Token**, click **Reset Token**, copy it — this is your `DISCORD_TOKEN`.
   - Under **Privileged Gateway Intents**, no additional intents are required for slash commands.
   - Set **Public Bot** to off if you want to prevent others from adding the bot.
4. Open **OAuth2 → URL Generator** on the left.
   - **Scopes**: tick `bot` and `applications.commands`.
   - **Bot Permissions**: tick `Send Messages`, `Embed Links`, `Read Message History`.
   - Copy the generated URL, paste it in your browser, and select the server to invite the bot.
5. *(Optional — for development)* Enable **Developer Mode** in Discord (User Settings → Advanced → Developer Mode), then right-click your server icon → **Copy Server ID**. Use this as `GUILD_ID` so commands register instantly during testing.

---

## 2. Supabase credentials

1. Open your Supabase project dashboard.
2. Go to **Settings → API**.
3. Copy **Project URL** → `SUPABASE_URL`.
4. Copy the **`service_role`** key (under "Project API keys") → `SUPABASE_SERVICE_KEY`.
   - The service role key bypasses Row Level Security. Keep it secret and never commit it.

---

## 3. Server preparation (Debian 13)

```bash
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git tmux
```

---

## 4. Clone and configure

```bash
git clone https://github.com/augy-studios/gftv-policyspot.git
cd gftv-policyspot/discord-bot

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
nano .env          # fill in DISCORD_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
                   # set GUILD_ID for instant sync during testing, or leave blank for global
```

---

## 5. Test run (foreground)

```bash
source venv/bin/activate
python bot.py
```

You should see log lines confirming the bot is online and commands are synced. Press `Ctrl+C` to stop.

---

## 6. Running persistently in tmux

```bash
# Create a new detached tmux session
tmux new-session -d -s policyspot \
  'cd /path/to/gftv-policyspot/discord-bot && source venv/bin/activate && python bot.py'

# Check it's running
tmux list-sessions

# Attach to watch logs
tmux attach -t policyspot

# Detach without stopping: Ctrl+B, then D
```

Replace `/path/to/gftv-policyspot` with the actual path on your VPS.

---

## 7. Auto-start on reboot (optional)

Add to your crontab (`crontab -e`):

```
@reboot sleep 30 && tmux new-session -d -s policyspot 'cd /path/to/gftv-policyspot/discord-bot && source venv/bin/activate && python bot.py'
```

The `sleep 30` gives the network time to come up before the bot tries to connect.

---

## 8. Updating the bot

```bash
tmux attach -t policyspot   # attach to the session
# Ctrl+C to stop the bot

git pull origin main
pip install -r requirements.txt   # in case dependencies changed

python bot.py                     # restart
# Ctrl+B, D to detach
```

---

## 9. Global vs guild command sync

| Setting | Behaviour |
|---|---|
| `GUILD_ID` set | Commands appear in that server immediately (good for testing) |
| `GUILD_ID` blank | Commands are registered globally and propagate within ~1 hour |

When you're done testing, remove `GUILD_ID` from `.env` and restart the bot so commands go global.
