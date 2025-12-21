import { v2 as cloudinary } from 'cloudinary';

/**
 * Configure Cloudinary with credentials from .env
 * Required environment variables:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} mimetype - File MIME type (e.g., 'image/jpeg')
 * @param {string} userId - User ID for organizing uploads
 * @returns {Promise<string>} Cloudinary URL or null if upload fails
 */
export async function uploadToCloudinary(buffer, mimetype, userId) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('[WARN] Cloudinary not configured. Skipping upload.');
    return null;
  }

  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'tic-projects/avatars',
          public_id: `user-${userId}-${Date.now()}`,
          resource_type: 'auto',
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            console.error('[ERROR] Cloudinary upload failed:', error.message);
            reject(error);
          } else {
            console.log('[INFO] Avatar uploaded to Cloudinary:', result.secure_url);
            resolve(result.secure_url);
          }
        }
      );

      // Write buffer to upload stream
      uploadStream.end(buffer);
    });
  } catch (err) {
    console.error('[ERROR] Cloudinary upload error:', err.message);
    return null;
  }
}

/**
 * Delete image from Cloudinary
 * @param {string} url - Cloudinary URL to delete
 */
export async function deleteFromCloudinary(url) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !url) {
    return;
  }

  try {
    // Extract public_id from URL
    const matches = url.match(/\/([^/]+)$/);
    if (matches && matches[1]) {
      const publicId = matches[1].split('.')[0];
      await cloudinary.uploader.destroy(`tic-projects/avatars/${publicId}`);
      console.log('[INFO] Avatar deleted from Cloudinary');
    }
  } catch (err) {
    console.error('[ERROR] Cloudinary deletion failed:', err.message);
  }
}
