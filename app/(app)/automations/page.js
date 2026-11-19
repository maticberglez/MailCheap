import FormWelcomeFlow from "@/components/FormWelcomeFlow";
import { requireRole } from "@/lib/selected-newsletter";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
	const { selected, user } = await requireRole("admin");
	return (
		<div className="w-full min-w-0 space-y-3 px-3 py-3">
			<h1 className="text-xl font-semibold">Automations</h1>
			{selected ? <FormWelcomeFlow key={String(selected._id)} storageKey={`welcome-flow:${user.id}:${selected._id}`} /> : <p>Create or select a newsletter to draft a welcome flow.</p>}
		</div>
	);
}
