"use client";

import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import ButtonCopy from "@/components/ButtonCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeHexColor } from "@/lib/colors";
import { offerStyleData, OFFER_SIZES, readOfferStyle } from "@/lib/offer-style";
import { cn } from "@/lib/utils";
import { countdownDeadlineText, countdownText, readCountdownDeadline } from "@/lib/countdown";

function BlockOffer({ node, updateAttributes, editor }) {
	const countdown = node.type.name === "countdown";
	const deadline = readCountdownDeadline(node.attrs.deadline);
	const style = readOfferStyle(node.attrs);
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
		<NodeViewWrapper contentEditable={false} style={{ color: style.color ?? undefined, textAlign: style.align }}
			className={cn("relative mb-4 rounded-lg border p-3", !countdown && "border-dashed")}>
			{!countdown && <Scissors aria-hidden="true" className="absolute -top-2.5 left-3 size-5 bg-background p-0.5 text-muted-foreground" />}
			<Popover open={open} onOpenChange={(next) => { setOpen(next); setError(""); }}>
				<PopoverTrigger asChild>
					<button type="button" disabled={!editor.isEditable} className="grid w-full cursor-pointer gap-1 rounded-lg px-2 py-1 text-inherit outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring" style={{ textAlign: "inherit" }}>
						<strong style={{ color: "inherit", fontSize: style.size ?? undefined }}>{countdown ? (deadline ? countdownText(deadline, now, node.attrs) : "Set countdown deadline") : node.attrs.code || "Set discount code"}</strong>
						{countdown ? deadline && <span className="text-sm text-muted-foreground">{countdownDeadlineText(deadline)}</span>
							: <span className="text-sm text-muted-foreground" style={{ color: style.color ?? undefined }}>{node.attrs.label}</span>}
					</button>
				</PopoverTrigger>
				<PopoverContent>
					<form className="grid gap-3" onSubmit={(event) => {
						event.preventDefault();
						const fields = new FormData(event.currentTarget);
						const hex = String(fields.get("color") ?? "").trim();
						const color = normalizeHexColor(hex);
						if (hex && !color) { setError("Enter a valid hex color."); return; }
						const styling = readOfferStyle({ align: fields.get("align"), color, size: fields.get("size") });
						if (countdown) {
							const next = readCountdownDeadline(new Date(fields.get("deadline")).valueOf());
							if (!next) { setError("Enter a valid deadline."); return; }
							setNow(Date.now());
							updateAttributes({ ...styling, deadline: next, showDays: fields.has("showDays"), showSeconds: fields.has("showSeconds") });
						} else {
							const code = String(fields.get("code")).trim();
							if (!code) { setError("Enter a discount code."); return; }
							updateAttributes({ ...styling, code, label: String(fields.get("label")).trim() });
						}
						setOpen(false);
					}}>
						<h3 className="font-semibold">{label}</h3>
						{countdown ? (
							<>
								<label className="grid gap-1 text-sm">Deadline (local time)
									<Input name="deadline" type="datetime-local" required defaultValue={deadline ? new Date(deadline - new Date(deadline).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""} />
								</label>
								<div className="flex flex-wrap gap-3 text-sm">
									<label className="flex items-center gap-1.5"><input name="showDays" type="checkbox" defaultChecked={node.attrs.showDays} /> Show days</label>
									<label className="flex items-center gap-1.5"><input name="showSeconds" type="checkbox" defaultChecked={node.attrs.showSeconds} /> Show seconds</label>
								</div>
							</>
						) : (
							<>
								<label className="grid gap-1 text-sm">Code<Input name="code" maxLength={64} required defaultValue={node.attrs.code} /></label>
								<label className="grid gap-1 text-sm">Label<Input name="label" maxLength={120} defaultValue={node.attrs.label} /></label>
							</>
						)}
						<label className="grid gap-1 text-sm">Alignment
							<Select name="align" defaultValue={style.align}>
								<SelectTrigger aria-label="Alignment" className="w-full"><SelectValue /></SelectTrigger>
								<SelectContent position="popper">
									<SelectItem value="left">Left</SelectItem>
									<SelectItem value="center">Center</SelectItem>
									<SelectItem value="right">Right</SelectItem>
								</SelectContent>
							</Select>
						</label>
						<div className="grid grid-cols-2 gap-2">
							<label className="grid gap-1 text-sm">Text size (px)
								<Input name="size" type="number" min={OFFER_SIZES.min} max={OFFER_SIZES.max} placeholder="Default" defaultValue={style.size ?? ""} className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
							</label>
							<label className="grid gap-1 text-sm">Text color
								<Input name="color" maxLength={7} placeholder="#000000" defaultValue={style.color ?? ""} />
							</label>
						</div>
						{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
						<Button type="submit">Apply</Button>
					</form>
				</PopoverContent>
			</Popover>
			{!countdown && node.attrs.code && <div className="mt-2"><ButtonCopy value={node.attrs.code} label="Copy code" hasLabel /></div>}
		</NodeViewWrapper>
	);
}

const offerAttributes = Object.fromEntries(["align", "color", "size"].map((key) => [key, {
	default: key === "align" ? "center" : null,
	rendered: false,
	parseHTML: (element) => readOfferStyle({ [key]: element.getAttribute(`data-offer-${key}`) })[key],
}]));

export const CountdownBlock = Node.create({
	name: "countdown",
	group: "block",
	atom: true,
	addAttributes() {
		return {
			...offerAttributes,
			deadline: { default: null, rendered: false, parseHTML: (element) => readCountdownDeadline(element.getAttribute("data-countdown")) },
			showDays: { default: true, rendered: false, parseHTML: (element) => element.getAttribute("data-countdown-days") !== "0" },
			showSeconds: { default: false, rendered: false, parseHTML: (element) => element.getAttribute("data-countdown-seconds") === "1" },
		};
	},
	parseHTML: () => [{ tag: "div[data-countdown]", priority: 60 }],
	renderHTML({ node }) {
		const deadline = readCountdownDeadline(node.attrs.deadline);
		return ["div", {
			"data-countdown": deadline ?? "",
			...(!node.attrs.showDays && { "data-countdown-days": "0" }),
			...(node.attrs.showSeconds && { "data-countdown-seconds": "1" }),
			...offerStyleData(node.attrs),
		}, ...(deadline ? [["span", countdownDeadlineText(deadline)]] : [])];
	},
	addNodeView: () => ReactNodeViewRenderer(BlockOffer),
});

export const DiscountBlock = Node.create({
	name: "discount",
	group: "block",
	atom: true,
	addAttributes() {
		return {
			...offerAttributes,
			code: { default: "", rendered: false, parseHTML: (element) => element.querySelector("strong")?.textContent.slice(0, 64) ?? "" },
			label: { default: "Use this discount code", rendered: false, parseHTML: (element) => element.querySelector("span")?.textContent.slice(0, 120) ?? "" },
		};
	},
	parseHTML: () => [{ tag: "div[data-discount]", priority: 60 }],
	renderHTML({ node }) {
		const { code, label } = node.attrs;
		return ["div", { "data-discount": "", ...offerStyleData(node.attrs) }, ...(code ? [["strong", code], ["br"], ["span", label]] : [])];
	},
	addNodeView: () => ReactNodeViewRenderer(BlockOffer),
});
