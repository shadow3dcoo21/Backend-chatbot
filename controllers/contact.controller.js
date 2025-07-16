import Contact from '../models/Contact/Contact.js';

// Crear un nuevo contacto
export const createContact = async (req, res) => {
  try {
    const { companyRef, name, number, excludedFromN8n } = req.body;
    // Validación de empresa para admin
    if (req.user && req.user.role === 'admin') {
      if (!req.user.company || companyRef !== String(req.user.company.id)) {
        return res.status(403).json({ error: 'Solo puedes crear contactos para tu propia empresa.' });
      }
    }
    if (!companyRef || !number) {
      return res.status(400).json({ error: 'companyRef y number son requeridos.' });
    }
    const exists = await Contact.findOne({ companyRef, number });
    if (exists) {
      return res.status(409).json({ error: 'Ya existe un contacto con ese número para la empresa.' });
    }
    const contact = new Contact({ companyRef, name, number, excludedFromN8n });
    await contact.save();
    return res.status(201).json(contact);
  } catch (err) {
    console.error('Error al crear contacto:', err);
    return res.status(500).json({ error: 'Error interno al crear el contacto.' });
  }
};

// Listar contactos por empresa
export const listContacts = async (req, res) => {
  try {
    // Usar filtro de empresa del middleware si está presente
    let filter = {};
    if (req.companyFilter) {
      filter = { ...req.companyFilter };
    } else {
      // Fallback: usar companyId de query (para superadmin o casos legacy)
      const { companyId } = req.query;
      if (!companyId) {
        return res.status(400).json({ error: 'companyId es requerido en query.' });
      }
      filter = { companyRef: companyId };
    }
    const contacts = await Contact.find(filter);
    return res.json(contacts);
  } catch (err) {
    console.error('Error al listar contactos:', err);
    return res.status(500).json({ error: 'Error interno al listar contactos.' });
  }
};

// Actualizar contacto
export const updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    let contact;
    if (req.user && req.user.role === 'admin') {
      contact = await Contact.findOne({ _id: id, companyRef: req.user.company.id });
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado.' });
      }
      // Actualizar solo si pertenece a la empresa
      Object.assign(contact, update);
      await contact.save();
    } else {
      contact = await Contact.findByIdAndUpdate(id, update, { new: true });
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado.' });
      }
    }
    return res.json(contact);
  } catch (err) {
    console.error('Error al actualizar contacto:', err);
    return res.status(500).json({ error: 'Error interno al actualizar contacto.' });
  }
};

// Eliminar contacto
export const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    let contact;
    if (req.user && req.user.role === 'admin') {
      contact = await Contact.findOneAndDelete({ _id: id, companyRef: req.user.company.id });
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado.' });
      }
    } else {
      contact = await Contact.findByIdAndDelete(id);
      if (!contact) {
        return res.status(404).json({ error: 'Contacto no encontrado.' });
      }
    }
    return res.json({ message: 'Contacto eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar contacto:', err);
    return res.status(500).json({ error: 'Error interno al eliminar contacto.' });
  }
};

// Comprobar si un número está en la lista de contactos de la empresa
export const isNumberInContacts = async (req, res) => {
  try {
    let companyId = req.query.companyId;
    const { number } = req.query;
    // Validación de empresa para admin
    if (req.user && req.user.role === 'admin') {
      if (!req.user.company) {
        return res.status(403).json({ error: 'No tienes empresa asociada en tu sesión.' });
      }
      companyId = req.user.company.id;
    }
    if (!companyId || !number) {
      return res.status(400).json({ error: 'companyId y number son requeridos.' });
    }
    // Buscar coincidencia exacta
    const contact = await Contact.findOne({ companyRef: companyId, number });
    return res.json({ exists: !!contact });
  } catch (err) {
    console.error('Error al comprobar número en contactos:', err);
    return res.status(500).json({ error: 'Error interno al comprobar número.' });
  }
}; 