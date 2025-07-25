// services/chatStateService.js
import { isChatbotActive } from './configChatbot.service.js';

class ChatStateService {
    constructor() {
        // Store chat states: { userId: { chatId: { botActive: boolean, lastActivity: Date, deactivationTimer: Timeout } } }
        this.chatStates = new Map();
        this.DEACTIVATION_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds (for testing)
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
                lastActivity: new Date(),
                deactivationTimer: null,
                lastModified: new Date()
            });
            console.log(`[ChatState] Initialized chat ${chatId} for user ${userId} with bot ${isGlobalActive ? 'active' : 'inactive'}`);
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
    async getChatState(userId, chatId) {
        await this.initializeChatState(userId, chatId);
        return this.chatStates.get(userId).get(chatId);
    }

    // Check if bot is active for a chat
    async isBotActive(userId, chatId) {
        const state = await this.getChatState(userId, chatId);
        return state.botActive;
    }

    // Set bot state for a chat with optional auto-reactivation
    async setBotState(userId, chatId, isActive, autoReactivate = false, customDuration = null) {
        const state = await this.getChatState(userId, chatId);
        
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
                this.setBotState(userId, chatId, true);
            }, duration);
            
            console.log(`[ChatState] Set bot state for chat ${chatId} to inactive with auto-reactivation in ${durationMinutes} minutes`);
        } else {
            const action = isActive ? 'activated' : 'deactivated';
            console.log(`[ChatState] Chat ${chatId} ${action} by user ${userId}`);
        }
        
        return isActive;
    }

    // Toggle bot state with optional auto-reactivation
    async toggleBotState(userId, chatId, autoReactivate = false) {
        const state = await this.getChatState(userId, chatId);
        const newState = !state.botActive;
        
        // Only set auto-reactivate when turning off the bot
        return this.setBotState(userId, chatId, newState, newState ? false : autoReactivate);
    }

    // Get all chat states for a user
    getUserChats(userId) {
        const userChats = this.chatStates.get(userId);
        return userChats ? Array.from(userChats.entries()) : [];
    }
    
    // Manually reactivate bot before timeout
    async manualReactivate(userId, chatId) {
        const state = await this.getChatState(userId, chatId);
        
        if (!state.botActive) {
            console.log(`[ChatState] Manual reactivation for chat ${chatId}`);
            return this.setBotState(userId, chatId, true);
        }
        return true;
    }
}

const chatStateService = new ChatStateService();
export default chatStateService;
