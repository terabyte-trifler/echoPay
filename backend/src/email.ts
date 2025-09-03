import sg from "@sendgrid/mail";

export function setupSendgrid(apiKey?: string) {
  if (apiKey) sg.setApiKey(apiKey);
}

export async function sendEmail(opts: { to: string; from: string; subject: string; html: string }) {
  try {
    await sg.send(opts);
  } catch (err) {
    console.error("SendGrid error:", err);
  }
}
