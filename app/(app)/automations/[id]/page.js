import AutomationDrafts from "@/components/AutomationDrafts";
import { findNewsletterAuthors } from "@/lib/authors";
import { findAccountDomains } from "@/lib/sender";
import { getEmailDomain } from "@/lib/sender-rules";
import { requireRole } from "@/lib/selected-newsletter";

export const metadata = { title: "Automation" };

export default async function AutomationPage({ params, searchParams }) {
	const { id } = await params;
	const { selected, user, account } = await requireRole("admin");
	if (!selected) return <p>Select the newsletter that owns this automation.</p>;
	const scope = `welcome-flow:${user.id}:${selected._id}`;
	const [{ authors }, domains, { node }] = await Promise.all([
		findNewsletterAuthors(account, selected._id),
		findAccountDomains(account._id),
		searchParams,
	]);
	const sender = selected.fromEmail || "";
	const verified = new Set(domains.filter((domain) => domain.verified).map((domain) => domain.domain));
	const fromEmails = [...new Set([sender, ...authors.map(({ email }) => email).filter((email) => verified.has(getEmailDomain(email)))].filter(Boolean))];
	const newsletterDomains = new Set([...verified, getEmailDomain(sender)].filter(Boolean));
	const replyEmails = [...new Set([...fromEmails, user.email, ...authors.map(({ email }) => email)].filter((email) => newsletterDomains.has(getEmailDomain(email))))];
	return <AutomationDrafts key={`${scope}:${id}:${node ?? ""}`} scope={scope} draftId={id} selectedNodeId={typeof node === "string" ? node : null}
		addresses={{ fromEmails, replyEmails, sender, senderName: selected.fromName || selected.name }} />;
}
