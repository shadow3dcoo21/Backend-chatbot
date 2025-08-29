import Tool from '../../models/Tool/Tool.js';
import mongoose from 'mongoose';

// Crear una nueva tool
export const createTool = async (req, res) => {
    try {
        const { name, method, url, queryTemplate, bodyTemplate, headers, pick, enabled, description } = req.body;
        const companyId = req.company._id; // Usar la compañía validada por el middleware
        const userId = req.user.id;

        // Validar que el método sea válido
        if (!['GET', 'POST'].includes(method?.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'El método debe ser GET o POST'
            });
        }

        // Crear la nueva tool
        const newTool = new Tool({
            name,
            method: method.toUpperCase(),
            url,
            queryTemplate,
            bodyTemplate,
            headers,
            pick,
            enabled: enabled !== undefined ? enabled : true,
            description,
            company: companyId,
            createdBy: userId
        });

        const savedTool = await newTool.save();
        await savedTool.populate('createdBy', 'username email');

        res.status(201).json({
            success: true,
            message: 'Tool creada exitosamente',
            data: savedTool
        });
    } catch (error) {
        console.error('Error al crear tool:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una tool con ese nombre en esta compañía'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Listar tools de la compañía
export const listTools = async (req, res) => {
    try {
        const companyId = req.company._id; // Usar la compañía validada por el middleware
        const { page = 1, limit = 10, enabled } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit)
        };

        if (enabled !== undefined) {
            options.enabled = enabled === 'true';
        }

        const tools = await Tool.findByCompany(companyId, options);
        const total = await Tool.countDocuments({ 
            company: companyId,
            ...(enabled !== undefined && { enabled: enabled === 'true' })
        });

        res.json({
            success: true,
            data: tools,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error al listar tools:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Listar tools públicamente (sin autenticación)
export const listToolsPublic = async (req, res) => {
    try {
        const companyId = req.params.companyId || req.body.companyId || req.query.companyId;
        const { page = 1, limit = 10, enabled = true } = req.query;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere el ID de la compañía'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(companyId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de compañía inválido'
            });
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            enabled: enabled === 'true' || enabled === true
        };

        // Solo devolver tools habilitadas por defecto
        const tools = await Tool.findByCompany(companyId, options);
        const total = await Tool.countDocuments({ 
            company: companyId,
            enabled: options.enabled
        });

        res.json({
            success: true,
            data: tools,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error al listar tools públicamente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener tool por ID
export const getToolById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company._id; // Usar la compañía validada por el middleware

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tool inválido'
            });
        }

        const tool = await Tool.findOne({ _id: id, company: companyId })
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!tool) {
            return res.status(404).json({
                success: false,
                message: 'Tool no encontrada'
            });
        }

        res.json({
            success: true,
            data: tool
        });
    } catch (error) {
        console.error('Error al obtener tool:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Actualizar tool
export const updateTool = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company._id; // Usar la compañía validada por el middleware
        const userId = req.user.id;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tool inválido'
            });
        }

        // Validar método si se está actualizando
        if (updateData.method && !['GET', 'POST'].includes(updateData.method.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'El método debe ser GET o POST'
            });
        }

        // Normalizar método a mayúsculas
        if (updateData.method) {
            updateData.method = updateData.method.toUpperCase();
        }

        // Agregar información de actualización
        updateData.updatedBy = userId;

        const updatedTool = await Tool.findOneAndUpdate(
            { _id: id, company: companyId },
            updateData,
            { new: true, runValidators: true }
        )
        .populate('createdBy', 'username email')
        .populate('updatedBy', 'username email');

        if (!updatedTool) {
            return res.status(404).json({
                success: false,
                message: 'Tool no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Tool actualizada exitosamente',
            data: updatedTool
        });
    } catch (error) {
        console.error('Error al actualizar tool:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una tool con ese nombre en esta compañía'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Eliminar tool
export const deleteTool = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company._id; // Usar la compañía validada por el middleware

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID de tool inválido'
            });
        }

        const deletedTool = await Tool.findOneAndDelete({ _id: id, company: companyId });

        if (!deletedTool) {
            return res.status(404).json({
                success: false,
                message: 'Tool no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Tool eliminada exitosamente',
            data: deletedTool
        });
    } catch (error) {
        console.error('Error al eliminar tool:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};