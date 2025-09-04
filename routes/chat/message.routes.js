// src/routes/message.routes.js
import express from "express";
const router = express.Router();

import { sendMessage, sendMassiveMessagesFromCsv, sendMassiveMessagesFromTxt, sendMassiveMessagesFromList, getReceivedMessages, getContactMessages, getContactConversationHistory } from "../../controllers/messaging/message.controller.js";

router.post("/send/:companyId", sendMessage);

// masivo desde CSV
router.post("/massive/:companyId", sendMassiveMessagesFromCsv);

// masivo desde TXT
router.post("/massive-txt/:companyId", sendMassiveMessagesFromTxt);

// masivo desde lista de números + texto único
router.post("/massive-list/:companyId", sendMassiveMessagesFromList);

router.get("/received/:companyId", getReceivedMessages);

// Obtener mensajes de un contacto específico
router.get("/contact/:companyId/:number", getContactMessages);

// Obtener historial completo de conversación de un contacto
router.get("/conversation/:companyId/:number", getContactConversationHistory);

export default router;
