import Company from '../models/Company/Company.js';

// Crear una nueva compañía
export const createCompany = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre de la compañía es requerido.' });
    }

    // Verificar si ya existe una compañía con ese nombre
    const existing = await Company.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una compañía con ese nombre.' });
    }

    const company = new Company({ name: name.trim() });
    await company.save();
    return res.status(201).json(company);
  } catch (err) {
    console.error('Error al crear compañía:', err);
    return res.status(500).json({ error: 'Error interno al crear la compañía.' });
  }
}; 