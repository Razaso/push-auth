// src/auth/strategies/github.strategy.ts

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile as GitHubProfile } from 'passport-github2';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL'),
      scope: ["user:email"], // Ensure you have the necessary scopes
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GitHubProfile,
    done: Function,
  ): Promise<any> {
    try {

      const { id, username, emails, photos } = profile;

      // Extract email from the emails array
      const email = emails && emails.length > 0 ? emails[0].value : null;

      // Extract avatar URL
      const avatar_url = photos && photos.length > 0 ? photos[0].value : null;

      const oauthUserProfile: OAuthUserProfile = {
        id: id.toString(), // Ensure it's a string
        username,
        email,
        avatar_url,
      };

      // Pass the profile to the next step
      done(null, oauthUserProfile);
    } catch (error) {
      this.logger.error('Error in GitHubStrategy validate method:', error);
      done(error, null);
    }
  }
}
