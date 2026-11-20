"use client";

import { use, useEffect, useRef, useState } from "react";
import { TextSelection } from "@tiptap/pm/state";
import { Node } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Copy, SquareDashed, SquareRoundCorner } from "lucide-react";
import ControlSectionColor from "@/components/ControlSectionColor";
import ControlEditorSize from "@/components/ControlEditorSize";
import { EmailModePreviewContext } from "@/components/PanelEmailEditor";
import LinkHelp from "@/components/LinkHelp";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isHexColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { reshapeSection } from "@/lib/editor-columns";
import { duplicateBlock } from "@/lib/editor-duplicate-block";
import { readSectionRadius, SECTION_RADIUS_MAX } from "@/lib/section-style";

// The rich email schema requires sections at the root. ProseMirror wraps older flat HTML as it parses.
export const EmailDocument = Node.create({ name: "doc", topNode: true, content: "section+" });

// A section holds any of the issue's blocks but another section (lib/sections.js).
const SECTION_CONTENT = "(paragraph | heading | blockquote | bulletList | orderedList | horizontalRule | image | columns | callout | button | htmlBlock | countdown | discount)+";

export default function BlockSection({ node, updateAttributes, editor, getPos }) {
	const sectionView = useRef(null);
	const [isOpen, setIsOpen] = useState(() => Boolean(node.attrs.isNew));
	const [colorMode, setColorMode] = useState(null);
	const setModePreview = use(EmailModePreviewContext);
	const previewMode = isOpen ? colorMode : null;

	useEffect(() => {
		if (!previewMode || !setModePreview) return;
		setModePreview(previewMode);
		return () => setModePreview(null);
	}, [previewMode, setModePreview]);

	// Opened once: the attribute stays out of the issue's HTML and its undo history.
	useEffect(() => {
		const pos = getPos();
		if (!node.attrs.isNew || typeof pos !== "number") return;
		editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "isNew", false).setMeta("addToHistory", false));
	}, [editor, getPos, node.attrs.isNew]);

	const columns = node.firstChild?.type.name === "columns" ? node.firstChild : null;
	const desktop = columns?.childCount ?? 1;
	const mobile = columns?.attrs.mobile === "1" ? "1" : "same";
	const colors = Object.fromEntries(["light", "dark"].filter((mode) => isHexColor(node.attrs[mode]))
		.map((mode) => [`--section-${mode}-bg`, node.attrs[mode]]));

	const background = (mode) => isHexColor(node.attrs[mode]) ? node.attrs[mode] : mode === "light" ? "#ffffff" : "#18181b";
	const radius = readSectionRadius(node.attrs.radius);
	if (radius !== null) colors["--section-radius"] = `${radius}px`;

	function setLayout(count, stack) {
		const pos = getPos();
		if (typeof pos !== "number") return;
		editor.view.dispatch(editor.state.tr.replaceWith(pos + 1, pos + node.nodeSize - 1, reshapeSection(node, count, stack)));
	}

	function setMobileLayout(value) {
		const pos = getPos();
		if (typeof pos !== "number" || !columns) return;
		editor.view.dispatch(editor.state.tr.setNodeAttribute(pos + 1, "mobile", value === "1" ? "1" : null));
	}

	function duplicate() {
		const pos = getPos();
		const tr = typeof pos === "number" && duplicateBlock(editor.state, pos);
		if (!tr) return;
		setIsOpen(false);
		setColorMode(null);
		editor.view.dispatch(tr);
		editor.commands.focus();
	}

	return (
		<NodeViewWrapper
			data-section-view=""
			data-email-editor-mode={setModePreview ? undefined : previewMode ?? undefined}
			ref={sectionView}
			style={colors}
			className="relative outline outline-dashed outline-foreground/20 motion-safe:transition-colors motion-safe:duration-200"
		>
			<div data-section-header="" contentEditable={false} className="absolute top-0 right-0 z-10 translate-x-[calc(100%-4px)]">
				<Popover open={isOpen} onOpenChange={(next) => { setIsOpen(next); if (!next) setColorMode(null); }}>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={`Section, ${desktop} ${desktop === 1 ? "column" : "columns"}`}
							title="Section settings"
							className="grid size-6 place-items-center rounded-md border bg-popover text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
						>
							<SquareDashed aria-hidden="true" className="size-3.5" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-[min(26rem,calc(100vw-2rem))] p-0"
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							editor.commands.focus();
						}}
					>
						<div className="grid gap-4 p-4">
							<h2 className="text-base font-semibold">Section settings</h2>
							<SectionChoices label="Desktop columns" value={desktop}
								options={[1, 2, 3, ...(desktop === 4 ? [4] : [])].map((value) => ({ value, label: value }))}
								onChange={(value) => setLayout(value, columns?.attrs.mobile)}
							/>
							{desktop > 1 && <SectionChoices label="Mobile columns" value={mobile} onChange={setMobileLayout}
								options={[{ value: "1", label: "One column" }, { value: "same", label: "Same as desktop" }]}
							/>}
							<ControlEditorSize icon={SquareRoundCorner} label="Corner radius" min={0} max={SECTION_RADIUS_MAX} value={radius}
								getFallback={() => parseFloat(getComputedStyle(sectionView.current).borderTopLeftRadius) || 0}
								onChange={(value) => updateAttributes({ radius: value })}
								onPreview={(value) => {
									const style = sectionView.current?.style;
									if (value == null) style?.removeProperty("--drag-radius");
									else style?.setProperty("--drag-radius", `${value}px`);
								}}
							/>
							<div className="grid grid-cols-2 gap-2">
								{["light", "dark"].map((mode) => (
									<button key={mode} type="button" aria-expanded={colorMode === mode}
										className={cn("flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2 text-left text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", colorMode === mode && "ring-1 ring-ring")}
										onClick={() => setColorMode(colorMode === mode ? null : mode)}
									>
										<span className="size-7 shrink-0 rounded-md border" aria-hidden="true" style={{ background: background(mode) }} />
										{mode === "light" ? "Light background" : "Dark background"}
									</button>
								))}
							</div>
							{colorMode && (
								<ControlSectionColor key={colorMode} label={colorMode === "light" ? "Light background" : "Dark background"}
									color={background(colorMode)} onChange={(value) => updateAttributes({ [colorMode]: value })}
									onClear={node.attrs[colorMode] ? () => updateAttributes({ [colorMode]: null }) : undefined}
								/>
							)}
						</div>
						<div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
							<button type="button" onClick={duplicate} className="flex h-8 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
								<Copy aria-hidden="true" className="size-4" /> Duplicate section
							</button>
							<LinkHelp article="writing" section="sections" className="text-xs">How sections work</LinkHelp>
						</div>
					</PopoverContent>
				</Popover>
			</div>
			<NodeViewContent />
		</NodeViewWrapper>
	);
}

