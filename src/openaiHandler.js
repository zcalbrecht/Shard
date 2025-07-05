const OpenAI = require('openai');
const config = require('../config.json');

class OpenAIHandler {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateResponse(messages, model, temperature = 0.7) {
    const apiCall = {
      model: model,
      messages: messages,
      max_tokens: 150,
      temperature: temperature,
      frequency_penalty: 1.5,
      presence_penalty: 1.0,
    };

    const completion = await this.openai.chat.completions.create(apiCall);
    return completion.choices[0].message.content;
  }

  async generateResponseWithConfig(messages, botUserIndex, botManager, temperature = 0.7) {
    const model = botManager.getModel(botUserIndex);
    return this.generateResponse(messages, model, temperature);
  }
}

module.exports = OpenAIHandler; 