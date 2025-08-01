// services/chatStateService.js
import { isChatbotActive } from './configChatbot.service.js';

class ChatStateService {
    constructor() {
        // Store chat states: { userId: { chatId: { botActive: boolean, lastActivity: Date, deactivationTimer: Timeout } } }
        this.chatStates = new Map();
        this.DEACTIVATION_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds (for testing)
    }

    // Initialize chat state for a user if not exists
    initUserChats(companyId) {
        if (!this.chatStates.has(companyId)) {
            this.chatStates.set(companyId, new Map());
        }
        return this.chatStates.get(companyId);
    }

    // Initialize chat state if not exists, using user's global setting as default
    async initializeChatState(companyId, chatId) {
        const userChats = this.initUserChats(companyId);

        if (!userChats.has(chatId)) {
            // Get user's global bot setting
            const isGlobalActive = await isChatbotActive(companyId);
            userChats.set(chatId, {
                botActive: isGlobalActive,
                lastActivity: new Date(),
                deactivationTimer: null,
                lastModified: new Date()
            });
            console.log(`[ChatState] Initialized chat ${chatId} for company ${companyId} with bot ${isGlobalActive ? 'active' : 'inactive'}`);
        } else {
            // Update last activity
            const chatState = userChats.get(chatId);
            chatState.lastActivity = new Date();

            // Clear any existing timer if bot is active
            if (chatState.botActive && chatState.deactivationTimer) {
                clearTimeout(chatState.deactivationTimer);
                chatState.deactivationTimer = null;
            }
        }

        return userChats.get(chatId);
    }

    // Get or initialize chat state
    async getChatState(companyId, chatId) {
        await this.initializeChatState(companyId, chatId);
        return this.chatStates.get(companyId).get(chatId);
    }

    // Check if bot is active for a chat
    async isBotActive(companyId, chatId) {
        const state = await this.getChatState(companyId, chatId);
        return state.botActive;
    }

    // Set bot state for a chat with optional auto-reactivation
    async setBotState(companyId, chatId, isActive, autoReactivate = false, customDuration = null) {
        const state = await this.getChatState(companyId, chatId);

        // Clear any existing timer
        if (state.deactivationTimer) {
            clearTimeout(state.deactivationTimer);
            state.deactivationTimer = null;
        }

        // Set new state
        const previousState = state.botActive;
        state.botActive = isActive;
        state.lastModified = new Date();

        // Set up auto-reactivation if needed
        if (!isActive && autoReactivate) {
            const duration = customDuration || this.DEACTIVATION_TIMEOUT;
            const durationMinutes = Math.round(duration / (60 * 1000));

            state.deactivationTimer = setTimeout(() => {
                console.log(`[ChatState] Auto-reactivation triggered for chat ${chatId}`);
                this.setBotState(companyId, chatId, true);
            }, duration);

            console.log(`[ChatState] Set bot state for chat ${chatId} to inactive with auto-reactivation in ${durationMinutes} minutes`);
        } else {
            const action = isActive ? 'activated' : 'deactivated';
            console.log(`[ChatState] Chat ${chatId} ${action} by company ${companyId}`);
        }

        return isActive;
    }

    // Toggle bot state with optional auto-reactivation
    async toggleBotState(companyId, chatId, autoReactivate = false) {
        const state = await this.getChatState(companyId, chatId);
        const newState = !state.botActive;

        // Only set auto-reactivate when turning off the bot
        return this.setBotState(companyId, chatId, newState, newState ? false : autoReactivate);
    }

    // Get all chat states for a company
    getCompanyChats(companyId) {
        const companyChats = this.chatStates.get(companyId);
        return companyChats ? Array.from(companyChats.entries()) : [];
    }

    // Manually reactivate bot before timeout
    async manualReactivate(companyId, chatId) {
        const state = await this.getChatState(companyId, chatId);

        if (!state.botActive) {
            console.log(`[ChatState] Manual reactivation for chat ${chatId}`);
            return this.setBotState(companyId, chatId, true);
        }
        return true;
    }
}

const chatStateService = new ChatStateService();
export default chatStateService;
