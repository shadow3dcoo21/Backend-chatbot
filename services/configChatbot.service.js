import ConfigChatbot from '../models/ConfigChatbot.js';

export async function isChatbotActive(companyId) {
  let config = await ConfigChatbot.findOne({ company: companyId });
  if (!config) {
    config = new ConfigChatbot({ company: companyId, active: true });
    await config.save();
  }
  return config.active;
}

export async function setChatbotActive(companyId, active) {
  let config = await ConfigChatbot.findOne({ company: companyId });
  if (!config) {
    config = new ConfigChatbot({ company: companyId, active });
  } else {
    config.active = active;
  }
  await config.save();
  return config.active;
} 