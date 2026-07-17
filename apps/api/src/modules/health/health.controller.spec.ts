import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: { check: jest.fn(async (fns: Array<() => Promise<unknown>>) => {
            const results = await Promise.all(fns.map((f) => f()));
            return { status: 'ok', details: results };
          }) },
        },
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
        },
      ],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('liveness includes build version metadata from env', () => {
    process.env.APP_VERSION = 'f39c712test';
    process.env.GIT_SHA = 'f39c712testsha';
    process.env.BUILD_DATE = '2026-07-16T00:00:00Z';
    const result = controller.liveness();
    expect(result.status).toBe('ok');
    expect(result.version).toBe('f39c712test');
    expect(result.gitSha).toBe('f39c712testsha');
    expect(result.buildDate).toBe('2026-07-16T00:00:00Z');
    expect(result.timestamp).toBeTruthy();
  });
});