function SectionChoices({ label, value, options, onChange }) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 text-sm font-medium">{label}</legend>
			<div className="flex gap-1 rounded-lg bg-muted p-1">
				{options.map((item) => (
					<button key={item.value} type="button" aria-pressed={item.value === value}
						onClick={() => { if (item.value !== value) onChange(item.value); }}
						className="h-9 flex-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
					>{item.label}</button>
				))}
			</div>
		</fieldset>
	);
}

// Kept as <section data-section> with the rules' attributes as they were read, so one the editor can't read stays hidden
// to everyone. Its own data-* attributes find one the API wrote too. isNew: just made, never
// saved, its settings open.
export const Section = Node.create({
	name: "section",
	group: "block",
	content: SECTION_CONTENT,
	defining: true,
	isolating: true,

	addAttributes() {
		return {
			show: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-show") },
			hide: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-hide") },
			where: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-where") },
			light: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-light-bg") },
			dark: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-dark-bg") },
			radius: { default: null, rendered: false, parseHTML: (element) => readSectionRadius(element.getAttribute("data-section-radius")) },
			isNew: { default: false, rendered: false, parseHTML: () => false },
		};
	},

	parseHTML() {
		return ["data-section", "data-show", "data-hide", "data-where"].map((name) => ({ tag: `section[${name}]` }));
	},

	renderHTML({ node }) {
		const { show, hide, where, light, dark } = node.attrs;
		const attributes = { "data-section": "", ...(show !== null && { "data-show": show }), ...(hide !== null && { "data-hide": hide }) };
		return ["section", { ...attributes, ...(where !== null && { "data-where": where }), "data-light-bg": light, "data-dark-bg": dark, "data-section-radius": readSectionRadius(node.attrs.radius) }, 0];
	},

	addNodeView() {
		return ReactNodeViewRenderer(BlockSection);
	},
});

// Sections belong to the root, and are unavailable as children of lists, callouts and columns.
export const EmailSection = Section.extend({ group: null });

export function insertEmailSection(chain, atEnd = false) {
	return chain.command(({ tr, state }) => {
		const { section, paragraph } = state.schema.nodes;
		const { $from } = tr.selection;
		const top = $from.depth ? $from.after(1) : $from.pos;
		const position = atEnd ? tr.doc.content.size : top + (tr.selection.node?.type === section ? tr.selection.node.nodeSize : 0);
		tr.insert(position, section.create({ isNew: true }, paragraph.create()));
		tr.setSelection(TextSelection.create(tr.doc, position + 2));
		tr.scrollIntoView();
		return true;
	});
}
