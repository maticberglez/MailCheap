import "server-only";
import { findNewsletterAuthors } from "@/lib/authors";
import { findAccountDomains } from "@/lib/sender";
import { getEmailDomain } from "@/lib/sender-rules";

export async function getAutomationEmailAddresses(account, user, newsletter) {
	const [{ authors }, domains] = await Promise.all([
		findNewsletterAuthors(account, newsletter._id),
		findAccountDomains(account._id),
	]);
	const sender = newsletter.fromEmail || "";
	const verified = new Set(domains.filter((domain) => domain.verified).map((domain) => domain.domain));
	const authorEmails = authors.map(({ email }) => email);
	const fromEmails = [...new Set([sender, ...authorEmails.filter((email) => verified.has(getEmailDomain(email)))].filter(Boolean))];
	const newsletterDomains = new Set([...verified, getEmailDomain(sender)].filter(Boolean));
	const replyEmails = [...new Set([...fromEmails, user.email, ...authorEmails].filter((email) => newsletterDomains.has(getEmailDomain(email))))];
	return { fromEmails, replyEmails, sender, senderName: newsletter.fromName || newsletter.name };
}
