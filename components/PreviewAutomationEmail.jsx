"use client";

import Link from "next/link";
import { useTheme } from "@teispace/next-themes";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { forEmail } from "@/lib/sections";
import PanelEmailEditor from "@/components/PanelEmailEditor";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import { Mail, Pencil } from "lucide-react";
import { sendAutomationTest } from "@/app/(app)/automations/actions";
import { Button } from "@/components/ui/button";
import { applyEmailPreviewMode, openLinksOutside } from "@/lib/email-preview";
import { fillForReader, SAMPLE_READER } from "@/lib/merge-tags";
import { renderEmail, UNSUBSCRIBE_PLACEHOLDER, withResponsiveImages } from "@/lib/render-email";

export default function PreviewAutomationEmail({ node, addresses, editHref, onSave, mode, onModeChange, actionsTarget }) {
	const [isSending, startSending] = useTransition();
	const [result, setResult] = useState("");
	const resizeObserver = useRef(null);
	const frameRef = useRef(null);
	const { resolvedTheme } = useTheme();
	const previewMode = mode ?? (resolvedTheme === "dark" ? "dark" : "light");
	useLayoutEffect(() => applyEmailPreviewMode(frameRef.current, previewMode), [previewMode]);
	useEffect(() => () => resizeObserver.current?.disconnect(), []);
	const sender = {
		name: addresses.name || addresses.senderName,
		fromName: node.fromName || addresses.senderName,
		fromEmail: node.fromEmail || addresses.sender,
		imageUrl: addresses.imageUrl,
		theme: addresses.theme,
		postalAddress: addresses.postalAddress,
	};
	const { html } = renderEmail({
		format: "rich", html: forEmail(node.html), subject: node.value, previewText: node.previewText, newsletter: sender,
	});
	const preview = fillForReader({ html: withResponsiveImages(html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#")), subject: node.value, previewText: node.previewText }, SAMPLE_READER);

	function loadPreview(event) {
		const frame = event.currentTarget;
		applyEmailPreviewMode(frame, previewMode);
		openLinksOutside(frame);
		const document = frame.contentDocument;
		const settings = frame.closest("aside");
		if (!document) return;
		const motion = document.createElement("style");
		motion.textContent = "@media (prefers-reduced-motion: no-preference) { body, body * { transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease; } }";
		document.head.append(motion);
		if (!editHref) {
			resizeObserver.current?.disconnect();
			document.documentElement.style.overflow = "hidden";
			const fit = () => {
				if (!frame.clientWidth) return;
				frame.style.height = "0px";
				frame.style.height = `${document.documentElement.scrollHeight}px`;
			};
			resizeObserver.current = new ResizeObserver(fit);
			resizeObserver.current.observe(document.body);
			fit();
			return;
		}
		if (!settings) return;
		document.addEventListener("wheel", (wheel) => {
			const body = document.scrollingElement;
			if (!body || !wheel.deltaY || wheel.ctrlKey) return;
			const atEdge = wheel.deltaY < 0 ? body.scrollTop <= 0 : body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
			if (!atEdge || !wheel.cancelable) return;
			wheel.preventDefault();
			settings.scrollTop += wheel.deltaY * (wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? settings.clientHeight : 1);
		}, { passive: false });
	}

	function send() {
		startSending(async () => {
			setResult("");
			try {
				const result = await sendAutomationTest({
					newsletterId: addresses.newsletterId, subject: node.value || "", previewText: node.previewText || "",
					fromName: node.fromName || "", fromEmail: node.fromEmail || "", replyTo: node.replyTo || "", html: node.html || "",
				});
				setResult(result.sent ? `Test sent to ${result.to}.` : result.error);
			} catch {
				setResult("Could not send the test email.");
			}
		});
	}

	function renderCard(mode) {
		return (
			<article>
				<header className="space-y-4 border-b border-border/60 p-4 motion-safe:transition-colors motion-safe:duration-200 sm:p-5">
					<div className="space-y-1">
						<h2 className="wrap-break-word text-2xl font-semibold tracking-tight">{preview.subject || "No subject"}</h2>
						{preview.previewText && <p className="wrap-break-word text-sm text-muted-foreground">{preview.previewText}</p>}
					</div>
					<div className="flex items-center gap-3 text-sm">
						<AvatarNewsletter newsletter={sender} size={40} className="rounded-full" />
						<div className="min-w-0 wrap-break-word">
							<p className="font-medium">{sender.fromName}</p>
							{sender.fromEmail && <p className="text-muted-foreground">{sender.fromEmail}</p>}
							{(node.replyTo || addresses.replyTo) && <p className="text-muted-foreground">Reply to {node.replyTo || addresses.replyTo}</p>}
						</div>
					</div>
				</header>
				{node.html ? (
					<iframe ref={frameRef} title="Email preview" sandbox="allow-same-origin" srcDoc={preview.html} style={{ colorScheme: mode }} onLoad={loadPreview}
						className={editHref ? "block h-[min(640px,65vh)] w-full" : "block w-full"} />
				) : <p className="p-4 text-sm text-muted-foreground">Add content to see a preview.</p>}
			</article>
		);
	}

	const actions = (
		<div className={editHref ? "grid grid-cols-2 gap-2" : "flex flex-wrap justify-end gap-2"}>
			{editHref && <Button className="h-11 w-full" asChild><Link href={editHref}><Pencil /> Edit email</Link></Button>}
			<Button variant="outline" className={editHref ? "h-11 w-full" : "max-sm:size-9 max-sm:px-0"} disabled={isSending || !node.value?.trim() || !node.html || !addresses.testRecipient}
				aria-label="Send test to me" title={`Send to ${addresses.testRecipient}`} onClick={send}>
				<Mail /><span className={editHref ? undefined : "max-sm:sr-only"}>{isSending ? "Sending…" : "Send test to me"}</span>
			</Button>
			{onSave && <Button type="button" className="shrink-0 lg:min-w-32" onClick={onSave}>Save</Button>}
		</div>
	);

	return (
		<div className="space-y-2">
			{editHref ? actions : actionsTarget && createPortal(actions, actionsTarget)}
			{result && <p role="status" className="text-sm text-muted-foreground">{result}</p>}
			<PanelEmailEditor className="shadow-border" mode={mode} onModeChange={onModeChange}>{renderCard}</PanelEmailEditor>
		</div>
	);
}

