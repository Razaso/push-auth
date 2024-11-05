export interface Auth0Profile {
    sub: string;
    email: string;
    nickname?: string;
    picture?: string;
    email_verified?: boolean;
    avatar_url?: string | null;
    name?: string;
  }