import { Inject, Controller, Get, UseGuards, Req, Res, Query, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Controller('auth')
export class AuthController {

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService
  ) {}

  @Get('login')
  @UseGuards(AuthGuard('auth0'))
  async login() {
    this.logger.debug('Initiating Auth0 login');
    // Auth0 will handle the login
  }

  @Get('authorize-email')
  async authorizeEmail(
    @Query('email') email: string,
    @Res() res: Response
  ) {
    this.logger.debug('Processing email authorization request', { email });

    try {
      const authToken = await this.tokenService.createToken('pending');
      this.logger.debug('Created pending auth token', { tokenId: authToken.id });
    
      const auth0Url = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
        `response_type=code&` +
        `client_id=${process.env.AUTH0_CLIENT_ID}&` +
        `redirect_uri=${process.env.BACKEND_URL}/auth/callback&` +
        `scope=openid profile email&` +
        `state=${authToken.id}&` +
        `connection=email&` +
        `login_hint=${encodeURIComponent(email)}`;

      this.logger.info('Redirecting to Auth0 email authorization');
      res.redirect(auth0Url);
    } catch (error) {
      this.logger.error('Email authorization failed', { error: error.message, email });
      throw error;
    }
  }

  @Get('authorize-social')
  async authorizeSocial(
    @Query('provider') provider: 'github' | 'google' | 'discord' | 'twitter',
    @Res() res: Response
  ) {
    this.logger.debug('Processing social authorization request', { provider });

    try {
      const authToken = await this.tokenService.createToken('pending');
      this.logger.debug('Created pending auth token', { tokenId: authToken.id });

      const connectionMap = {
        google: 'google-oauth2',
        github: 'github',
        discord: 'discord',
        twitter: 'twitter'
      };

      const auth0Url = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
        `response_type=code&` +
        `client_id=${process.env.AUTH0_CLIENT_ID}&` +
        `redirect_uri=${process.env.BACKEND_URL}/auth/callback&` +
        `scope=openid profile email&` +
        `state=${authToken.id}&` +
        `connection=${connectionMap[provider]}`;

      this.logger.info('Redirecting to Auth0 social authorization', { provider });
      res.redirect(auth0Url);
    } catch (error) {
      this.logger.error('Social authorization failed', { error: error.message, provider });
      throw error;
    }
  }
  
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    this.logger.info('Processing Auth0 callback', { state });

    try {
      const storedToken = await this.tokenService.retrieveToken(state);
      if (!storedToken || storedToken.status !== 'pending') {
        this.logger.warn('Invalid state parameter in callback', { state });
        throw new UnauthorizedException('Invalid state parameter');
      }

      this.logger.debug('Exchanging code for tokens');
      const tokens = await this.authService.exchangeCodeForTokens(code);
      
      this.logger.debug('Fetching user profile');
      const profile = await this.authService.getUserProfile(tokens.access_token);
      
      this.logger.debug('Creating or updating user', { auth0Id: profile.sub });
      const user = await this.authService.findOrCreateUser(profile);
      
      this.logger.debug('Generating JWT', { userId: user.id });
      const jwt = await this.authService.generateJWT(user, tokens);

      await this.tokenService.updateToken(state, jwt);
      this.logger.info('Authentication successful, redirecting to profile', { userId: user.id });
      res.redirect(`${process.env.FRONTEND_URL}/push-keys/#/profile?state=${state}`);
    } catch (error) {
      this.logger.error('Auth callback error:', { 
        error: error.message, 
        stack: error.stack,
        state 
      });
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }

  @Get('jwt')
  async getJwt(@Query('state') state: string) {
    this.logger.info('Processing GetJWT request', { state });

    if (!state) {
      this.logger.warn('Missing state parameter in JWT request');
      throw new BadRequestException('Invalid state parameter');
    }

    const storedToken = await this.tokenService.retrieveToken(state);

    if (!storedToken || !storedToken.token) {
      this.logger.warn('Invalid or expired token in JWT request', { state });
      throw new UnauthorizedException('Unauthorized or expired state parameter');
    }

    this.logger.debug('Marking token as used', { state });
    await this.tokenService.markAsUsed(state);
    return { token: storedToken.token };
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  async getUser(@Req() req: any) {
    this.logger.debug('Fetching user information', { userId: req.user?.sub });
    return req.user;
  }

  @Get('logout')
  async logout(@Res() res: Response) {
    this.logger.debug('Processing logout request');
    const returnTo = encodeURIComponent(process.env.FRONTEND_URL);
    
    const logoutUrl = `https://${process.env.AUTH0_DOMAIN}/v2/logout?` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `returnTo=${returnTo}`;
      
    this.logger.debug('Redirecting to Auth0 logout');
    res.redirect(logoutUrl);
  }
}