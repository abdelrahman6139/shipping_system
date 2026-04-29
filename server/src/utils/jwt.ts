import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET  || 'access_secret_key_change_in_production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_key_change_in_production';

export interface TokenPayload {
  userId: string;
  email:  string;
  role:   string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
}

export function generateTokenId(): string {
  return uuidv4();
}
