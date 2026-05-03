import { v2 as cloudinary } from 'cloudinary';
import { getEnv } from '../config/envValidation.js';
import { getLogger } from '../utils/logger.js';
/**
 * Cloudinary Service
 * Handles all Cloudinary operations with proper error handling
 *
 * CRITICAL: All operations must be validated against MongoDB first
 * This service only handles Cloudinary API calls, not authorization
 */
// Initialize Cloudinary configuration
let isConfigured = false;
export function initializeCloudinary() {
    const env = getEnv();
    // Audit Phase-3 Fix: Graceful degradation - log warning with structured logger when credentials missing, don't fail startup
    // Cloudinary is optional - only initialize if credentials are provided
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
        cloudinary.config({
            cloud_name: env.CLOUDINARY_CLOUD_NAME,
            api_key: env.CLOUDINARY_API_KEY,
            api_secret: env.CLOUDINARY_API_SECRET,
            secure: true // Always use HTTPS
        });
        isConfigured = true;
        const logger = getLogger();
        logger.info({ msg: 'Cloudinary initialized successfully', service: 'cloudinary' });
    }
    else {
        // Audit Phase-3 Fix: Use structured logger for graceful degradation warning
        const logger = getLogger();
        logger.warn({
            msg: 'Cloudinary credentials not provided - media uploads will be disabled',
            service: 'cloudinary',
            featureDisabled: 'media_uploads'
        });
        isConfigured = false;
    }
}
/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured() {
    return isConfigured;
}
/**
 * Upload file to Cloudinary
 *
 * @param fileBuffer - File buffer or base64 string
 * @param options - Upload options
 * @returns Upload result with Cloudinary metadata
 * @throws Error if upload fails or Cloudinary is not configured
 */
export async function uploadToCloudinary(fileBuffer, options) {
    if (!isConfigured) {
        throw new Error('Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
    }
    try {
        const uploadOptions = {
            folder: options.folder,
            resource_type: options.resourceType || 'auto',
            overwrite: options.overwrite || false,
            invalidate: options.invalidate || true,
        };
        // Add transformations if provided
        if (options.transformation) {
            uploadOptions.transformation = options.transformation;
        }
        // Upload based on input type
        let uploadResult;
        if (Buffer.isBuffer(fileBuffer)) {
            // Upload from buffer
            uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                });
                uploadStream.end(fileBuffer);
            });
        }
        else {
            // Upload from base64 string
            uploadResult = await cloudinary.uploader.upload(fileBuffer, uploadOptions);
        }
        if (!uploadResult) {
            throw new Error('Cloudinary upload returned no result');
        }
        return {
            publicId: uploadResult.public_id,
            secureUrl: uploadResult.secure_url,
            resourceType: uploadResult.resource_type,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height,
            duration: uploadResult.duration,
            bytes: uploadResult.bytes
        };
    }
    catch (error) {
        const logger = getLogger().child({ service: 'cloudinary' });
        logger.error({ err: error }, '[Cloudinary] Upload error');
        throw new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`);
    }
}
/**
 * Delete asset from Cloudinary
 *
 * @param publicId - Cloudinary public ID
 * @param resourceType - Resource type (image, video, raw)
 * @returns True if deleted successfully, false otherwise
 *
 * Note: This is best-effort. Failures should not block MongoDB operations.
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
    const logger = getLogger().child({ service: 'cloudinary' });
    if (!isConfigured) {
        logger.warn({ publicId, resourceType }, '[Cloudinary] Delete skipped - Cloudinary not configured');
        return false;
    }
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true // Invalidate CDN cache
        });
        if (result.result === 'ok' || result.result === 'not found') {
            return true; // Success or already deleted
        }
        logger.warn({ publicId, resourceType, result: result.result }, '[Cloudinary] Delete returned unexpected result');
        return false;
    }
    catch (error) {
        // Best-effort deletion - log but don't throw
        logger.error({ err: error, publicId, resourceType }, '[Cloudinary] Delete error');
        return false;
    }
}
/**
 * Get Cloudinary URL with transformations
 *
 * @param publicId - Cloudinary public ID
 * @param transformations - Transformation options
 * @returns Transformed URL
 */
export function getCloudinaryUrl(publicId, transformations) {
    if (!isConfigured) {
        throw new Error('Cloudinary is not configured');
    }
    return cloudinary.url(publicId, {
        secure: true,
        ...transformations
    });
}
/**
 * Validate folder path to prevent directory traversal
 *
 * @param folder - Folder path to validate
 * @returns Sanitized folder path
 */
export function sanitizeFolderPath(folder) {
    // Remove any path traversal attempts
    let sanitized = folder
        .replace(/\.\./g, '') // Remove ..
        .replace(/\/+/g, '/') // Collapse multiple slashes
        .replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes
    // Ensure it doesn't start with a slash
    if (sanitized.startsWith('/')) {
        sanitized = sanitized.substring(1);
    }
    return sanitized;
}
//# sourceMappingURL=cloudinaryService.js.map