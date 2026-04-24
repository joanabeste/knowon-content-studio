import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSmtpTransport } from "./smtp";

type Result = { ok: true } | { error: string };

export async function sendReviewInviteEmail(params: {
  projectId: string;
  projectTopic: string;
  reviewerUserId: string;
  requesterName: string | null;
}): Promise<Result> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.getUserById(
      params.reviewerUserId,
    );
    if (error || !data.user?.email) {
      return { error: error?.message ?? "Reviewer hat keine E-Mail-Adresse." };
    }
    const reviewerEmail = data.user.email;
    const reviewerName =
      (data.user.user_metadata?.full_name as string | undefined) ?? null;

    const { transport, from } = await getSmtpTransport();

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const link = `${appUrl}/projects/${params.projectId}`;
    const requester = params.requesterName?.trim() || "Ein Teammitglied";
    const greeting = reviewerName ? `Hallo ${reviewerName.split(" ")[0]},` : "Hallo,";

    const subject = `Neues Projekt zur Freigabe: ${params.projectTopic}`;

    const text = [
      greeting,
      "",
      `${requester} hat dich als Reviewer für das Projekt „${params.projectTopic}" eingeteilt.`,
      "",
      `Direktlink: ${link}`,
      "",
      "— KnowOn Marketing",
    ].join("\n");

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2937;">
        <p>${escapeHtml(greeting)}</p>
        <p>
          ${escapeHtml(requester)} hat dich als Reviewer für das Projekt
          <strong>${escapeHtml(params.projectTopic)}</strong> eingeteilt.
        </p>
        <p>
          <a href="${link}"
             style="display: inline-block; background: #0d9488; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 500;">
            Projekt öffnen
          </a>
        </p>
        <p style="color: #6b7280; font-size: 12px;">Oder kopiere den Link: <br/>${link}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">KnowOn Marketing</p>
      </div>
    `;

    await transport.sendMail({
      from,
      to: reviewerEmail,
      subject,
      text,
      html,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sendReviewInviteEmail] failed", message);
    return { error: message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
