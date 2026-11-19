import AutomationDrafts from "@/components/AutomationDrafts";
import { requireRole } from "@/lib/selected-newsletter";

export const metadata = { title: "Automation email" };

export default async function AutomationEmailPage({ params }) {
	const { id, nodeId } = await params;
	const { selected, user } = await requireRole("admin");
	if (!selected) return <p>Select the newsletter that owns this automation.</p>;
	const scope = `welcome-flow:${user.id}:${selected._id}`;
	return <AutomationDrafts key={`${scope}:${id}:${nodeId}`} scope={scope} draftId={id} emailNodeId={nodeId} />;
}
