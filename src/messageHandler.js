const OpenAIHandler = require("./openaiHandler");

class MessageHandler {
    constructor(botManager) {
        this.botManager = botManager;
        this.openaiHandler = new OpenAIHandler();
        this.messageQueue = new Map(); // channelId -> queue of pending messages
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

        // Add current message content if it's a real message (not timer)
        if (messageOrChannel.content !== undefined) {
            const currentUserNickname =
                messageOrChannel.member?.nickname || messageOrChannel.author.username;
            speakers.add(currentUserNickname);
            
            messages.push({
                role: "user",
                content: `[${currentUserNickname}] ${this.replaceMentionsWithNames(messageOrChannel.content).trim()}`,
            });
        }

        messages.push({
            role: "system",
            content: `Respond naturally as  
                ${this.botManager.getName(botUserIndex)} 
            would in this conversation. Be engaging and authentic, and conversational at all times. You MUST respond naturally, and CRITICAL: you MUST NOT repeat yourself or others.`,
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

                // Use the cleaned retry response
                const sendPromise = channel.send(cleanedRetryResponse);
                queue.push(sendPromise);
                await sendPromise;

                // Small delay between responses to avoid rate limiting
                if (i < responseCount - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                continue; // Move to next iteration
            }

            // Add to queue and wait for it to be sent (use cleaned response)
            const sendPromise = channel.send(cleanedResponse);
            queue.push(sendPromise);

            // Wait for this message to be sent before proceeding
            await sendPromise;

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
