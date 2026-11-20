"use client";

import { useEffect, useState } from "react";
import { CaseSensitive, MoveHorizontal, MoveVertical, Scissors } from "lucide-react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import ControlEditorSize from "@/components/ControlEditorSize";
import { ALIGNMENTS } from "@/components/MenuImage";
import ButtonCopy from "@/components/ButtonCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeHexColor } from "@/lib/colors";
import { DISCOUNT_COPY_SYMBOL, offerStyleData, OFFER_PADDING, OFFER_SIZES, OFFER_STYLE_KEYS, readOfferStyle } from "@/lib/offer-style";
import { cn } from "@/lib/utils";
import { countdownDeadlineText, countdownText, readCountdownDeadline } from "@/lib/countdown";

function BlockOffer({ node, updateAttributes, editor }) {
	const countdown = node.type.name === "countdown";
	const deadline = readCountdownDeadline(node.attrs.deadline);
	const style = readOfferStyle(node.attrs);
	const [now, setNow] = useState(() => Date.now());
	const [open, setOpen] = useState(false);
	const [error, setError] = useState("");
	const [draftStyle, setDraftStyle] = useState(null);
	const [dragStyle, setDragStyle] = useState(null);
	const display = { ...style, ...draftStyle, ...dragStyle };
	const padding = { paddingInline: display["padding-x"] ?? OFFER_PADDING.default, paddingBlock: display["padding-y"] ?? OFFER_PADDING.default };

	useEffect(() => {
		if (!deadline) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [deadline]);

	const label = countdown ? "Countdown" : "Discount";
	return (
		<NodeViewWrapper contentEditable={false} style={{ color: style.color ?? undefined, textAlign: display.align }}
			className={cn("mb-4", countdown && "rounded-lg border p-3")}>
			<Popover open={open} onOpenChange={(next) => {
				setOpen(next);
				setError("");
				setDraftStyle(null);
				setDragStyle(null);
			}}>
				<PopoverTrigger asChild>
					<button type="button" disabled={!editor.isEditable} className={cn("cursor-pointer gap-1 rounded-lg text-inherit outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
							countdown ? "grid w-full px-2 py-1" : "relative inline-flex max-w-full flex-col break-words border border-dashed align-top")}
						style={{ textAlign: "inherit", ...(countdown ? {} : padding) }}
					>
						{!countdown && <Scissors aria-hidden="true" className="absolute -top-2 left-2 size-4 bg-background p-0.5 text-muted-foreground" />}
						<strong className="min-w-0" style={{ color: "inherit", fontSize: display.size ?? undefined }}>{countdown ? (deadline ? countdownText(deadline, now, node.attrs) : "Set countdown deadline") : node.attrs.code || "Set discount code"}</strong>
						{countdown ? deadline && <span className="text-sm text-muted-foreground">{countdownDeadlineText(deadline)}</span>
							: <span className="min-w-0 text-sm text-muted-foreground" style={{ color: style.color ?? undefined }}>{node.attrs.label}</span>}
					</button>
				</PopoverTrigger>
				<PopoverContent>
					<form className="grid gap-3" onSubmit={(event) => {
						event.preventDefault();
						const fields = new FormData(event.currentTarget);
						const hex = String(fields.get("color") ?? "").trim();
						const color = normalizeHexColor(hex);
						if (hex && !color) { setError("Enter a valid hex color."); return; }
						const styling = readOfferStyle(countdown
							? { align: fields.get("align"), color, size: fields.get("size") }
							: { ...style, ...draftStyle, color });
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
						setDraftStyle(null);
						setDragStyle(null);
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
						{countdown ? (
							<>
								<label className="grid gap-1 text-sm">Alignment
									<Select name="align" defaultValue={style.align}>
										<SelectTrigger aria-label="Alignment" className="w-full"><SelectValue /></SelectTrigger>
										<SelectContent position="popper">
											{ALIGNMENTS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
										</SelectContent>
									</Select>
								</label>
								<label className="grid gap-1 text-sm">Text size (px)
									<Input name="size" type="number" min={OFFER_SIZES.min} max={OFFER_SIZES.max} placeholder="Default" defaultValue={style.size ?? ""} className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
								</label>
							</>
						) : (
							<>
								<fieldset className="grid gap-1 text-sm">
									<legend>Alignment</legend>
									<div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
										{ALIGNMENTS.map(({ value, label, icon: Icon }) => (
											<Button key={value} type="button" aria-label={label} aria-pressed={display.align === value} title={label}
												variant="ghost" size="sm" className="aria-pressed:bg-background aria-pressed:shadow-xs"
												onClick={() => setDraftStyle((current) => ({ ...current, align: value }))}
											><Icon aria-hidden="true" /></Button>
										))}
									</div>
								</fieldset>
								{DISCOUNT_DIMENSIONS.map(({ key, icon, label, min, max, fallback }) => (
									<ControlEditorSize key={key} icon={icon} label={label} min={min} max={max}
										value={display[key]} getFallback={() => fallback}
										onChange={(value) => setDraftStyle((current) => ({ ...current, [key]: value }))}
										onPreview={(value) => setDragStyle(value == null ? null : { [key]: value })}
									/>
								))}
							</>
						)}
						<label className="grid gap-1 text-sm">Text color
							<Input name="color" maxLength={7} placeholder="#000000" defaultValue={style.color ?? ""} />
						</label>
						{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
						<Button type="submit">Apply</Button>
					</form>
				</PopoverContent>
			</Popover>
			{!countdown && node.attrs.code && <div className="mt-2"><ButtonCopy value={node.attrs.code} label="Copy code" hasLabel symbol={DISCOUNT_COPY_SYMBOL} /></div>}
		</NodeViewWrapper>
	);
}

const DISCOUNT_DIMENSIONS = [
	{ key: "size", icon: CaseSensitive, label: "Text size", ...OFFER_SIZES, fallback: 17 },
	{ key: "padding-x", icon: MoveHorizontal, label: "Horizontal padding", ...OFFER_PADDING, fallback: OFFER_PADDING.default },
	{ key: "padding-y", icon: MoveVertical, label: "Vertical padding", ...OFFER_PADDING, fallback: OFFER_PADDING.default },
];

const offerAttributes = Object.fromEntries(OFFER_STYLE_KEYS.map((key) => [key, {
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
