import { Link, Mail } from "lucide-react";
import ImageFavicon from "@/components/ImageFavicon";
import { isButtonLink } from "@/lib/buttons";
import { formatLinkUrl } from "@/lib/links";
import { cn } from "@/lib/utils";

export default function ButtonEditorLink({ href, onClick, label, className }) {
	const isLinked = isButtonLink(href);
	const isMail = /^mailto:/i.test(href ?? "");
	const host = isLinked && !isMail ? getHost(href) : null;
	const text = !isLinked ? "Add a link" : isMail ? href.slice("mailto:".length) : formatLinkUrl(href);
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={isLinked ? `Link: ${href}` : "Add a link"}
			className={cn("flex h-8 max-w-40 min-w-0 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground sm:max-w-56", className)}
		>
			{host ? <ImageFavicon domain={host} size={14} /> : isMail ? <Mail className="size-4 shrink-0" /> : <Link className="size-4 shrink-0" />}
			<span className="truncate">{text}</span>
		</button>
	);
}

function getHost(href) {
	try {
		return new URL(href).hostname;
	} catch {
		return null;
	}
}
