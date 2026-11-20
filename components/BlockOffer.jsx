"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CaseSensitive, MoveHorizontal, MoveVertical, Timer } from "lucide-react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import ControlFontWeight from "@/components/ControlFontWeight";
import ControlEditorSize from "@/components/ControlEditorSize";
import { ALIGNMENTS } from "@/components/MenuImage";
import ButtonCopy from "@/components/ButtonCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { normalizeHexColor } from "@/lib/colors";
import { offerStyleData, OFFER_PADDING, OFFER_SIZES, OFFER_STYLE_KEYS, readOfferStyle } from "@/lib/offer-style";
import { cn } from "@/lib/utils";
import { countdownDeadlineText, countdownText, readCountdownDeadline } from "@/lib/countdown";

function BlockOffer({ node, updateAttributes, editor }) {
	const countdown = node.type.name === "countdown";
	const deadline = readCountdownDeadline(node.attrs.deadline);
	const style = readOfferStyle(node.attrs);
	const [now, setNow] = useState(() => Date.now());
	const [open, setOpen] = useState(false);
	const [dragStyle, setDragStyle] = useState(null);
	const display = { ...style, ...dragStyle };
	const padding = { paddingInline: display["padding-x"] ?? OFFER_PADDING.default, paddingBlock: display["padding-y"] ?? OFFER_PADDING.default };

	useEffect(() => {
		if (!deadline) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [deadline]);

	const label = countdown ? "Countdown" : "Discount";
	const labelColor = style["label-color"] === "auto" ? null : style["label-color"];
	const offer = (
		<Popover open={open} onOpenChange={(next) => {
			setOpen(next);
			setDragStyle(null);
		}}>
			<PopoverTrigger asChild>
				<button type="button" disabled={!editor.isEditable}
					className={cn("cursor-pointer rounded-lg text-inherit outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
						countdown ? "grid w-full" : "grid min-w-0 break-words")}
					style={{ textAlign: "inherit" }}
				>
					<strong className={cn("min-w-0", countdown && deadline && "flex h-[88px] w-full max-w-[480px] items-center rounded-lg bg-[#18181b] px-4 font-sans text-white")}
						style={{
							color: style.color ?? (countdown && deadline ? "#fff" : "inherit"),
							fontSize: display.size ?? (countdown && deadline ? COUNTDOWN_DIMENSIONS[0].fallback : undefined),
							fontWeight: style.weight ?? 700,
							...(countdown && deadline && { justifyContent: { left: "flex-start", center: "center", right: "flex-end" }[display.align], justifySelf: { left: "start", center: "center", right: "end" }[display.align] }),
						}}
					>
						{countdown ? (deadline ? countdownText(deadline, now, node.attrs) : "Set countdown deadline") : node.attrs.code || "Set discount code"}
					</strong>
					{countdown ? deadline && <span>{countdownDeadlineText(deadline)}</span>
						: <span className="min-w-0" style={{ color: labelColor ?? undefined }}>{node.attrs.label}</span>}
				</button>
			</PopoverTrigger>
			<PopoverContent side="right" align="start" sideOffset={12} className="max-h-none w-72 overflow-visible">
				<div className="grid gap-2.5">
					<h3 className="font-semibold">{label}</h3>
					{countdown ? (
						<>
							<label className="grid gap-1 text-sm">Deadline (local time)
								<Input type="datetime-local" defaultValue={deadline ? new Date(deadline - new Date(deadline).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""}
									onChange={(event) => {
										const next = readCountdownDeadline(new Date(event.target.value).valueOf());
										if (!next) return;
										setNow(Date.now());
										updateAttributes({ deadline: next });
									}}
								/>
							</label>
							<div className="grid gap-1 rounded-lg border bg-background p-2">
								<label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm">
									<CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" /> Show days
									<Switch className="ml-auto" checked={node.attrs.showDays} onCheckedChange={(showDays) => updateAttributes({ showDays })} />
								</label>
								<label className="flex items-center gap-2 rounded-md px-1 py-1 text-sm">
									<Timer aria-hidden="true" className="size-4 text-muted-foreground" /> Show seconds
									<Switch className="ml-auto" checked={node.attrs.showSeconds} onCheckedChange={(showSeconds) => updateAttributes({ showSeconds })} />
								</label>
							</div>
						</>
					) : (
						<div className="grid grid-cols-2 gap-2">
							<label className="grid gap-1 text-sm">Code
								<Input maxLength={64} defaultValue={node.attrs.code} onChange={(event) => updateAttributes({ code: event.target.value.trim() })} />
							</label>
							<label className="grid gap-1 text-sm">Label
								<Input maxLength={120} defaultValue={node.attrs.label} onChange={(event) => updateAttributes({ label: event.target.value.trim() })} />
							</label>
						</div>
					)}
					<fieldset className="grid gap-1 text-sm">
						<legend>Alignment</legend>
						<div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
							{ALIGNMENTS.map(({ value, label, icon: Icon }) => (
								<Button key={value} type="button" aria-label={label} aria-pressed={display.align === value} title={label}
									variant="ghost" size="sm" className="aria-pressed:bg-background aria-pressed:shadow-xs"
									onClick={() => updateAttributes({ align: value })}
								><Icon aria-hidden="true" /></Button>
							))}
						</div>
					</fieldset>
					{(countdown ? COUNTDOWN_DIMENSIONS : DISCOUNT_DIMENSIONS).map(({ key, icon, label, min, max, fallback }) => (
						<ControlEditorSize key={key} icon={icon} label={label} min={min} max={max}
							value={display[key]} getFallback={() => fallback}
							onChange={(value) => updateAttributes({ [key]: value })}
							onPreview={(value) => setDragStyle(value == null ? null : { [key]: value })}
						/>
					))}
					<ControlFontWeight value={style.weight} onChange={(weight) => updateAttributes({ weight })} />
					<div className={cn("grid gap-2", !countdown && "grid-cols-2")}>
						<OfferColor label={countdown ? "Text color" : "Code color"} value={style.color} onChange={(color) => updateAttributes({ color })} />
						{!countdown && <OfferColor label="Label color" value={labelColor} onChange={(color) => updateAttributes({ "label-color": color ?? "auto" })} />}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);

	return (
		<NodeViewWrapper contentEditable={false} style={{ textAlign: display.align }} className={"mb-[var(--email-block-gap,16px)]"}>
			{countdown ? offer : (
				<div className="inline-flex max-w-full items-start gap-2 align-top">
					<div className="relative min-w-0 rounded-lg border border-dashed border-[var(--email-border)]" style={padding}>
						<span aria-hidden="true" className="absolute -top-3 left-2 grid size-6 place-items-center rounded-full border border-[var(--email-border)] bg-[var(--email-background)] text-[15px] leading-none text-[var(--email-muted)]">✂︎</span>
						{offer}
					</div>
					{node.attrs.code && <ButtonCopy value={node.attrs.code} label="Copy code" large />}
				</div>
			)}
		</NodeViewWrapper>
	);
}

function OfferColor({ label, value, onChange }) {
	const [invalid, setInvalid] = useState(false);
	return (
		<label className="grid gap-1 text-sm">{label}
			<Input aria-invalid={invalid} maxLength={7} placeholder="Default" defaultValue={value ?? ""}
				onChange={(event) => {
					const hex = event.target.value.trim();
					const color = normalizeHexColor(hex);
					setInvalid(false);
					if (!hex || color) onChange(color);
				}}
				onBlur={(event) => {
					const hex = event.target.value.trim();
					setInvalid(Boolean(hex && !normalizeHexColor(hex)));
				}}
			/>
			{invalid && <span role="alert" className="text-xs text-destructive">Enter a valid hex color.</span>}
		</label>
	);
}

const COUNTDOWN_DIMENSIONS = [{ key: "size", icon: CaseSensitive, label: "Text size", ...OFFER_SIZES, fallback: 40 }];

const DISCOUNT_DIMENSIONS = [
	{ ...COUNTDOWN_DIMENSIONS[0], fallback: 17 },
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
			"label-color": {
				default: "auto", rendered: false,
				parseHTML: (element) => readOfferStyle({ "label-color": element.getAttribute("data-offer-label-color") ?? element.getAttribute("data-offer-color") })["label-color"] ?? "auto",
			},
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
