const OpenAIHandler = require("./openaiHandler");
const config = require('../config.json');

class MessageHandler {
    constructor(botManager) {
        this.botManager = botManager;
        this.openaiHandler = new OpenAIHandler();
        this.messageQueue = new Map(); // channelId -> queue of pending messages
        this.channelMessageHistory = new Map(); // channelId -> array of last 5 messages
    }

    applyTextSubstitutions(text) {
        if (!config.textSubstitutions || !Array.isArray(config.textSubstitutions)) {
            return text;
        }

        let result = text;
        config.textSubstitutions.forEach(sub => {
            if (sub.from && sub.to) {
                const regex = new RegExp(sub.from, 'gi');
                result = result.replace(regex, sub.to);
            }
        });
        return result;
    }

    updateMessageHistory(channelId, message) {
        if (!this.channelMessageHistory.has(channelId)) {
            this.channelMessageHistory.set(channelId, []);
        }
        
        const history = this.channelMessageHistory.get(channelId);
        history.push({
            authorId: message.author.id,
            botUserIndex: this.getBotUserIndexFromClient(message.client),
            timestamp: Date.now()
        });
        
        // Keep only the last 5 messages
        if (history.length > 5) {
            history.shift();
        }
    }

    getBotUserIndexFromClient(client) {
        if (!client || !client.user) return -1;
        
        const botUsers = this.botManager.botUsers;
        for (let i = 0; i < botUsers.length; i++) {
            if (botUsers[i].id === client.user.id) {
                return i;
            }
        }
        return -1;
    }

    hasBotRecentlyMessaged(channelId, botUserIndex) {
        const history = this.channelMessageHistory.get(channelId);
        if (!history) return false;
        
        return history.some(msg => msg.botUserIndex === botUserIndex);
    }

    replaceMentionsWithNames(content) {
        return content.replace(/<@!?(\d+)>/g, (match, userId) => {
            // Find the bot user with this ID
            const botUser = this.botManager.getBotUserById(userId);
            if (botUser) {
                return botUser.name;
            }
            // If not found, return the original mention
            return match;
        });
    }

    async getConversationHistory(channel, limit) {
        try {
            const messages = await channel.messages.fetch({ limit });

            const messageArray = Array.from(messages.values()).reverse();

            return messageArray;
        } catch (error) {
            console.error("Error fetching conversation history:", error);
            return [];
        }
    }

    async generateResponse(messageOrChannel, botUserIndex = 0, temperature = 0.7) {
        const channel = messageOrChannel.channel || messageOrChannel;
        const conversationHistory = await this.getConversationHistory(channel, 10);
        const historyArray = conversationHistory;

        // Get unique speakers in the conversation
        const speakers = new Set();
        historyArray.forEach((msg) => {
            const nickname =
                msg.author.bot
                    ? this.botManager.getName(botUserIndex)
                    : msg.member?.nickname || msg.author.username;
            speakers.add(nickname);
        });

        const speakerList = Array.from(speakers).join(", ");

        const messages = [
            {
                role: "system",
                content: `${this.botManager.getSystemPrompt(
                    botUserIndex
                )}\n\nOther people in this conversation include: ${speakerList}. Pay attention to who is speaking and respond appropriately.`,
            },
            ...historyArray.map((msg) => ({
                role: msg.author.bot ? "assistant" : "user",
                content: `[${
                    msg.author.bot
                        ? this.botManager.getName(botUserIndex)
                        : msg.member?.nickname || msg.author.username
                }] ${this.replaceMentionsWithNames(msg.content)}`,
            })),
        ];

        messages.push({
            role: "system",
            content: `Continue the conversation naturally as  
                ${this.botManager.getName(botUserIndex)} 
            would in this conversation. Be engaging and authentic, and conversational at all times. You MUST respond naturally, and CRITICAL: you MUST NOT repeat yourself or others. BE mindful of who said what.`,
        });

        return this.openaiHandler.generateResponseWithConfig(
            messages,
            botUserIndex,
            this.botManager,
            temperature
        );
    }

