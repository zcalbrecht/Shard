const config = require('../config.json');

class BotManager {
  constructor() {
    this.botUsers = config.botUsers;
  }

  getBotUser(index = 0) {
    return this.botUsers[index];
  }

  getLootTableRoll(botUserIndex = 0) {
    const botUser = this.getBotUser(botUserIndex);
    return botUser.lootTable[Math.floor(Math.random() * botUser.lootTable.length)];
  }

  getSystemPrompt(botUserIndex = 0) {
    const botUser = this.getBotUser(botUserIndex);
    return `${config.masterPrompt}\n\n${botUser.prompt}`;
  }

  getModel(botUserIndex = 0) {
    const botUser = this.getBotUser(botUserIndex);
    return botUser.model;
  }

  getName(botUserIndex = 0) {
    const botUser = this.getBotUser(botUserIndex);
    return botUser.name;
  }

  getBotUserById(userId) {
    return this.botUsers.find(botUser => botUser.id === userId);
  }
}

module.exports = BotManager; 