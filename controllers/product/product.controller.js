import Product from '../../models/Product/Product.js';

/**
 * Crea un nuevo producto
 * Solo para administradores o miembros con permiso canHandleProducts
 */
export const createProduct = async (req, res, next) => {
    try {
        const { company } = req; // Obtenido del middleware canHandleProducts
        const userId = req.user.id;

        // Si se subió una imagen, agregar la ruta al campo image
        let imagePath = undefined;
        if (req.file) {
            imagePath = `/uploads/companies/${req.file.filename}`;
        }

        const productData = {
            ...req.body,
            company: company._id,
            createdBy: userId,
            updatedBy: userId,
            ...(imagePath && { image: imagePath })
        };

        const product = new Product(productData);
        await product.save();

        // Populate para devolver datos completos
        const populatedProduct = await Product.findById(product._id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        return res.status(201).json({
            success: true,
            message: 'Producto creado exitosamente',
            data: populatedProduct
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al crear el producto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene un producto por ID
 * Accesible por cualquier miembro de la compañía
 */
export const getProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        // Verificar que el usuario pertenezca a la compañía del producto
        const isMember = await Product.findOne({
            _id: id,
            'company': req.company._id
        });

        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para ver este producto',
                code: 'FORBIDDEN'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Producto obtenido',
            data: product
        });
    } catch (error) {
        console.error('Error al obtener producto:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al obtener el producto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Actualiza un producto
 * Solo para administradores o miembros con permiso canHandleProducts
 */
export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Si se subió una imagen, actualizar el campo image
        let imagePath = undefined;
        if (req.file) {
            imagePath = `/uploads/companies/${req.file.filename}`;
        }

        const updates = {
            ...req.body,
            updatedBy: userId,
            ...(imagePath && { image: imagePath })
        };

        const product = await Product.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate('company', 'name')
            .populate('createdBy', 'username email')
            .populate('updatedBy', 'username email');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        // Verificar que el producto pertenezca a la compañía del usuario
        if (product.company._id.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para actualizar este producto',
                code: 'FORBIDDEN'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Producto actualizado exitosamente',
            data: product
        });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar el producto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Elimina un producto
 * Solo para administradores o miembros con permiso canHandleProducts
 */
export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        // Verificar que el producto pertenezca a la compañía del usuario
        if (product.company.toString() !== req.company._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permiso para eliminar este producto',
                code: 'FORBIDDEN'
            });
        }

        await Product.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar el producto',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Lista los productos de una compañía
 * Accesible por cualquier miembro de la compañía
 */
export const listCompanyProducts = async (req, res, next) => {
    try {
        const { company } = req;
        //const { page = 1, limit = 10, search = '' } = req.query;

        // const options = {
        //     page: parseInt(page, 10),
        //     limit: parseInt(limit, 10),
        //     search: search.toString()
        // };

        const products = await Product.findByCompany(company._id);
        return res.status(200).json({
            success: true,
            message: 'Productos obtenidos',
            data: products
        });
    } catch (error) {
        console.error('Error al listar productos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al listar los productos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    createProduct,
    getProduct,
    updateProduct,
    deleteProduct,
    listCompanyProducts
};