    async processConsecutiveResponses(
        messageOrChannel,
        responseCount,
        botUserIndex = 0
    ) {
        const channel = messageOrChannel.channel || messageOrChannel;
        const channelId = channel.id;

        // Initialize queue for this channel if it doesn't exist
        if (!this.messageQueue.has(channelId)) {
            this.messageQueue.set(channelId, []);
        }

        const queue = this.messageQueue.get(channelId);

        for (let i = 0; i < responseCount; i++) {
            await channel.sendTyping();

            // Get conversation history for duplicate check
            const conversationHistory = await this.getConversationHistory(channel, 10);
            const historyArray = conversationHistory;

            // Generate response with current conversation history
            const response = await this.generateResponse(messageOrChannel, botUserIndex);
            const triggerType = messageOrChannel.content === undefined
                ? "Timer"
                : messageOrChannel.mentions?.users.has(messageOrChannel.client?.user?.id)
                    ? "Mention"
                    : "Random";
            const botNickname = this.botManager.getName(botUserIndex);

            console.log(
                `[${channel.name}] [${triggerType}] [${botNickname}]: ${response}`
            );

            // Clean response by removing all [name] prefixes
            const cleanedResponse = response
                .replace(/\[[^\]]+\]\s*/g, "")
                .trim();

            // Check if response is empty
            const isEmpty = cleanedResponse.length === 0;

            // Check if response matches any message in history
            const isDuplicate = historyArray.some(
                (msg) =>
                    this.replaceMentionsWithNames(msg.content)
                        .trim()
                        .toLowerCase() === cleanedResponse.toLowerCase()
            );

            if (isDuplicate || isEmpty) {
                // Try again with higher temperature for more creativity
                const retryResponse = await this.generateResponse(
                    messageOrChannel,
                    botUserIndex,
                    1.2
                );

                console.log(
                    `[${channel.name}] [${triggerType}] [retry] [${botNickname}]: ${retryResponse}`
                );

                // Clean retry response by removing all [name] prefixes
                const cleanedRetryResponse = retryResponse
                    .replace(/\[[^\]]+\]\s*/g, "")
                    .trim();

                // Check if retry is also empty
                const isRetryEmpty = cleanedRetryResponse.length === 0;

                // Check if retry is also a duplicate
                const isRetryDuplicate = historyArray.some(
                    (msg) =>
                        this.replaceMentionsWithNames(msg.content)
                            .trim()
                            .toLowerCase() ===
                        cleanedRetryResponse.toLowerCase()
                );

                if (isRetryDuplicate || isRetryEmpty) {
                    const reason = isRetryEmpty ? "empty" : "duplicate";
                    console.log(
                        `[${channel.name}] [${reason.toUpperCase()}] Retry also failed, skipping...`
                    );
                    continue; // Skip this response and move to next iteration
                }

                // Use the cleaned retry response with text substitutions
                const substitutedRetryResponse = this.applyTextSubstitutions(cleanedRetryResponse);
                const sendPromise = channel.send(substitutedRetryResponse);
                queue.push(sendPromise);
                await sendPromise;
                
                // Update message history with this bot's retry message
                this.updateMessageHistory(channelId, {
                    author: { id: this.botManager.getBotUser(botUserIndex).id },
                    client: messageOrChannel.client
                });

                // Small delay between responses to avoid rate limiting
                if (i < responseCount - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                continue; // Move to next iteration
            }

            // Add to queue and wait for it to be sent (use cleaned response with text substitutions)
            const substitutedResponse = this.applyTextSubstitutions(cleanedResponse);
            const sendPromise = channel.send(substitutedResponse);
            queue.push(sendPromise);

            // Wait for this message to be sent before proceeding
            await sendPromise;
            
            // Update message history with this bot's message
            this.updateMessageHistory(channelId, {
                author: { id: this.botManager.getBotUser(botUserIndex).id },
                client: messageOrChannel.client
            });

            // Small delay between responses to avoid rate limiting
            if (i < responseCount - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        // Clear the queue after all responses are sent
        this.messageQueue.set(channelId, []);
    }

}

module.exports = MessageHandler;
