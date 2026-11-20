"use client";

import { useEffect, useState } from "react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { countdownDeadlineText, countdownText, readCountdownDeadline } from "@/lib/countdown";

function BlockOffer({ node, updateAttributes, editor }) {
	const countdown = node.type.name === "countdown";
	const deadline = readCountdownDeadline(node.attrs.deadline);
	const [now, setNow] = useState(() => Date.now());
	const [open, setOpen] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!deadline) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [deadline]);

	const label = countdown ? "Countdown" : "Discount";
	return (
		<NodeViewWrapper contentEditable={false} className="mb-4 rounded-lg border p-3 text-center">
			<Popover open={open} onOpenChange={(next) => { setOpen(next); setError(""); }}>
				<PopoverTrigger asChild>
					<button type="button" disabled={!editor.isEditable} className="grid w-full cursor-pointer gap-1 rounded-lg px-2 py-1 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
						<strong>{countdown ? (deadline ? countdownText(deadline, now) : "Set countdown deadline") : node.attrs.code || "Set discount code"}</strong>
						{countdown ? deadline && <span className="text-sm text-muted-foreground">{countdownDeadlineText(deadline)}</span>
							: <span className="text-sm text-muted-foreground">{node.attrs.label}</span>}
					</button>
				</PopoverTrigger>
				<PopoverContent>
					<form className="grid gap-3" onSubmit={(event) => {
						event.preventDefault();
						const fields = new FormData(event.currentTarget);
						if (countdown) {
							const next = readCountdownDeadline(new Date(fields.get("deadline")).valueOf());
							if (!next) { setError("Enter a valid deadline."); return; }
							setNow(Date.now());
							updateAttributes({ deadline: next });
						} else {
							const code = String(fields.get("code")).trim();
							if (!code) { setError("Enter a discount code."); return; }
							updateAttributes({ code, label: String(fields.get("label")).trim() });
						}
						setOpen(false);
					}}>
						<h3 className="font-semibold">{label}</h3>
						{countdown ? (
							<label className="grid gap-1 text-sm">Deadline (local time)
								<Input name="deadline" type="datetime-local" required defaultValue={deadline ? new Date(deadline - new Date(deadline).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""} />
							</label>
						) : (
							<>
								<label className="grid gap-1 text-sm">Code<Input name="code" maxLength={64} required defaultValue={node.attrs.code} /></label>
								<label className="grid gap-1 text-sm">Label<Input name="label" maxLength={120} defaultValue={node.attrs.label} /></label>
							</>
						)}
						{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
						<Button type="submit">Apply</Button>
					</form>
				</PopoverContent>
			</Popover>
		</NodeViewWrapper>
	);
}

export const CountdownBlock = Node.create({
	name: "countdown",
	group: "block",
	atom: true,
	addAttributes() {
		return { deadline: { default: null, rendered: false, parseHTML: (element) => readCountdownDeadline(element.getAttribute("data-countdown")) } };
	},
	parseHTML: () => [{ tag: "div[data-countdown]", priority: 60 }],
	renderHTML({ node }) {
		const deadline = readCountdownDeadline(node.attrs.deadline);
		return ["div", { "data-countdown": deadline ?? "" }, ...(deadline ? [["span", countdownDeadlineText(deadline)]] : [])];
	},
	addNodeView: () => ReactNodeViewRenderer(BlockOffer),
});

export const DiscountBlock = Node.create({
	name: "discount",
	group: "block",
	atom: true,
	addAttributes() {
		return {
			code: { default: "", rendered: false, parseHTML: (element) => element.querySelector("strong")?.textContent.slice(0, 64) ?? "" },
			label: { default: "Use this discount code", rendered: false, parseHTML: (element) => element.querySelector("span")?.textContent.slice(0, 120) ?? "" },
		};
	},
	parseHTML: () => [{ tag: "div[data-discount]", priority: 60 }],
	renderHTML({ node }) {
		const { code, label } = node.attrs;
		return ["div", { "data-discount": "" }, ...(code ? [["strong", code], ["br"], ["span", label]] : [])];
	},
	addNodeView: () => ReactNodeViewRenderer(BlockOffer),
});
