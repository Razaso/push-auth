// src/users/users.controller.ts

import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { User } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * @route   GET /users/me
   * @desc    Retrieve the currently authenticated user's profile
   * @access  Protected (Requires JWT)
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@Req() req: RequestWithUser): Promise<Partial<User>> {
    const user: User = req.user;
    const { email, avatarUrl, ...result } = user; // Exclude sensitive fields if necessary
    return result;
  }

  /**
   * @route   GET /users/:id
   * @desc    Retrieve a user's profile by their ID
   * @access  Public or Protected based on requirements
   */
  @Get(':id')
  async getUserById(
    @Param('id') id: string,
  ): Promise<Partial<User>> {
    const user = await this.usersService.findOneById(id);
    const { email, avatarUrl, ...result } = user; // Exclude sensitive fields if necessary
    return result;
  }

  /**
   * @route   GET /users
   * @desc    Retrieve a list of all users with pagination and sorting
   * @access  Protected (Requires JWT)
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllUsers(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
    @Query('sortBy') sortBy: keyof User = 'createdAt',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const { users, total } = await this.usersService.findAll(
      page,
      limit,
      sortBy,
      sortOrder,
    );
    const safeUsers = users.map(({ email, avatarUrl, ...rest }) => rest);
    return { users: safeUsers, total };
  }

  // ... Additional endpoints like Create, Update, Delete can be added here
}
