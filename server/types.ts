export type Bindings = {
  DB: D1Database;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  SITE_ORIGIN?: string;
  ENVIRONMENT?: string;
  DEV_BYPASS_ACCESS?: string;
  DEV_FRONTEND_ORIGIN?: string;
};
export type AppEnv = { Bindings: Bindings; Variables: { email: string } };
