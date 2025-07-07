// src/routes/message.routes.js
const express = require("express");
const router = express.Router();

const {
  sendMessage,
  sendMassiveMessagesFromCsv,
  sendMassiveMessagesFromTxt,
  sendMassiveMessagesFromList, // <-- nuevo handler
  getReceivedMessages,
} = require("../../controllers/messaging/message.controller");

router.post("/send", sendMessage);

// masivo desde CSV
router.post("/massive", sendMassiveMessagesFromCsv);

// masivo desde TXT
router.post("/massive-txt", sendMassiveMessagesFromTxt);

// masivo desde lista de números + texto único
router.post("/massive-list", sendMassiveMessagesFromList);

router.get("/received", getReceivedMessages);

module.exports = router;
