# Shard Discord Bot

A multi-bot Discord system that uses fine-tuned OpenAI LLMs to generate contextual responses. Each bot has its own personality, model, and behavior. This is part of a broader "Dead Internet" project to simulate convincing human behavior in online chatrooms via the use of LLMs.

## Features

- **Multiple Bot Users**: Each bot has its own Discord token, personality, and fine-tuned model
- **Contextual Responses**: Fetches last 10 messages for conversation context
- **Smart Triggering**: Responds to mentions, random chance in activity channels, or inactivity timers
- **Activity Management**: Bots automatically break silence in configured channels after random timeouts
- **Duplicate Prevention**: Retries with higher creativity if response is empty or duplicate
- **Configurable Behavior**: Customizable response rates, timer ranges, and personalities per-bot

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure `config.json`:
```json
{
  "openai": {
    "apiKey": "your-openai-api-key"
  },
  "masterPrompt": "You are a member of a Discord server chat talking with multiple other members.",
  "botUsers": [
    {
      "name": "BotName",
      "id": "bot-discord-id",
      "token": "bot-discord-token",
      "model": "your-fine-tuned-model-id",
      "prompt": "Bot personality description",
      "lootTable": [1, 1, 2, 3]
    }
  ],
  "automatedActivity": {
    "silenceTimeoutMin": 3,
    "silenceTimeoutMax": 10,
    "channels": ["general", "chat"],
    "randomResponseRate": 0.2
  }
}
```

3. Run the bot:
```bash
npm start
```

## Configuration

### Bot Users
- `name`: Bot's display name
- `id`: Discord user ID
- `token`: Discord bot token
- `model`: OpenAI fine-tuned model ID
- `prompt`: Personality and behavior description
- `lootTable`: Array of response counts (randomly selected)

### Activity Settings
- `silenceTimeoutMin/Max`: Timer range in minutes (3-10 = random 3-10 minute silence)
- `channels`: Channels where bots respond to random chance and inactivity
- `randomResponseRate`: Probability of random response (0.2 = 20% chance)

## How It Works

1. **Mention Responses**: Bot responds when tagged with its own personality
2. **Random Responses**: In activity channels, bots randomly respond based on `randomResponseRate`
3. **Timer Responses**: After silence timeout, random bot breaks silence
4. **Context Building**: Uses conversation history with speaker names and mention replacement
5. **Quality Control**: Retries with higher temperature if response is duplicate/empty

## Requirements

- Node.js 16+
- Discord bot tokens (one per bot user)
- OpenAI API key with access to fine-tuned models 