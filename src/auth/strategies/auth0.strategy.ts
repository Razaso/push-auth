import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
  constructor() {
    super({
      domain: process.env.AUTH0_DOMAIN,
      clientID: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/callback`,
      scope: 'openid email profile'
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return profile;
  }
}