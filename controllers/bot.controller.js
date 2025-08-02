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
    const companyId = req.params.companyId

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive debe ser un valor booleano'
      });
    }

    // This will initialize the chat state if it doesn't exist
    const result = await chatStateService.setBotState(companyId, chatId, isActive);

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
    const { chatId, companyId } = req.params;

    // This will initialize the chat state if it doesn't exist
    const newState = await chatStateService.toggleBotState(companyId, chatId);

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
    const { chatId, companyId } = req.params;

    // This will initialize the chat state if it doesn't exist
    const isActive = await chatStateService.isBotActive(companyId, chatId);

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
    const companyId = req.params.companyId
    const chats = chatStateService.getCompanyChats(companyId);

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
    console.error('Error al obtener los estados de los chats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los estados de los chats'
    });
  }
};

/**
 * @desc    Manually reactivate the bot for a specific chat
 * @route   POST /api/bot/:chatId/reactivate
 * @access  Private
 */
export const manualReactivateBot = async (req, res) => {
  try {
    const { chatId, companyId } = req.params;

    await chatStateService.manualReactivate(companyId, chatId);

    res.json({
      success: true,
      chatId,
      message: 'Chat reactivado manualmente',
      botActive: true
    });
  } catch (error) {
    console.error('Error al reactivar manualmente el bot:', error);
    res.status(500).json({
      success: false,
      error: 'Error al reactivar el bot manualmente'
    });
  }
};

/**
 * @desc    Set bot state with auto-reactivation
 * @route   POST /api/bot/:chatId/deactivate
 * @access  Private
 */
export const setBotStateWithAutoReactivate = async (req, res) => {
  try {
    const { chatId, companyId } = req.params;
    const { durationMinutes } = req.body;

    // Use provided duration or default to 2 minutes for testing
    const deactivateDuration = durationMinutes
      ? durationMinutes * 60 * 1000
      : 60 * 60 * 1000;

    // Set bot to inactive with auto-reactivation
    await chatStateService.setBotState(
      companyId,
      chatId,
      false, // isActive = false
      true,  // autoReactivate = true
      deactivateDuration // custom duration
    );

    res.json({
      success: true,
      chatId,
      message: `Bot desactivado. Se reactivará automáticamente en ${deactivateDuration / 60000} minutos.`,
      botActive: false,
      autoReactivationIn: deactivateDuration
    });
  } catch (error) {
    console.error('Error al desactivar con reactivación automática:', error);
    res.status(500).json({
      success: false,
      error: 'Error al configurar la desactivación automática'
    });
  }
};
