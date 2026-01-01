import {
  Controller,
  Body,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response, Express } from 'express';
import 'multer';
import { join, isAbsolute } from 'path';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { SetProfilePictureDto } from './dto/set-profile-picture.dto';
import { UseGuards } from '@nestjs/common';


@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ✅ 1. Voir son profil complet
  @Get('profile')
  @ApiOperation({ summary: 'Obtenir son profil complet' })
  @ApiResponse({ status: 200, description: 'Profil utilisateur retourné' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.usersService.getProfile(user.user_id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Profil récupéré avec succès',
      data: profile,
    };
  }

  // ✅ 1.b Obtenir le nom d'un utilisateur à partir de son ID
  @Get(':id/name')
  @ApiOperation({ summary: 'Récupérer le nom complet et le username via un ID utilisateur' })
  async getUserNameById(@Param('id') id: string) {
    const data = await this.usersService.getUserNameById(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Nom utilisateur récupéré avec succès',
      data,
    };
  }

  @Get(':id/reels')
  @ApiOperation({ summary: 'Lister tous les reels appartenant à un utilisateur' })
  async getUserReels(@Param('id') id: string) {
    const data = await this.usersService.getUserReels(id);

    return {
      statusCode: HttpStatus.OK,
      message: 'Reels récupérés avec succès',
      data,
    };
  }

  @Get(':id/restaurants')
  @ApiOperation({ summary: 'Lister tous les restaurants appartenant à un utilisateur' })
  async getUserRestaurants(@Param('id') id: string) {
    const data = await this.usersService.getUserRestaurants(id);

    return {
      statusCode: HttpStatus.OK,
      message: 'Restaurants récupérés avec succès',
      data,
    };
  }

  // ✅ 2. Mettre à jour son profil
  @Put('profile')
  @ApiOperation({ summary: 'Mettre à jour son profil (username, nom, bio, photo, catégories)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Profil mis à jour' })
  @UseInterceptors(
    FileInterceptor('profile_picture', {
      storage: diskStorage({
        destination: process.env.UPLOAD_PATH || './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname);
          callback(null, `avatar-${uniqueSuffix}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException('Seules les images sont autorisées'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateDto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const payload = file
      ? { ...updateDto, profile_picture: file.path }
      : updateDto;

    const updatedUser = await this.usersService.updateProfile(
      user.user_id,
      payload,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Profil mis à jour avec succès',
      data: updatedUser,
    };
  }

  // ✅ 2.b. Changer la photo de profil (URL externe ou image par défaut)
  @Patch('profile/picture')
  @ApiOperation({ 
    summary: 'Changer la photo de profil',
    description: 'Permet de définir une photo de profil soit via une URL externe, soit en choisissant une image par défaut (p2, p3, p4, p5)'
  })
  @ApiResponse({ status: 200, description: 'Photo de profil mise à jour' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async setProfilePicture(
    @CurrentUser() user: any,
    @Body() setPictureDto: SetProfilePictureDto,
  ) {
    const updatedUser = await this.usersService.setProfilePicture(
      user.user_id,
      setPictureDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Photo de profil mise à jour avec succès',
      data: updatedUser,
    };
  }

  // ✅ 2.c. Récupérer l'image de profil d'un utilisateur
  @Get(':id/picture')
  @ApiOperation({ 
    summary: 'Récupérer l\'image de profil d\'un utilisateur',
    description: 'Retourne l\'image de profil d\'un utilisateur à partir de son ID. Pour les URLs externes, retourne une redirection.'
  })
  @ApiResponse({ status: 200, description: 'Image retournée' })
  @ApiResponse({ status: 404, description: 'Utilisateur ou image non trouvée' })
  async getUserProfilePicture(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pictureInfo = await this.usersService.getUserProfilePicture(id);

    // Si c'est une URL externe, rediriger
    if (pictureInfo.type === 'external') {
      return res.redirect(pictureInfo.url);
    }

    // TypeScript sait maintenant que pictureInfo.type === 'local'
    // donc pictureInfo.path et pictureInfo.relativePath sont définis
    const imagePath = pictureInfo.path;
    const relativePath = pictureInfo.relativePath;

    // Si c'est une image locale, vérifier qu'elle existe et la retourner
    if (!fs.existsSync(imagePath)) {
      throw new NotFoundException('Image de profil introuvable');
    }

    // Déterminer le type MIME basé sur l'extension
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = mimeTypes[ext || ''] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${relativePath.split('/').pop() || 'profile.jpg'}"`);
    
    // sendFile attend un chemin absolu
    const absolutePath = isAbsolute(imagePath)
      ? imagePath
      : imagePath;
    
    return res.sendFile(absolutePath);
  }

  // ✅ 3. Changer son mot de passe
  @Patch('change-password')
  @ApiOperation({ summary: 'Changer son mot de passe (avec vérification ancien MDP)' })
  @ApiResponse({ status: 200, description: 'Mot de passe modifié' })
  @ApiResponse({ status: 400, description: 'Nouveau mot de passe identique à l\'ancien' })
  @ApiResponse({ status: 401, description: 'Mot de passe actuel incorrect' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const result = await this.usersService.changePassword(
      user.user_id,
      changePasswordDto,
    );

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  // ✅ 4. Changer son email
  @Patch('change-email')
  @ApiOperation({ summary: 'Changer son adresse email' })
  @ApiResponse({ status: 200, description: 'Email modifié' })
  @ApiResponse({ status: 401, description: 'Mot de passe incorrect' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async changeEmail(
    @CurrentUser() user: any,
    @Body() changeEmailDto: ChangeEmailDto,
  ) {
    const result = await this.usersService.changeEmail(
      user.user_id,
      changeEmailDto,
    );

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

   // ✅ 5. Désactiver son compte (réversible)
  @Patch('suspend')
  @ApiOperation({ summary: 'Désactiver son compte (réversible, données conservées)' })
  @ApiResponse({ status: 200, description: 'Compte désactivé' })
  async suspendAccount(@CurrentUser() user: any) {
    const result = await this.usersService.suspendAccount(user.user_id);

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  // ✅ 6. Réactiver son compte
  @Patch('reactivate')
  @ApiOperation({ summary: 'Réactiver un compte désactivé' })
  @ApiResponse({ status: 200, description: 'Compte réactivé' })
  async reactivateAccount(@CurrentUser() user: any) {
    const result = await this.usersService.reactivateAccount(user.user_id);

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  // ✅ 7. Demander la suppression du compte (soft delete - 30 jours de grâce)
  @Delete('delete')
  @ApiOperation({ 
    summary: 'Demander la suppression de son compte (30 jours de grâce pour récupération)',
    description: 'Le compte sera marqué pour suppression. Vous avez 30 jours pour annuler via /users/recover'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Suppression programmée, 30 jours pour récupérer le compte' 
  })
  @ApiResponse({ status: 401, description: 'Mot de passe incorrect' })
  async requestDeletion(
    @CurrentUser() user: any,
    @Body() deleteDto: DeleteAccountDto,
  ) {
    const result = await this.usersService.requestAccountDeletion(
      user.user_id,
      deleteDto,
    );

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }

  // ✅ 8. Récupérer un compte en attente de suppression
  @Patch('recover')
  @ApiOperation({ 
    summary: 'Annuler la suppression et récupérer son compte',
    description: 'Disponible uniquement pendant les 30 jours après la demande de suppression'
  })
  @ApiResponse({ status: 200, description: 'Compte récupéré avec succès' })
  @ApiResponse({ status: 400, description: 'Compte non en attente de suppression' })
  async recoverAccount(@CurrentUser() user: any) {
    const result = await this.usersService.recoverAccount(user.user_id);

    return {
      statusCode: HttpStatus.OK,
      ...result,
    };
  }
}