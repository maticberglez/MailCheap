import AutomationDrafts from "@/components/AutomationDrafts";
import { getAutomationEmailAddresses } from "@/lib/automation-email-addresses";
import { requireRole } from "@/lib/selected-newsletter";

import { serialize } from "@/lib/serialize";

export const metadata = { title: "Automation email" };

export default async function AutomationEmailPage({ params }) {
	const { id, nodeId } = await params;
	const { selected, user, account } = await requireRole("admin");
	if (!selected) return <p>Select the newsletter that owns this automation.</p>;
	const scope = `welcome-flow:${user.id}:${selected._id}`;
	const addresses = await getAutomationEmailAddresses(account, user, selected);
	return <AutomationDrafts key={`${scope}:${id}:${nodeId}`} scope={scope} draftId={id} emailNodeId={nodeId}
		addresses={serialize({ ...addresses, newsletterId: String(selected._id), testRecipient: user.email,
			name: selected.name, imageUrl: selected.imageUrl, theme: selected.theme, postalAddress: selected.postalAddress, replyTo: selected.replyTo,
		})} />;
}
