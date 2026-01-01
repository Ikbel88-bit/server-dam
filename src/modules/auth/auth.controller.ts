import { 
  Controller,
  Post,
  Body,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ValidationPipe,
  UsePipes,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Express } from 'express';
import 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { SocialLoginDto, SocialProvider } from './dto/social-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import type { Response } from 'express'

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialAuthService: SocialAuthService,
  ) {}

  // ✅ ROUTE EXISTANTE - Register
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Créer un nouveau compte utilisateur' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Utilisateur créé avec succès',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email ou username déjà utilisé',
  })
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
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(
    @Body() registerDto: RegisterDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const payload = file
      ? { ...registerDto, profile_picture: file.path }
      : registerDto;

    const user = await this.authService.register(payload);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Utilisateur créé avec succès',
      data: user,
    };
  }

  // ✅ ROUTE EXISTANTE - Login
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Se connecter et obtenir un token JWT' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connexion réussie, token retourné',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Email ou mot de passe incorrect',
  })
  @ApiBody({ type: LoginDto })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    const result = await this.authService.login(user);

    return {
      statusCode: HttpStatus.OK,
      message: 'Connexion réussie',
      data: result,
    };
  }

  // ✅ ROUTE EXISTANTE - Social Login
  @Public()
  @Post('social/login')
  @ApiOperation({ summary: 'Connexion avec Google ou Apple' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connexion sociale réussie',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token social invalide',
  })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async socialLogin(@Body() socialLoginDto: SocialLoginDto) {
    const result = await this.socialAuthService.socialLogin(socialLoginDto);

    return {
      statusCode: HttpStatus.OK,
      message: 'Connexion sociale réussie',
      data: result,
    };
  }

  // ✅ NOUVELLE ROUTE - Success page
  @Public()
  @Get('success')
  @ApiOperation({ summary: 'Success page for OAuth' })
  async oauthSuccess(
    @Query('token') token: string,
    @Query('provider') provider: string,
    @Res() res: Response
  ) {
    try {
      // Rediriger vers l'app mobile
      const appDeepLink = `platenet://auth/success?token=${token}&provider=${provider}`;
      return res.redirect(appDeepLink);
      
    } catch (error) {
      const errorDeepLink = `platenet://auth/error?message=oauth_failed`;
      return res.redirect(errorDeepLink);
    }
  }

  // ✅ NOUVELLE ROUTE - Simple Google pour mobile
  @Public()
  @Post('google/simple')
  @ApiOperation({ summary: 'Simple Google Sign-In for Mobile' })
  async googleSimple(@Body() body: { email?: string; name?: string }) {
    const email = body.email || `user_${Date.now()}@gmail.com`;
    const name = body.name || 'Google User';

    const result = await this.socialAuthService.socialLogin({
      provider: SocialProvider.GOOGLE,
      token: 'simple_google_token_' + Date.now(),
      email: email,
      name: name,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Google sign-in successful',
      data: result
    };
  }
}