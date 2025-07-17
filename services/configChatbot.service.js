import ConfigChatbot from '../models/ConfigChatbot.js';

export async function isChatbotActive() {
  const config = await ConfigChatbot.findOne();
  return config?.active ?? true;
}

export async function setChatbotActive(active) {
  let config = await ConfigChatbot.findOne();
  if (!config) {
    config = new ConfigChatbot({ active });
  } else {
    config.active = active;
  }
  await config.save();
  return config.active;
} 