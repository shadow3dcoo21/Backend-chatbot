import FAQ from '../../models/FAQ.js';
import Company from '../../models/Company/Company.js';

// Crear FAQ (requiere autenticación)
export const createFAQ = async (req, res) => {
  try {
    const { questions, answer, tags } = req.body;
    const companyId = req.company._id;
    const userId = req.user.id;
    console.log("user", req.user)
    // Validaciones
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos una pregunta'
      });
    }

    if (!answer || answer.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'La respuesta es requerida'
      });
    }

    const faq = new FAQ({
      questions: questions.map(q => q.trim()),
      answer: answer.trim(),
      tags: tags || [],
      company: companyId,
      createdBy: userId,
      updatedBy: userId
    });

    await faq.save();
    await faq.populate(['createdBy', 'updatedBy'], 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'FAQ creado exitosamente',
      data: faq
    });
  } catch (error) {
    console.error('Error al crear FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Listar FAQs (requiere autenticación)
export const listFAQs = async (req, res) => {
  try {
    const companyId = req.company._id;
    const { page = 1, limit = 10, search, tags } = req.query;
    const skip = (page - 1) * limit;

    let query = { company: companyId };

    // Filtro por tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Búsqueda por texto
    if (search) {
      query.$text = { $search: search };
    }

    const faqs = await FAQ.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FAQ.countDocuments(query);

    res.json({
      success: true,
      data: faqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al listar FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener FAQ por ID (requiere autenticación)
export const getFAQById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.company._id;

    const faq = await FAQ.findOne({ _id: id, company: companyId })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ no encontrado'
      });
    }

    res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error al obtener FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar FAQ (requiere autenticación)
export const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { questions, answer, tags } = req.body;
    const companyId = req.company._id;
    const userId = req.user._id;

    const faq = await FAQ.findOne({ _id: id, company: companyId });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ no encontrado'
      });
    }

    // Validaciones
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere al menos una pregunta'
        });
      }
      faq.questions = questions.map(q => q.trim());
    }

    if (answer !== undefined) {
      if (!answer || answer.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'La respuesta es requerida'
        });
      }
      faq.answer = answer.trim();
    }

    if (tags !== undefined) {
      faq.tags = tags || [];
    }

    faq.updatedBy = userId;
    await faq.save();
    await faq.populate(['createdBy', 'updatedBy'], 'firstName lastName email');

    res.json({
      success: true,
      message: 'FAQ actualizado exitosamente',
      data: faq
    });
  } catch (error) {
    console.error('Error al actualizar FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar solo embedding (PATCH - puede ser público)
export const updateFAQEmbedding = async (req, res) => {
  try {
    const { id } = req.params;
    const { embedding, companyId } = req.body;

    // Si no hay autenticación, requerir companyId en el body
    let query = { _id: id };
    if (req.company) {
      query.company = req.company._id;
    } else if (companyId) {
      // Verificar que la compañía existe
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Compañía no encontrada'
        });
      }
      query.company = companyId;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere companyId'
      });
    }

    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({
        success: false,
        message: 'El embedding debe ser un array de números'
      });
    }

    const faq = await FAQ.findOneAndUpdate(
      query,
      {
        embedding,
        updatedBy: req.user?._id || null
      },
      { new: true }
    );

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Embedding actualizado exitosamente',
      data: { _id: faq._id, embedding: faq.embedding }
    });
  } catch (error) {
    console.error('Error al actualizar embedding:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar FAQ (requiere autenticación)
export const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.company._id;

    const faq = await FAQ.findOneAndDelete({ _id: id, company: companyId });

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'FAQ eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar FAQ:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// ENDPOINTS PÚBLICOS

// Listar FAQs públicamente
export const listFAQsPublic = async (req, res) => {
  try {
    const { companyId } = req.query;
    const { page = 1, limit = 10, search, tags } = req.query;
    const skip = (page - 1) * limit;
    console.log("Id de compañia", companyId)
    // Verificar que la compañía existe
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Compañía no encontrada'
      });
    }

    let query = { company: companyId };

    // Filtro por tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Búsqueda por texto
    if (search) {
      query.$text = { $search: search };
    }

    const faqs = await FAQ.find(query)
      .select('questions answer tags createdAt updatedAt')
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FAQ.countDocuments(query);

    res.json({
      success: true,
      data: faqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al listar FAQs públicamente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};