// src/users/dto/user.dto.ts

import { IsNumber, IsString, IsEmail, IsOptional } from 'class-validator';

export class UserDto {
  @IsNumber()
  readonly id: number;

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
