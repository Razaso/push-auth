// src/users/users.service.ts

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthUserProfile } from '../auth/interfaces/oauth-user-profile.interface';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds a user by their unique ID.
   * @param id - The unique identifier of the user.
   * @returns The user entity.
   * @throws NotFoundException if the user is not found.
   */
  async findOneById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Retrieves all users with optional pagination and sorting.
   * @param page - The page number (default: 1).
   * @param limit - The number of users per page (default: 10).
   * @param sortBy - The field to sort by (default: 'createdAt').
   * @param sortOrder - The order of sorting ('asc' or 'desc', default: 'desc').
   * @returns An object containing users and total count.
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    sortBy: keyof User = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total };
  }

  /**
   * Finds a user by their GitHub ID or creates one.
   * @param profile - OAuth user profile data.
   * @returns The user entity.
   */
  async findOrCreate(profile: OAuthUserProfile): Promise<User> {
    this.logger.log(`Attempting to find or create user with GitHub ID: ${profile.id}`);



    console.log(" ********** profile: ", JSON.stringify(profile));
    
    try {
      // Attempt to find the user by GitHub ID
      let user = await this.prisma.user.findUnique({
        where: { githubId: profile.id },
      });

      if (!user) {
        this.logger.log(`No user found with GitHub ID: ${profile.id}. Creating a new user.`);

        // If not found, create a new user
        user = await this.prisma.user.create({
          data: {
            githubId: profile.id,
            username: profile.username,
            email: profile.email,
            avatarUrl: profile.avatar_url,
            // Add other relevant fields
          },
        });
        this.logger.log(`Created new user with GitHub ID: ${profile.id}`);
      } else {
        this.logger.log(`Found existing user with GitHub ID: ${profile.id}`);
      }

      return user;
    } catch (error) {
      if (error.code === 'P2002') { // Unique constraint failed
        this.logger.error('Unique constraint failed while creating user:', error);
        throw new ConflictException('User already exists');
      }
      this.logger.error('Error creating user:', error);
      throw error; // Re-throw other errors
    }
  }

  /**
   * Finds a user by their GitHub ID.
   * @param githubId - GitHub unique identifier.
   * @returns The user entity or null if not found.
   */
  async findOneByGitHubId(githubId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { githubId },
    });
  }

  /**
   * Creates a user from OAuth profile data.
   * @param profile - OAuth user profile data.
   * @returns The user entity.
   * @throws ConflictException if the user already exists.
   */
  async createFromOAuthProfile(profile: OAuthUserProfile): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          githubId: profile.id,
          username: profile.username,
          email: profile.email,
          avatarUrl: profile.avatar_url,
          // Add other relevant fields
        },
      });
    } catch (error) {
      if (error.code === 'P2002') { // Unique constraint failed
        throw new ConflictException('User already exists');
      }
      throw error; // Re-throw other errors
    }
  }

  // ... Additional methods like updateUser, deleteUser, etc., can be added here
}
