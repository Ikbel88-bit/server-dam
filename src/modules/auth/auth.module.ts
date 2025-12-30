import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleOAuthController } from './google-oauth.controller';
import { AppleOAuthController } from './apple-oauth.controller'; // ✅ Ajouter
import { SocialAuthService } from './social-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { AppleStrategy } from './apple.strategy'; // ✅ Ajouter
import { User, UserSchema } from '../users/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        return {
          secret,
          signOptions: { expiresIn: '24h' },
        };
      },
    }),
  ],
  controllers: [
    AuthController, 
    GoogleOAuthController,
    AppleOAuthController // ✅ Ajouter
  ],
  providers: [
    AuthService, 
    SocialAuthService,
    JwtStrategy,
    // ✅ Stratégies OAuth conditionnelles - seulement si configurées
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [GoogleStrategy] : []),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID ? [AppleStrategy] : []),
  ],
  exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}