class ActivityManager {
    constructor(config, botManager, messageHandler) {
        this.silenceTimeoutMin = config.automatedActivity.silenceTimeoutMin * 60 * 1000; // Convert minutes to milliseconds
        this.silenceTimeoutMax = config.automatedActivity.silenceTimeoutMax * 60 * 1000; // Convert minutes to milliseconds
        this.channels = config.automatedActivity.channels;
        this.botManager = botManager;
        this.messageHandler = messageHandler;
        this.channelTimers = new Map(); // channelId -> timer
        this.botClients = []; // Store bot clients for sending messages
    }

    // Generate a random timeout within the configured range
    getRandomTimeout() {
        return Math.floor(Math.random() * (this.silenceTimeoutMax - this.silenceTimeoutMin + 1)) + this.silenceTimeoutMin;
    }

    // Register a bot client for sending messages
    registerBotClient(client, botIndex) {
        this.botClients.push({ client, botIndex });
        
        // If this is the first bot client, start timers for all configured channels
        if (this.botClients.length === 1) {
            this.startTimersForAllChannels(client);
        }
    }

    // Called when any message is sent in a channel
    updateChannelActivity(channelId, channelName) {
        // Only track configured channels
        if (!this.channels.includes(channelName)) {
            return;
        }

        // Clear existing timer for this channel
        if (this.channelTimers.has(channelId)) {
            clearTimeout(this.channelTimers.get(channelId));
        }

        // Start new timer using random timeout within range
        const randomTimeout = this.getRandomTimeout();
        const timer = setTimeout(() => {
            this.handleChannelSilence(channelId, channelName);
        }, randomTimeout);

        this.channelTimers.set(channelId, timer);
        
        return randomTimeout;
    }

    // Handle when a channel has been silent for the configured timeout
    handleChannelSilence(channelId, channelName) {
        // Pick a random bot to respond
        const randomBotIndex = Math.floor(Math.random() * this.botClients.length);
        const botData = this.botClients[randomBotIndex];
        
        if (botData) {
            // Get the channel object
            const channel = botData.client.channels.cache.get(channelId);
            if (channel) {
                // Trigger a bot response using the correct bot index
                this.triggerBotActivity(channel, botData.botIndex);
            }
        }
    }

    // Trigger a bot to respond to activity
    async triggerBotActivity(channel, botIndex) {
        try {
            const responseCount = this.botManager.getLootTableRoll(botIndex);
            await this.messageHandler.processConsecutiveResponses(channel, responseCount, botIndex);
            
            // Reset the timer after bot responses to prevent spam
            this.updateChannelActivity(channel.id, channel.name);
        } catch (error) {
            console.error(`Error triggering bot activity for bot ${botIndex}:`, error);
        }
    }

    // Start timers for all configured channels
    startTimersForAllChannels(client) {
        this.channels.forEach(channelName => {
            const channel = client.channels.cache.find(ch => ch.name === channelName);
            if (channel) {
                const randomTimeout = this.updateChannelActivity(channel.id, channelName);
                const timeoutMinutes = Math.round(randomTimeout / (60 * 1000));
                console.log(`[${channelName}] Starting activity timer on bot startup (${timeoutMinutes} minutes)`);
            } else {
                console.log(`[${channelName}] Channel not found, skipping timer`);
            }
        });
    }

    // Clean up timers when shutting down
    cleanup() {
        this.channelTimers.forEach((timer) => {
            clearTimeout(timer);
        });
        this.channelTimers.clear();
    }
}

module.exports = ActivityManager; 