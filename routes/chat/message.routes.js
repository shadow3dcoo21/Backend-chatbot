// src/routes/message.routes.js
import express from "express";
const router = express.Router();

import { sendMessage, sendMassiveMessagesFromCsv, sendMassiveMessagesFromTxt, sendMassiveMessagesFromList, getReceivedMessages } from "../../controllers/messaging/message.controller.js";

router.post("/send/:companyId", sendMessage);

// masivo desde CSV
router.post("/massive/:companyId", sendMassiveMessagesFromCsv);

// masivo desde TXT
router.post("/massive-txt/:companyId", sendMassiveMessagesFromTxt);

// masivo desde lista de números + texto único
router.post("/massive-list/:companyId", sendMassiveMessagesFromList);

router.get("/received/:companyId", getReceivedMessages);

export default router;
