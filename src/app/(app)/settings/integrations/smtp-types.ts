/**
 * SMTP config types.
 *
 * The UI operates on two views of the same record:
 *
 * - `SmtpConfig` is what the Server Component reads and seeds the
 *   form with. It deliberately does NOT carry the plaintext
 *   password — only a `password_set` flag so the form can show a
 *   "••••• konfiguriert" placeholder.
 *
 * - `SmtpConfigInput` is what the form submits. It DOES include a
 *   (possibly empty) `password` string. Empty = leave the stored
 *   password unchanged. Non-empty = re-encrypt and overwrite.
 */
export type SmtpConfig = {
  host: string | null;
  port: number | null;
  username: string | null;
  password_set: boolean;
  from_name: string | null;
  from_email: string | null;
  secure: boolean;
};

export type SmtpConfigInput = Omit<SmtpConfig, "password_set"> & {
  password: string;
};

export const EMPTY_SMTP: SmtpConfig = {
  host: null,
  port: null,
  username: null,
  password_set: false,
  from_name: null,
  from_email: null,
  secure: true,
};
