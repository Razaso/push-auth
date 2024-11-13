import { Controller, Get, UseGuards, Req, Res, Logger, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { v4 as uuidv4 } from 'uuid';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private tempTokenStore: Map<string, string> = new Map();

  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @UseGuards(AuthGuard('auth0'))
  async login() {
    // Auth0 will handle the login
  }

  @Get('authorize-email')
  async authorizeEmail(
    @Query('email') email: string,
    @Res() res: Response
  ) {
    const state = uuidv4();
    this.tempTokenStore.set(state, 'pending');
    
    const auth0Url = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `redirect_uri=${process.env.BACKEND_URL}/auth/callback&` +
      `scope=openid profile email&` +
      `state=${state}&` +
      `connection=email&` +
      `login_hint=${encodeURIComponent(email)}`;

    res.redirect(auth0Url);
  }

  @Get('authorize-social')
  async authorizeSocial(
    @Query('provider') provider: 'github' | 'google' | 'discord' | 'twitter',
    @Res() res: Response
  ) {
    const state = uuidv4();
    this.tempTokenStore.set(state, 'pending');
    
    // Map provider to correct connection name
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
      `state=${state}&` +
      `connection=${connectionMap[provider]}`;

    res.redirect(auth0Url);
  }

  @Get('authorize-phone')
  async authorizePhone(
    @Query('phone') phone: string,
    @Res() res: Response
  ) {
    const state = uuidv4();
    this.tempTokenStore.set(state, 'pending');
    
    const auth0Url = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `redirect_uri=${process.env.BACKEND_URL}/auth/callback&` +
      `scope=openid profile email&` +
      `state=${state}&` +
      `connection=sms&` +
      `login_hint=${encodeURIComponent(phone)}`;

    res.redirect(auth0Url);
  }
  
  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    try {

      console.log('code', code)
      // Exchange the code for tokens
      const tokens = await this.authService.exchangeCodeForTokens(code);
      
      console.log('tokens', tokens)

      // Get user profile using the access token
      const profile = await this.authService.getUserProfile(tokens.access_token);
      
      console.log('profile', profile)

      // Create or update user in our database
      const user = await this.authService.findOrCreateUser(profile);
      
      console.log('user', user)

      // Generate our own JWT
      const jwt = await this.authService.generateJWT(user);

      // Generate new state for frontend token retrieval
      const newState = uuidv4();
      this.tempTokenStore.set(newState, jwt);

      // Redirect back to frontend with state
      res.redirect(`${process.env.FRONTEND_URL}/push-keys/#/profile?state=${newState}`);
    } catch (error) {
      this.logger.error('Auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }

  @Get('jwt')
  async getJwt(@Req() req: Request, @Res() res: Response) {
    const { state } = req.query;

    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    const token = this.tempTokenStore.get(state);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized or expired state parameter' });
    }

    // Remove the token from the temporary store to prevent reuse
    this.tempTokenStore.delete(state);

    return res.json({ token });
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  async getUser(@Req() req: any) {
    return req.user;
  }

  @Get('logout')
  async logout(@Res() res: Response) {
    const returnTo = encodeURIComponent(process.env.FRONTEND_URL);
    res.redirect(
      `https://${process.env.AUTH0_DOMAIN}/v2/logout?` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `returnTo=${returnTo}`
    );
  }
}