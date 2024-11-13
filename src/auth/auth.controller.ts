import { Controller, Get, UseGuards, Req, Res, Logger, Query, Post, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { v4 as uuidv4 } from 'uuid';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService
  ) {}

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

    const authToken = await this.tokenService.createToken('pending');
    
    const auth0Url = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `redirect_uri=${process.env.BACKEND_URL}/auth/callback&` +
      `scope=openid profile email&` +
      `state=${authToken.id}&` +
      `connection=email&` +
      `login_hint=${encodeURIComponent(email)}`;

    res.redirect(auth0Url);
  }

  @Get('authorize-social')
  async authorizeSocial(
    @Query('provider') provider: 'github' | 'google' | 'discord' | 'twitter',
    @Res() res: Response
  ) {

    const authToken = await this.tokenService.createToken('pending')

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
      `state=${authToken.id}&` +
      `connection=${connectionMap[provider]}`;

    res.redirect(auth0Url);
  }

  @Get('authorize-phone')
  async authorizePhone(
    @Query('phone') phone: string,
    @Res() res: Response
  ) {
    const authToken = await this.tokenService.createToken('pending')

    const auth0Url = `https://${process.env.AUTH0_DOMAIN}/authorize?` +
      `response_type=code&` +
      `client_id=${process.env.AUTH0_CLIENT_ID}&` +
      `redirect_uri=${process.env.BACKEND_URL}/auth/callback&` +
      `scope=openid profile email&` +
      `state=${authToken.id}&` +
      `connection=sms&` +
      `login_hint=${encodeURIComponent(phone)}`;

    res.redirect(auth0Url);
  }
  
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {

      const storedToken = await this.tokenService.retrieveToken(state);
      if (!storedToken || storedToken.status !== 'pending') {
        throw new UnauthorizedException('Invalid state parameter');
      }

      // Exchange the code for tokens
      const tokens = await this.authService.exchangeCodeForTokens(code);
      
      // Get user profile using the access token
      const profile = await this.authService.getUserProfile(tokens.access_token);
      
      // Create or update user in our database
      const user = await this.authService.findOrCreateUser(profile);
      
      // Generate our own JWT
      const jwt = await this.authService.generateJWT(user, tokens);


      await this.tokenService.updateToken(state, jwt);
      res.redirect(`${process.env.FRONTEND_URL}/push-keys/#/profile?state=${state}`);
    } catch (error) {
      this.logger.error('Auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }

  @Get('jwt')
  async getJwt(@Query('state') state: string) {
    console.log('getJwt state', state);

    if (!state) {
      throw new BadRequestException('Invalid state parameter');
    }

    const storedToken = await this.tokenService.retrieveToken(state);

    if (!storedToken || !storedToken.token) {
      throw new UnauthorizedException('Unauthorized or expired state parameter');
    }

    // Mark the token as used and return it
    const updatedToken = await this.tokenService.markAsUsed(state);
    return { token: updatedToken.token };
  }

  @Post('refresh')
  async refreshToken(@Headers('authorization') auth: string) {
    if (!auth) {
      throw new UnauthorizedException('No token provided');
    }

    const token = auth.split(' ')[1];
    const newToken = await this.authService.refreshToken(token);
    
    if (!newToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return { token: newToken };
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