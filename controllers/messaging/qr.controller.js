import { getQrImage, isClientReady } from "../../services/whatsapp.service.js";

export const getQrController = (req, res) => {
  const companyId = req.params.companyId;
  if (!companyId) {
    return res.status(401).json({ message: "Se requiere id de compañia" });
  }

  if (isClientReady(companyId)) {
    return res.json({ message: "Ya conectado" });
  }

  const qr = getQrImage(companyId);
  if (!qr) return res.status(404).json({ message: "Esperando QR..." });

  res.json({ qr });
};
