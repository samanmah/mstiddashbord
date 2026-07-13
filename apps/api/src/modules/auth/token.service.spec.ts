import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@ppm/contracts';
import { type AppConfig } from '../../config/configuration';
import { TokenService } from './token.service';

const appConfig = {
  jwt: {
    accessSecret: 'test-access-secret-value-for-unit-tests-only-1234',
    refreshSecret: 'test-refresh-secret-value-for-unit-tests-only-1234',
    accessTtl: 900,
    refreshTtl: 1209600,
  },
} as AppConfig;

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    const configService = {
      get: () => appConfig,
    } as unknown as ConfigService;
    service = new TokenService(new JwtService(), configService);
  });

  it('signs and the access token carries the payload', async () => {
    const token = await service.signAccessToken({
      sub: 'user-1',
      username: 'editor',
      role: UserRole.PROJECT_EDITOR,
    });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('signs and verifies a refresh token round-trip', async () => {
    const jti = service.newTokenId();
    const token = await service.signRefreshToken({ sub: 'user-1', jti });
    const payload = await service.verifyRefreshToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.jti).toBe(jti);
  });

  it('rejects a refresh token signed with the wrong secret', async () => {
    const foreign = new JwtService();
    const token = await foreign.signAsync(
      { sub: 'x', jti: 'y' },
      { secret: 'a-different-secret-that-should-not-validate-000', expiresIn: 60 },
    );
    await expect(service.verifyRefreshToken(token)).rejects.toBeDefined();
  });

  it('hashes refresh tokens deterministically and never stores the raw value', () => {
    const raw = 'raw-refresh-token';
    const hash1 = service.hashRefreshToken(raw);
    const hash2 = service.hashRefreshToken(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(raw);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates unique token ids and csrf tokens', () => {
    expect(service.newTokenId()).not.toBe(service.newTokenId());
    expect(service.generateCsrfToken()).not.toBe(service.generateCsrfToken());
  });
});
