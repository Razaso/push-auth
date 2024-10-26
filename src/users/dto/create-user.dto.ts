// src/users/dto/create-user.dto.ts

import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsString()
  readonly githubId: string;

  @IsString()
  readonly username: string;

  @IsEmail()
  @IsOptional()
  readonly email?: string;

  @IsString()
  @IsOptional()
  readonly avatarUrl?: string;

  // Add other fields as necessary
}
