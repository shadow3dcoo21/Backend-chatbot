import Company from '../models/Company.js';
import csv from 'csv-parser';
import fs from 'fs';

/**
 * @desc    Obtener todas las empresas
 * @route   GET /api/companies
 * @access  Private
 */
export const getAllCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, tipo, activo, concepto } = req.query;
    
    let query = {};
    
    // Filtro por búsqueda de texto
    if (search) {
      query.$text = { $search: search };
    }
    
    // Filtro por tipo
    if (tipo) {
      query.tipo = { $regex: tipo, $options: 'i' };
    }
    
    // Filtro por estado activo
    if (activo !== undefined) {
      query.activo = activo === 'true';
    }

    // Filtro por concepto en campos adicionales
    if (concepto) {
      query['camposAdicionales.concepto'] = { $regex: concepto, $options: 'i' };
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { fechaCreacion: -1 }
    };
    
    const companies = await Company.find(query)
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
    
    const total = await Company.countDocuments(query);
    
    res.json({
      success: true,
      data: companies,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener empresas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Obtener una empresa por ID
 * @route   GET /api/companies/:id
 * @access  Private
 */
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await Company.findById(id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Empresa no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Crear una nueva empresa
 * @route   POST /api/companies
 * @access  Private
 */
export const createCompany = async (req, res) => {
  try {
    const companyData = req.body;
    
    // Validar campos requeridos
    if (!companyData.nombre || !companyData.tipo) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y tipo son campos requeridos'
      });
    }

    // Procesar horario de atención si viene como string (compatibilidad)
    if (typeof companyData.horarioAtencion === 'string') {
      companyData.horarioAtencion = [{
        concepto: 'Horario General',
        descripcion: companyData.horarioAtencion
      }];
    }

    // Procesar campos adicionales si vienen como objeto plano
    if (companyData.camposAdicionales && !Array.isArray(companyData.camposAdicionales)) {
      const campos = [];
      Object.keys(companyData.camposAdicionales).forEach(key => {
        campos.push({
          concepto: key,
          descripcion: companyData.camposAdicionales[key],
          tipo: 'texto'
        });
      });
      companyData.camposAdicionales = campos;
    }
    
    const company = new Company(companyData);
    await company.save();
    
    res.status(201).json({
      success: true,
      data: company,
      message: 'Empresa creada exitosamente'
    });
  } catch (error) {
    console.error('Error al crear empresa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Crear múltiples empresas desde CSV
 * @route   POST /api/companies/upload-csv
 * @access  Private
 */
export const uploadCompaniesFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se ha proporcionado ningún archivo CSV'
      });
    }
    
    const results = [];
    const errors = [];
    
    // Leer y procesar el archivo CSV
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        // Mapear campos del CSV a nuestro modelo
        const companyData = {
          nombre: data.Nombre || data.nombre,
          tipo: data.Tipo || data.tipo,
          fundado: data.Fundado || data.fundado,
          direccion: data.Direccion || data.direccion,
          telefonoRecepcion: data['Teléfono recepción'] || data.telefonoRecepcion,
          telefonoSecretaria: data['Teléfono secretaría'] || data.telefonoSecretaria,
          correoInstitucional: data['Correo institucional'] || data.correoInstitucional,
          lemaSaludo: data['Lema / Saludo institucional'] || data.lemaSaludo,
          website: data.Website || data.website
        };

        // Procesar horario de atención
        if (data['Horario de atención'] || data.horarioAtencion) {
          companyData.horarioAtencion = [{
            concepto: 'Horario General',
            descripcion: data['Horario de atención'] || data.horarioAtencion
          }];
        }

        // Procesar campos adicionales dinámicos
        const camposAdicionales = [];
        Object.keys(data).forEach(key => {
          // Si no es un campo estándar, agregarlo como campo adicional
          const camposEstandar = ['Nombre', 'nombre', 'Tipo', 'tipo', 'Fundado', 'fundado', 
                                 'Dirección', 'direccion', 'Teléfono recepción', 'telefonoRecepcion',
                                 'Teléfono secretaría', 'telefonoSecretaria', 'Correo institucional', 
                                 'correoInstitucional', 'Horario de atención', 'horarioAtencion',
                                 'Lema / Saludo institucional', 'lemaSaludo', 'Website', 'website'];
          
          if (!camposEstandar.includes(key) && data[key] && data[key].trim() !== '') {
            camposAdicionales.push({
              concepto: key,
              descripcion: data[key],
              tipo: 'texto'
            });
          }
        });

        if (camposAdicionales.length > 0) {
          companyData.camposAdicionales = camposAdicionales;
        }
        
        // Validar campos requeridos
        if (companyData.nombre && companyData.tipo) {
          results.push(companyData);
        } else {
          errors.push({
            row: results.length + errors.length + 1,
            error: 'Faltan campos requeridos (nombre o tipo)',
            data: companyData
          });
        }
      })
      .on('end', async () => {
        try {
          // Insertar empresas en lote
          const createdCompanies = await Company.insertMany(results);
          
          // Eliminar archivo temporal
          fs.unlinkSync(req.file.path);
          
          res.json({
            success: true,
            message: `${createdCompanies.length} empresas creadas exitosamente`,
            data: {
              created: createdCompanies.length,
              errors: errors.length,
              errorDetails: errors
            }
          });
        } catch (insertError) {
          console.error('Error al insertar empresas:', insertError);
          res.status(500).json({
            success: false,
            error: 'Error al insertar empresas en la base de datos'
          });
        }
      })
      .on('error', (error) => {
        console.error('Error al procesar CSV:', error);
        res.status(500).json({
          success: false,
          error: 'Error al procesar el archivo CSV'
        });
      });
  } catch (error) {
    console.error('Error al procesar archivo CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Actualizar una empresa
 * @route   PUT /api/companies/:id
 * @access  Private
 */
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Actualizar fecha de modificación
    updateData.fechaActualizacion = new Date();

    // Procesar horario de atención si viene como string
    if (typeof updateData.horarioAtencion === 'string') {
      updateData.horarioAtencion = [{
        concepto: 'Horario General',
        descripcion: updateData.horarioAtencion
      }];
    }

    // Procesar campos adicionales si vienen como objeto plano
    if (updateData.camposAdicionales && !Array.isArray(updateData.camposAdicionales)) {
      const campos = [];
      Object.keys(updateData.camposAdicionales).forEach(key => {
        campos.push({
          concepto: key,
          descripcion: updateData.camposAdicionales[key],
          tipo: 'texto'
        });
      });
      updateData.camposAdicionales = campos;
    }
    
    const company = await Company.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Empresa no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: company,
      message: 'Empresa actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Eliminar una empresa
 * @route   DELETE /api/companies/:id
 * @access  Private
 */
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await Company.findByIdAndDelete(id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Empresa no encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Empresa eliminada exitosamente',
      data: company
    });
  } catch (error) {
    console.error('Error al eliminar empresa:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Eliminar múltiples empresas
 * @route   DELETE /api/companies/bulk-delete
 * @access  Private
 */
export const bulkDeleteCompanies = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un array de IDs válidos'
      });
    }
    
    const result = await Company.deleteMany({ _id: { $in: ids } });
    
    res.json({
      success: true,
      message: `${result.deletedCount} empresas eliminadas exitosamente`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error al eliminar empresas en lote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Agregar campo adicional a una empresa
 * @route   POST /api/companies/:id/campos
 * @access  Private
 */
export const addCustomField = async (req, res) => {
  try {
    const { id } = req.params;
    const { concepto, descripcion, tipo = 'texto', valor } = req.body;
    
    if (!concepto) {
      return res.status(400).json({
        success: false,
        error: 'El concepto es requerido'
      });
    }
    
    const company = await Company.findById(id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Empresa no encontrada'
      });
    }
    
    // Verificar si el concepto ya existe
    const campoExistente = company.camposAdicionales.find(
      campo => campo.concepto.toLowerCase() === concepto.toLowerCase()
    );
    
    if (campoExistente) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un campo con ese concepto'
      });
    }
    
    company.camposAdicionales.push({
      concepto,
      descripcion,
      tipo,
      valor
    });
    
    company.fechaActualizacion = new Date();
    await company.save();
    
    res.json({
      success: true,
      data: company,
      message: 'Campo adicional agregado exitosamente'
    });
  } catch (error) {
    console.error('Error al agregar campo adicional:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Actualizar campo adicional de una empresa
 * @route   PUT /api/companies/:id/campos/:concepto
 * @access  Private
 */
export const updateCustomField = async (req, res) => {
  try {
    const { id, concepto } = req.params;
    const { descripcion, tipo, valor } = req.body;
    
    const company = await Company.findById(id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Empresa no encontrada'
      });
    }
    
    const campoIndex = company.camposAdicionales.findIndex(
      campo => campo.concepto.toLowerCase() === concepto.toLowerCase()
    );
    
    if (campoIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Campo no encontrado'
      });
    }
    
    // Actualizar solo los campos proporcionados
    if (descripcion !== undefined) company.camposAdicionales[campoIndex].descripcion = descripcion;
    if (tipo !== undefined) company.camposAdicionales[campoIndex].tipo = tipo;
    if (valor !== undefined) company.camposAdicionales[campoIndex].valor = valor;
    
    company.fechaActualizacion = new Date();
    await company.save();
    
    res.json({
      success: true,
      data: company,
      message: 'Campo adicional actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar campo adicional:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
