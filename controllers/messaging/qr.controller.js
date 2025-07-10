import { getQrImage, isClientReady } from "../../services/whatsapp.service.js";

export const getQrController = (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Usuario no autenticado" });
  }

  if (isClientReady(userId)) {
    return res.json({ message: "Ya conectado" });
  }

  const qr = getQrImage(userId);
  if (!qr) return res.status(404).json({ message: "Esperando QR..." });

  res.json({ qr });
};
