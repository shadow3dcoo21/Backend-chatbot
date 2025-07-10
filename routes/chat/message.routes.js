// src/routes/message.routes.js
import express from "express";
const router = express.Router();

import { sendMessage, sendMassiveMessagesFromCsv, sendMassiveMessagesFromTxt, sendMassiveMessagesFromList, getReceivedMessages } from "../../controllers/messaging/message.controller.js";

router.post("/send", sendMessage);

// masivo desde CSV
router.post("/massive", sendMassiveMessagesFromCsv);

// masivo desde TXT
router.post("/massive-txt", sendMassiveMessagesFromTxt);

// masivo desde lista de números + texto único
router.post("/massive-list", sendMassiveMessagesFromList);

router.get("/received", getReceivedMessages);

export default router;
