import { Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import { Db } from '../../../resources';
@Injectable()
export class AuthService {
  constructor(private db: Db) {}
  async issue(userId: string, organizationId: string) {
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret || secret.length < 32)
      throw new Error('AUTH_JWT_SECRET must contain at least 32 characters');
    const session = await this.db.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 8 * 3600000) },
    });
    return new SignJWT({ organizationId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setJti(session.id)
      .setIssuer('colmeia')
      .setAudience('colmeia-api')
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(secret));
  }
}
