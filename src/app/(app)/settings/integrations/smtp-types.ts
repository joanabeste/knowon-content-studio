export type SmtpConfig = {
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  from_name: string | null;
  from_email: string | null;
  secure: boolean;
};

export const EMPTY_SMTP: SmtpConfig = {
  host: null,
  port: null,
  username: null,
  password: null,
  from_name: null,
  from_email: null,
  secure: true,
};
