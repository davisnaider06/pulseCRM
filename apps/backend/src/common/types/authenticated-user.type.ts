export type AuthenticatedUser = {
  sub: string;
  email: string;
  name: string;
  teamId?: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
};
