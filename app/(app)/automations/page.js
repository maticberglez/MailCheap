import AutomationDrafts from "@/components/AutomationDrafts";
import HeaderPage from "@/components/HeaderPage";
import { scoped } from "@/lib/account-scope";
import { getSignupEmailReviewStatuses } from "@/lib/signup-email-review";
import Newsletter from "@/models/Newsletter";
import { requireRole } from "@/lib/selected-newsletter";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
	const { account, selected, user } = await requireRole("admin");
	if (!selected) return <><HeaderPage title="Automations" /><p>Create or select a newsletter to draft an automation.</p></>;
	const scope = `welcome-flow:${user.id}:${selected._id}`;
	const published = selected.welcomeAutomation?.id
		? await Newsletter.findOne(scoped(account, { _id: selected._id })).lean()
		: null;
	const review = published ? (await getSignupEmailReviewStatuses(published)).welcome : null;
	return (
		<>
			<AutomationDrafts key={scope} scope={scope} newsletterId={String(selected._id)} liveAutomation={selected.welcomeAutomation} />
			{review && (
				<p role="status" className="mt-3 rounded-xl border bg-card px-4 py-3 text-sm">
					{review.status === "rejected" ? "The welcome automation can’t send." : "The welcome automation is in review."}
					{review.note && ` ${review.note}.`} New subscribers won’t receive this email until it can send.
				</p>
			)}
		</>
	);
}
