import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
interface TokenPayload {
  sub: string;
  email: string;
  username: string;
  auth0Token: string;
  auth0Expiry: number;
}

@Injectable()
export class AuthService {  
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Add this utility function to the AuthService class
  private async callAuth0Api<T>(
    method: 'get' | 'post',
    endpoint: string,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    try {
      const url = `https://${process.env.AUTH0_DOMAIN}${endpoint}`;
      this.logger.info(`Calling Auth0 API: ${method.toUpperCase()} ${endpoint}`);
      
      // Merge the timeout setting with existing config
      const configWithTimeout = {
        ...config,
        timeout: 15000, // 15 seconds
      };

      const response = method === 'get' 
        ? await axios.get<T>(url, configWithTimeout)
        : await axios.post<T>(url, config.data, configWithTimeout);
      return response.data;
    } catch (error) {
      // Log rate limits for monitoring
      const axiosError = error as AxiosError;
      if (axiosError?.response?.status === 429) {
        this.logger.warn('Auth0 Rate Limit reached:', {
          'x-ratelimit-limit': axiosError.response.headers['x-ratelimit-limit'],
          'x-ratelimit-remaining': axiosError.response.headers['x-ratelimit-remaining'],
          'x-ratelimit-reset': axiosError.response.headers['x-ratelimit-reset']
        });
      }
      this.logger.error(`Auth0 API call failed: ${axiosError.message}`, axiosError.stack);
      throw error;
    }
  }

  async exchangeCodeForTokens(code: string) {
    try {
      this.logger.debug('Exchanging authorization code for tokens');
      const tokens = await this.callAuth0Api<any>(
        'post',
        '/oauth/token',
        {
          data: {
            grant_type: 'authorization_code',
            client_id: process.env.AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH0_CLIENT_SECRET,
            code,
            redirect_uri: `${process.env.BACKEND_URL}/auth/callback`
          }
        }
      );
      this.logger.info('Successfully exchanged code for tokens');
      return tokens;
    } catch (error) {
      this.logger.error('Failed to exchange code for tokens:', error);
      throw new HttpException('Failed to exchange code for tokens', HttpStatus.BAD_REQUEST);
    }
  }

  async getUserProfile(accessToken: string) {
    try {
      this.logger.debug('Fetching user profile from Auth0');
      const profile = await this.callAuth0Api<any>(
        'get',
        '/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      this.logger.info('Successfully retrieved user profile');
      return profile;
    } catch (error) {
      this.logger.error('Failed to get user profile:', error);
      throw new HttpException('Failed to get user profile', HttpStatus.BAD_REQUEST);
    }
  }

  async findOrCreateUser(auth0User: any) {
    const [provider, providerId] = auth0User.sub.split('|');
    const username = auth0User.nickname || `User${providerId.slice(-4)}`;
    
    this.logger.debug(`Processing user with provider: ${provider}`);
    
    try {
      if (provider === 'sms') {
        this.logger.debug('Processing SMS-based authentication');
        return await this.prisma.user.upsert({
          where: { auth0Id: auth0User.sub },
          update: {
            phone: auth0User.phone_number,
            username,
            avatarUrl: auth0User.picture,
            updatedAt: new Date(),
            provider,
          },
          create: {
            phone: auth0User.phone_number,
            email: null,
            username,
            auth0Id: auth0User.sub,
            avatarUrl: auth0User.picture,
            provider,
          },
        });
      } else {
        this.logger.debug('Processing Social/Email authentication');
        const email = auth0User.email || `${providerId}@${provider}.placeholder.com`;
        return await this.prisma.user.upsert({
          where: { auth0Id: auth0User.sub },
          update: {
            email,
            username,
            avatarUrl: auth0User.picture,
            updatedAt: new Date(),
            provider,
          },
          create: {
            email,
            phone: null,
            username,
            auth0Id: auth0User.sub,
            avatarUrl: auth0User.picture,
            provider,
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to find or create user:', error);
      throw error;
    }
  }

  async generateJWT(user: any, tokens: any) {
    this.logger.debug('Generating JWT token for user:', { userId: user.id });
    const oneDayInSeconds = 86400;
    const auth0ExpiresIn = tokens.expires_in || oneDayInSeconds;

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      auth0Token: tokens.access_token,
      auth0Expiry: Math.floor(Date.now() / 1000) + auth0ExpiresIn
    };
    
    return this.jwtService.sign(payload, {
      expiresIn: auth0ExpiresIn
    });
  }

  async validateUser(payload: any) {
    this.logger.debug('Validating user:', { userId: payload.sub });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });
    
    if (!user) {
      this.logger.warn('User not found during validation:', { userId: payload.sub });
    }
    
    return user;
  }
}