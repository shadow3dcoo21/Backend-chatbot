// controllers/bot.controller.js
import chatStateService from '../services/chatStateService.js';

/**
 * @desc    Set bot state for a specific chat
 * @route   POST /api/bot/state
 * @access  Private
 */
export const setChatBotState = async (req, res) => {
  try {
    const { chatId, isActive } = req.body;
    const userId = req.user.id;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        error: 'isActive debe ser un valor booleano' 
      });
    }
    
    // This will initialize the chat state if it doesn't exist
    const result = await chatStateService.setBotState(userId, chatId, isActive);
    
    res.json({ 
      success: true, 
      chatId, 
      botActive: result,
      message: `Bot ${result ? 'activado' : 'desactivado'} para este chat`
    });
  } catch (error) {
    console.error('Error al cambiar el estado del bot:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc    Toggle bot state for a specific chat
 * @route   POST /api/bot/:chatId/toggle
 * @access  Private
 */
export const toggleChatBotState = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    // This will initialize the chat state if it doesn't exist
    const newState = await chatStateService.toggleBotState(userId, chatId);
    
    res.json({ 
      success: true, 
      chatId, 
      botActive: newState,
      message: `Bot ${newState ? 'activado' : 'desactivado'} para este chat`
    });
  } catch (error) {
    console.error('Error al cambiar el estado del bot:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc    Get bot state for a specific chat
 * @route   GET /api/bot/:chatId/state
 * @access  Private
 */
export const getChatBotState = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    // This will initialize the chat state if it doesn't exist
    const isActive = await chatStateService.isBotActive(userId, chatId);
    
    res.json({ 
      success: true, 
      chatId, 
      botActive: isActive
    });
  } catch (error) {
    console.error('Error al obtener el estado del bot:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * @desc    Get all chat states for the current user
 * @route   GET /api/bot/chats
 * @access  Private
 */
export const getAllChatStates = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = chatStateService.getUserChats(userId);
    
    res.json({ 
      success: true, 
      chats: chats.map(([chatId, state]) => ({
        chatId,
        botActive: state.botActive,
        lastActivity: state.lastActivity,
        lastModified: state.lastModified
      }))
    });
  } catch (error) {
    console.error('Error al obtener los chats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
