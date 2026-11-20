"use server";

import { revalidatePath } from "next/cache";

import { runDashboardAction, toFormError } from "@/lib/actions/dashboard";

export async function sendAutomationTest({ newsletterId, subject, previewText, fromName, fromEmail, replyTo, html } = {}) {
	const { output, failure } = await runDashboardAction("send_automation_test_email", {
		id: newsletterId, subject, previewText, fromName, fromEmail, replyTo, html,
	});
	return failure ? toFormError(failure) : { sent: true, to: output.sentTo };
}

export async function setAutomationLive({ newsletterId, automationId, draft }) {
	const { output, failure } = await runDashboardAction("set_welcome_automation", { id: newsletterId, automationId, draft });
	if (failure) return toFormError(failure);
	revalidatePath("/");
	revalidatePath("/automations", "layout");
	return output;
}
