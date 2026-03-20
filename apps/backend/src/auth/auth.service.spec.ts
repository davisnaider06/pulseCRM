import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const jwtServiceMock = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        'auth.accessSecret': 'access-secret',
        'auth.refreshSecret': 'refresh-secret',
        'auth.accessExpiresIn': '15m',
        'auth.refreshExpiresIn': '7d',
      };

      return values[key];
    }),
  };

  let authService: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  it('deve autenticar um usuario ativo com senha valida', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const passwordHash = (await bcrypt.hash('ChangeMe123!', 10)) as string;

    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@crm.local',
        passwordHash,
        status: 'ACTIVE',
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        name: 'Administrador CRM',
        email: 'admin@crm.local',
        phone: null,
        status: 'ACTIVE',
        jobTitle: null,
        isSuperAdmin: true,
        lastLoginAt: null,
        createdAt: new Date(),
        team: { id: 'team-1', name: 'Equipe Comercial' },
        roles: [
          {
            role: {
              name: 'admin',
              permissions: [
                { permission: { resource: 'users', action: 'MANAGE' } },
              ],
            },
          },
        ],
      });

    jwtServiceMock.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await authService.login({
      email: 'admin@crm.local',
      password: 'ChangeMe123!',
    });

    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.refreshToken).toBe('refresh-token');
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
  });

  it('deve rejeitar login com senha invalida', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@crm.local',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      passwordHash: (await bcrypt.hash('senha-correta', 10)) as string,
      status: 'ACTIVE',
    });

    await expect(
      authService.login({
        email: 'admin@crm.local',
        password: 'senha-incorreta',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deve rejeitar refresh token invalido', async () => {
    jwtServiceMock.verifyAsync.mockRejectedValue(new Error('invalid'));

    await expect(
      authService.refreshTokens('token-invalido'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
