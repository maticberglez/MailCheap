import AutomationDrafts from "@/components/AutomationDrafts";
import { getAutomationEmailAddresses } from "@/lib/automation-email-addresses";
import { requireRole } from "@/lib/selected-newsletter";

import { serialize } from "@/lib/serialize";

export const metadata = { title: "Automation" };

export default async function AutomationPage({ params, searchParams }) {
	const { id } = await params;
	const { selected, user, account } = await requireRole("admin");
	if (!selected) return <p>Select the newsletter that owns this automation.</p>;
	const scope = `welcome-flow:${user.id}:${selected._id}`;
	const [addresses, { node }] = await Promise.all([getAutomationEmailAddresses(account, user, selected), searchParams]);
	return <AutomationDrafts key={`${scope}:${id}:${node ?? ""}`} scope={scope} draftId={id} selectedNodeId={typeof node === "string" ? node : null}
		addresses={serialize({ ...addresses, newsletterId: String(selected._id), testRecipient: user.email,
			name: selected.name, imageUrl: selected.imageUrl, theme: selected.theme, postalAddress: selected.postalAddress, replyTo: selected.replyTo,
		})} />;
}
