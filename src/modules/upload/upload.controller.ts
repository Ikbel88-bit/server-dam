// 4. src/modules/upload/upload.controller.ts (NOUVEAU)
// ================================
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Logger,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';
import type { Express } from 'express';
import 'multer';

@ApiTags('Upload')
@ApiBearerAuth('JWT-auth')
@Controller('api/upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('video')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('video/')) {
          return callback(
            new BadRequestException('Seulement les fichiers vidéo sont autorisés'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    this.logger.log('📤 ============ VIDEO UPLOAD CLOUDINARY ============');

    if (!file) {
      this.logger.error('❌ Aucun fichier uploadé');
      throw new BadRequestException('Aucun fichier uploadé');
    }

    this.logger.log(`📹 Fichier reçu: ${file.originalname}`);
    this.logger.log(`📏 Taille: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    this.logger.log(`📦 Type MIME: ${file.mimetype}`);

    // ✅ Upload vers Cloudinary
    const uploadResult = await this.cloudinaryService.uploadVideo(file);

    // ✅ Générer thumbnail automatiquement
    const thumbnailUrl = await this.cloudinaryService.generateVideoThumbnail(
      uploadResult.public_id
    );

    this.logger.log(`🌐 Vidéo URL: ${uploadResult.secure_url}`);
    this.logger.log(`🖼️ Thumbnail URL: ${thumbnailUrl}`);
    this.logger.log('✅ ============ UPLOAD SUCCESS ============');

    return {
      statusCode: HttpStatus.OK,
      message: 'Vidéo uploadée avec succès sur Cloudinary',
      data: {
        video_url: uploadResult.secure_url,
        thumbnail_url: thumbnailUrl,
        file_size: uploadResult.bytes,
        mime_type: file.mimetype,
        original_name: file.originalname,
        video_id: uploadResult.public_id,
        duration: uploadResult.duration || null,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        cloudinary_data: {
          public_id: uploadResult.public_id,
          resource_type: uploadResult.resource_type,
          created_at: uploadResult.created_at,
          eager: uploadResult.eager, // Versions transformées
        },
      },
    };
  }

  @Post('thumbnail')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new BadRequestException('Seulement les fichiers image sont autorisés'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadThumbnail(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier uploadé');
    }

    this.logger.log(`📸 Upload thumbnail: ${file.originalname}`);

    // ✅ Upload vers Cloudinary
    const uploadResult = await this.cloudinaryService.uploadImage(file);

    this.logger.log(`✅ Thumbnail uploadée: ${uploadResult.secure_url}`);

    return {
      statusCode: HttpStatus.OK,
      message: 'Thumbnail uploadée avec succès',
      data: {
        thumbnail_url: uploadResult.secure_url,
        file_size: uploadResult.bytes,
        mime_type: file.mimetype,
        public_id: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
      },
    };
  }
}