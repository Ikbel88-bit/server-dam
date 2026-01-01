// 3. src/modules/upload/cloudinary.service.ts
// ================================
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';
import type { Express } from 'express';
import 'multer';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /**
   * Upload vidéo vers Cloudinary
   */
  async uploadVideo(
    file: Express.Multer.File
  ): Promise<UploadApiResponse> {
    try {
      this.logger.log(`📤 Upload vidéo vers Cloudinary: ${file.originalname}`);

      return new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: 'reels/videos',
            use_filename: true,
            unique_filename: true,
            overwrite: false,
            transformation: [
              {
                quality: 'auto',
                fetch_format: 'auto',
              }
            ],
            // Limites
            eager: [
              { width: 720, crop: 'scale', format: 'mp4' }, // Version HD
              { width: 480, crop: 'scale', format: 'mp4' }, // Version SD
            ],
            eager_async: true,
          },
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              this.logger.error(`❌ Erreur upload Cloudinary: ${error.message}`);
              return reject(error);
            }
            
            if (!result) {
              return reject(new Error('No result from Cloudinary'));
            }

            this.logger.log(`✅ Vidéo uploadée: ${result.public_id}`);
            this.logger.log(`🌐 URL: ${result.secure_url}`);
            resolve(result);
          }
        );

        // Convertir le buffer en stream et pipe vers Cloudinary
        const bufferStream = Readable.from(file.buffer);
        bufferStream.pipe(uploadStream);
      });

    } catch (error) {
      this.logger.error(`❌ Erreur upload vidéo: ${error.message}`);
      throw new BadRequestException('Échec de l\'upload de la vidéo');
    }
  }

  /**
   * Upload thumbnail (image) vers Cloudinary
   */
  async uploadImage(
    file: Express.Multer.File
  ): Promise<UploadApiResponse> {
    try {
      this.logger.log(`📤 Upload image vers Cloudinary: ${file.originalname}`);

      return new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'reels/thumbnails',
            use_filename: true,
            unique_filename: true,
            overwrite: false,
            transformation: [
              {
                width: 720,
                height: 1280,
                crop: 'fill',
                quality: 'auto',
                format: 'jpg',
              }
            ],
          },
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              this.logger.error(`❌ Erreur upload Cloudinary: ${error.message}`);
              return reject(error);
            }
            
            if (!result) {
              return reject(new Error('No result from Cloudinary'));
            }

            this.logger.log(`✅ Image uploadée: ${result.public_id}`);
            resolve(result);
          }
        );

        const bufferStream = Readable.from(file.buffer);
        bufferStream.pipe(uploadStream);
      });

    } catch (error) {
      this.logger.error(`❌ Erreur upload image: ${error.message}`);
      throw new BadRequestException('Échec de l\'upload de l\'image');
    }
  }

  /**
   * Supprimer une ressource de Cloudinary
   */
  async deleteResource(publicId: string, resourceType: 'video' | 'image' = 'image'): Promise<void> {
    try {
      this.logger.log(`🗑️ Suppression de ${resourceType}: ${publicId}`);
      
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      
      this.logger.log(`✅ Ressource supprimée: ${publicId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur suppression: ${error.message}`);
      throw error;
    }
  }

  /**
   * Générer une thumbnail depuis une vidéo
   */
  async generateVideoThumbnail(videoPublicId: string): Promise<string> {
    try {
      // Cloudinary génère automatiquement une thumbnail à partir de la vidéo
      // Format: video_public_id.jpg (première frame)
      const thumbnailUrl = cloudinary.url(videoPublicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
          { width: 720, height: 1280, crop: 'fill' },
          { quality: 'auto' }
        ]
      });

      this.logger.log(`🖼️ Thumbnail générée: ${thumbnailUrl}`);
      return thumbnailUrl;

    } catch (error) {
      this.logger.error(`❌ Erreur génération thumbnail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtenir les métadonnées d'une vidéo
   */
  async getVideoMetadata(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: 'video',
      });

      return {
        duration: result.duration,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
      };

    } catch (error) {
      this.logger.error(`❌ Erreur récupération métadonnées: ${error.message}`);
      throw error;
    }
  }
}