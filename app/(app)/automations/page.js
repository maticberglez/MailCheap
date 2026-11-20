import AutomationDrafts from "@/components/AutomationDrafts";
import HeaderPage from "@/components/HeaderPage";
import { requireRole } from "@/lib/selected-newsletter";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
	const { selected, user } = await requireRole("admin");
	if (!selected) return <><HeaderPage title="Automations" /><p>Create or select a newsletter to draft an automation.</p></>;
	const scope = `welcome-flow:${user.id}:${selected._id}`;
	return <AutomationDrafts key={scope} scope={scope} newsletterId={String(selected._id)} liveAutomation={selected.welcomeAutomation} />;
}
