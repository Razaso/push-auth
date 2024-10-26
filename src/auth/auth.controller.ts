// src/auth/auth.controller.ts

import { Controller, Get, Req, Res, UseGuards, Logger, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { v4 as uuidv4 } from 'uuid'; // For UUID generation if needed
import { OAuthUserProfile } from '../auth/interfaces/oauth-user-profile.interface';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private tempTokenStore: Map<string, string> = new Map(); // In-memory store for simplicity

  constructor(private authService: AuthService) {}

  /**
   * Initiates GitHub OAuth login.
   * @route GET /auth/github
   */
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth(@Req() req: Request, @Res() res: Response) {
    // Initiated by GitHubStrategy, no additional handling needed here
  }

  /**
   * Handles the OAuth callback from GitHub
   * @route GET /auth/github/callback
   */
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      // The GitHubStrategy's validate method returns an OAuthUserProfile
      const profile = req.user as OAuthUserProfile;

      this.logger.log(`Received profile from GitHub: ${JSON.stringify(profile)}`);

      // Validate OAuth login and get user and token
      const { user, token } = await this.authService.validateOAuthLogin(profile);

      this.logger.log(`Generated JWT token for user ID: ${user.id}`);

      // Generate a unique state identifier
      const state = uuidv4();

      // Store the JWT temporarily associated with the state
      this.tempTokenStore.set(state, token);

      // Redirect to frontend with the state as a query parameter
      res.redirect(`${process.env.FRONTEND_URL}/push-keys/#/profile?state=${state}`);
    } catch (error) {
      this.logger.error('Error during OAuth callback:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }
  }

  /**
   * Retrieves the JWT token associated with a given state
   * @route GET /auth/jwt
   */
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

    // Optionally, remove the token from the temporary store to prevent reuse
    this.tempTokenStore.delete(state);

    return res.json({ token });
  }

  /**
   * Endpoint to get the authenticated user's profile
   * @route GET /auth/user
   */
  @Get('user')
  @UseGuards(AuthGuard('jwt'))
  async getUser(@Req() req: any, @Res() res: Response) {
    res.json(req.user);
  }

  /**
   * Logout endpoint
   * @route GET /auth/logout
   */
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    // If using cookies, clear them here
    // Since we're using in-memory store, no action needed
    res.redirect(`${process.env.FRONTEND_URL}`);
  }
}
