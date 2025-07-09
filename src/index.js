const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('../config.json');
const BotManager = require('./botManager');
const MessageHandler = require('./messageHandler');
const ActivityManager = require('./activityManager');

const botManager = new BotManager();
const messageHandler = new MessageHandler(botManager);
const activityManager = new ActivityManager(config, botManager, messageHandler);

// Create and initialize all bot clients
config.botUsers.forEach((botUser, index) => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, () => {
    console.log(`Bot ${botUser.name} is ready! Logged in as ${client.user.tag}`);
    // Register this bot client with the activity manager
    activityManager.registerBotClient(client, index);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    
    // Update activity manager with new message
    activityManager.updateChannelActivity(message.channel.id, message.channel.name);
    
    // Check if this is an activity channel
    const isActivityChannel = config.automatedActivity.channels.includes(message.channel.name);
    
    // Check if this bot has recently messaged in this channel
    const hasRecentlyMessaged = messageHandler.hasBotRecentlyMessaged(message.channel.id, index);
    
    // Calculate response chance - apply multiplier if bot has recently messaged
    const baseResponseRate = config.automatedActivity.randomResponseRate;
    const multiplier = config.automatedActivity.recentMessageMultiplier || 1;
    const adjustedResponseRate = hasRecentlyMessaged ? baseResponseRate * multiplier : baseResponseRate;
    
    // Only apply random response rate to activity channels
    const shouldRespond = isActivityChannel ? Math.random() < adjustedResponseRate : false;
    const isMentioned = message.mentions.users.has(client.user.id);
    
    // Check if bot is mentioned in a role tag
    const isRoleMentioned = message.mentions.roles.some(role => {
      const roleMembers = role.members;
      return roleMembers.has(client.user.id);
    });
    
    if (!shouldRespond && !isMentioned && !isRoleMentioned) return;

    try {
      const responseCount = botManager.getLootTableRoll(index);
      
      await messageHandler.processConsecutiveResponses(message, responseCount, index);
    } catch (error) {
      console.error(`Error generating response for ${botUser.name}:`, error);
      await message.channel.send('Sorry, I encountered an error while processing your request.');
    }
  });

  client.login(botUser.token);
}); 