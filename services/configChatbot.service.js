import ConfigChatbot from '../models/ConfigChatbot.js';

export async function isChatbotActive(userId) {
  let config = await ConfigChatbot.findOne({ user: userId });
  if (!config) {
    config = new ConfigChatbot({ user: userId, active: true });
    await config.save();
  }
  return config.active;
}

export async function setChatbotActive(userId, active) {
  let config = await ConfigChatbot.findOne({ user: userId });
  if (!config) {
    config = new ConfigChatbot({ user: userId, active });
  } else {
    config.active = active;
  }
  await config.save();
  return config.active;
} 