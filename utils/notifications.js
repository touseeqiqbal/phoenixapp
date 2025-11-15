const util = require("util");

function replaceTokens(template, context) {
  if (!template) return "";
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    return context[key] ?? "";
  });
}

function dispatchSubmissionNotification({ form, submission, workspace }) {
  const settings = form?.settings?.notifications;
  if (!settings?.enabled) return;
  const recipients = Array.isArray(settings.recipients) ? settings.recipients.filter(Boolean) : [];
  if (!recipients.length) return;

  const context = {
    formName: form.name ?? "Form",
    submissionId: submission?.id ?? "",
    workspaceName: workspace?.name ?? "",
    submittedAt: submission?.submittedAt ?? new Date().toISOString()
  };
  const subjectTemplate = settings.subject || "New submission received";
  const messageTemplate = settings.message || "A new submission was received for {{formName}}.";
  const subject = replaceTokens(subjectTemplate, context);
  const message = replaceTokens(messageTemplate, context);
  const includeSubmission = settings.includeSubmission !== false;
  const submissionDetails = includeSubmission
    ? util.inspect(submission?.data ?? {}, { depth: 2, colors: false })
    : null;

  const banner = "-".repeat(60);
  console.log(banner);
  console.log("[Notification] Submission alert");
  console.log("Recipients:", recipients.join(", "));
  console.log("Subject:", subject);
  console.log("Message:", message);
  if (submissionDetails) {
    console.log("Submission Data:", submissionDetails);
  }
  console.log(banner);
}

module.exports = {
  dispatchSubmissionNotification
};
