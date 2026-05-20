# Setup Guide — GFTV PolicyBot

---

## 1. Create the Bot with BotFather

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts:
   - **Name** — the display name shown in chats, e.g. `GFTV PolicyBot`
   - **Username** — must end in `bot`, e.g. `gftv_policybot`
3. BotFather will reply with your **bot token** — copy it, you will need it later.
4. Optionally configure the bot further:
   - `/setdescription` — short description shown on the bot's profile
   - `/setabouttext` — "About" text
   - `/setuserpic` — upload a profile photo
   - `/setcommands` — paste the block below to register commands in Telegram's UI:
     ```
     start - Open the main menu
     browse - Browse policy categories
     search - Search all policies
     help - Show help
     ```
5. To restrict the bot to DMs only (recommended), send `/setjoingroups` → **Disable**.

---

## 2. Get Telegram API Credentials

The bot uses Telethon, which requires app-level credentials in addition to the bot token.

1. Go to **https://my.telegram.org** and log in with your Telegram account.
2. Click **API development tools**.
3. Fill in any app name and short name (these are for your reference only).
4. Note down the **`api_id`** (an integer) and **`api_hash`** (a hex string).

> These credentials belong to your Telegram account, not the bot. Keep them secret.

---

## 3. Prepare the VPS

Run the following on your **Debian 13** VPS as a non-root user:

```bash
# Install Python 3.11+ and pip
sudo apt update && sudo apt install -y python3 python3-pip python3-venv git tmux

# Clone the repository
git clone https://github.com/<your-org>/gftv-policyspot.git
cd gftv-policyspot/telegram-bot

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 4. Configure Environment Variables

```bash
cp .env.example .env
nano .env        # or use your preferred editor
```

Fill in all values:

| Variable | Where to find it |
|---|---|
| `TELEGRAM_API_ID` | my.telegram.org → API development tools |
| `TELEGRAM_API_HASH` | my.telegram.org → API development tools |
| `TELEGRAM_BOT_TOKEN` | @BotFather reply after `/newbot` |
| `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Settings → API → `service_role` key |

Save and close the file. Confirm permissions are tight:

```bash
chmod 600 .env
```

---

## 5. First Run (Session Initialisation)

On first launch Telethon will create a session file and no interactive prompt will appear (bot tokens don't require a login code). Run it once in the foreground to confirm everything works:

```bash
source .venv/bin/activate
python bot.py
```

You should see a log line like:

```
INFO  policybot: Started as @gftv_policybot (id=123456789)
```

Send `/start` to the bot in Telegram to verify. Press `Ctrl+C` to stop.

---

## 6. Run in tmux (Persistent Session)

```bash
# Start a named tmux session
tmux new-session -s policybot

# Inside the tmux pane, activate venv and start the bot
source /path/to/gftv-policyspot/telegram-bot/.venv/bin/activate
cd /path/to/gftv-policyspot/telegram-bot
python bot.py
```

Detach from the session (bot keeps running): **`Ctrl+B`** then **`D`**

### Useful tmux commands

| Command | Action |
|---|---|
| `tmux attach -t policybot` | Re-attach to the running session |
| `tmux ls` | List all sessions |
| `Ctrl+B D` | Detach (leave bot running) |
| `Ctrl+C` (inside session) | Stop the bot |

---

## 7. Updating the Bot

```bash
tmux attach -t policybot
# Ctrl+C to stop the bot

cd /path/to/gftv-policyspot
git pull origin main

cd telegram-bot
source .venv/bin/activate
pip install -r requirements.txt   # pick up any new dependencies
python bot.py
# Ctrl+B D to detach
```

---

## 8. Directory Structure After Setup

```
telegram-bot/
├── bot.py
├── config.py
├── database.py
├── supabase_client.py
├── utils.py
├── requirements.txt
├── .env              ← your secrets (never committed)
├── .env.example
├── .gitignore
├── README.md
├── SETUP.md
├── sessions/         ← Telethon session files (never committed)
│   └── policybot.session
└── data/             ← SQLite database (never committed)
    └── bot.db
```
