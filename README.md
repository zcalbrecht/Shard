# Shard Discord Bot

A simple Discord bot that uses OpenAI to generate contextual responses based on message history.

## Features

- Responds only when mentioned/tagged
- Uses OpenAI GPT-3.5-turbo for intelligent responses
- Fetches conversation history for context
- Clean, functional code structure

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update the bot token in `config.json`:
```json
{
  "discord": {
    "token": "YOUR_ACTUAL_BOT_TOKEN_HERE"
  }
}
```

3. Run the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Usage

Simply mention the bot in any channel and it will respond with an AI-generated message based on the conversation context.

## Configuration

The bot uses `config.json` for configuration:
- `openai.apiKey`: Your OpenAI API key (already configured)
- `discord.token`: Your Discord bot token (needs to be added)

## Requirements

- Node.js 16+ 
- Discord bot token
- OpenAI API key 