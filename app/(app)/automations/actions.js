"use server";

import { runDashboardAction, toFormError } from "@/lib/actions/dashboard";

export async function sendAutomationTest({ newsletterId, subject, previewText, fromName, fromEmail, replyTo, html } = {}) {
	const { output, failure } = await runDashboardAction("send_automation_test_email", {
		id: newsletterId, subject, previewText, fromName, fromEmail, replyTo, html,
	});
	return failure ? toFormError(failure) : { sent: true, to: output.sentTo };
}
