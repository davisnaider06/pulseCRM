import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';

const userProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  jobTitle: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  team: true,
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type UserProfileRecord = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase() },
      select: {
        ...userProfileSelect,
        passwordHash: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const isValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id);
  }

  async refreshTokens(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user?.refreshTokenHash) {
      throw new ForbiddenException('Sessao invalida.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const refreshMatches = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!refreshMatches) {
      throw new ForbiddenException('Sessao invalida.');
    }

    return this.issueTokens(user.id);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { message: 'Logout realizado com sucesso.' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Usuario nao encontrado.');
    }

    return this.serializeUser(user);
  }

  async validateAuthenticatedUser(userId: string) {
    const profile = await this.getProfile(userId);
    return {
      sub: profile.id,
      email: profile.email,
      name: profile.name,
      teamId: profile.team?.id ?? null,
      roles: profile.roles,
      permissions: profile.permissions,
      isSuperAdmin: profile.isSuperAdmin,
    };
  }

  private async issueTokens(userId: string) {
    const user = await this.getProfile(userId);

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      teamId: user.team?.id ?? null,
      roles: user.roles,
      permissions: user.permissions,
      isSuperAdmin: user.isSuperAdmin,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.accessSecret'),
      expiresIn: this.configService.getOrThrow<string>(
        'auth.accessExpiresIn',
      ) as never,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
        expiresIn: this.configService.getOrThrow<string>(
          'auth.refreshExpiresIn',
        ) as never,
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        refreshTokenHash: await bcrypt.hash(refreshToken, 10),
      },
    });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<{ sub: string; type: string }>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
        },
      );
    } catch {
      throw new ForbiddenException('Refresh token invalido.');
    }
  }

  private serializeUser(user: UserProfileRecord) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      jobTitle: user.jobTitle,
      isSuperAdmin: user.isSuperAdmin,
      team: user.team
        ? {
            id: user.team.id,
            name: user.team.name,
          }
        : null,
      roles: user.roles.map(({ role }) => role.name),
      permissions: Array.from(
        new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(
              ({ permission }) => `${permission.resource}:${permission.action}`,
            ),
          ),
        ),
      ),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
