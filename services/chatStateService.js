// services/chatStateService.js
import { isChatbotActive } from './configChatbot.service.js';

class ChatStateService {
    constructor() {
        // Store chat states: { userId: { chatId: { botActive: boolean, lastActivity: Date } } }
        this.chatStates = new Map();
    }

    // Initialize chat state for a user if not exists
    initUserChats(userId) {
        if (!this.chatStates.has(userId)) {
            this.chatStates.set(userId, new Map());
        }
        return this.chatStates.get(userId);
    }

    // Initialize chat state if not exists, using user's global setting as default
    async initializeChatState(userId, chatId) {
        const userChats = this.initUserChats(userId);

        if (!userChats.has(chatId)) {
            // Get user's global bot setting
            const isGlobalActive = await isChatbotActive(userId);
            userChats.set(chatId, {
                botActive: isGlobalActive,
                lastActivity: new Date()
            });
            console.log(`[ChatState] Initialized chat ${chatId} for user ${userId} with bot ${isGlobalActive ? 'active' : 'inactive'}`);
        } else {
            // Update last activity
            userChats.get(chatId).lastActivity = new Date();
        }

        return userChats.get(chatId);
    }

    // Get or initialize chat state
    async getChatState(userId, chatId) {
        await this.initializeChatState(userId, chatId);
        return this.chatStates.get(userId).get(chatId);
    }

    // Check if bot is active for a chat
    async isBotActive(userId, chatId) {
        const state = await this.getChatState(userId, chatId);
        return state.botActive;
    }

    // Set bot state for a chat
    async setBotState(userId, chatId, isActive) {
        const state = await this.getChatState(userId, chatId);
        state.botActive = isActive;
        state.lastModified = new Date();
        console.log(`[ChatState] Set bot state for chat ${chatId} to ${isActive ? 'active' : 'inactive'}`);
        return isActive;
    }

    // Toggle bot state
    async toggleBotState(userId, chatId) {
        const state = await this.getChatState(userId, chatId);
        state.botActive = !state.botActive;
        state.lastModified = new Date();
        console.log(`[ChatState] Toggled bot state for chat ${chatId} to ${state.botActive ? 'active' : 'inactive'}`);
        return state.botActive;
    }

    // Get all chat states for a user
    getUserChats(userId) {
        const userChats = this.chatStates.get(userId);
        return userChats ? Array.from(userChats.entries()) : [];
    }
}

const chatStateService = new ChatStateService();
export default chatStateService;
