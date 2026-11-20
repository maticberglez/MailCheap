"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { AlignCenter, AlignLeft, AlignRight, Copy, CornerDownLeft, Link2, MoveVertical, SquareRoundCorner, Trash2 } from "lucide-react";
import ButtonEditorLink from "@/components/ButtonEditorLink";
import { ButtonFormat } from "@/components/MenuFormat";
import { duplicateBlock } from "@/lib/editor-duplicate-block";
import { deleteBlock } from "@/lib/editor-undo-delete";
import { normalizeUrl } from "@/lib/links";

// A toolbar for the picture under the pointer, or the selected one on touch screens and from the keyboard: where it
// sits in the column (lib/editor-image.js), its alt text and a way to remove it. It sits inside the picture's top edge,
// in the editor's parent next to the blocks' grip (lib/editor-block-handle.js), so the pointer gets to it without
// leaving the picture.
export default function MenuImage({ editor }) {
	const [hovered, setHovered] = useState(null);
	const [field, setField] = useState(null);
	const [isFocusInside, setIsFocusInside] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const menuRef = useRef(null);
	const adjustment = useRef(null);
	const suppressAdjustmentClick = useRef(false);
	const target = useEditorState({ editor, selector: ({ editor: current }) => getTarget(current, hovered, isFocusInside) });
	const image = target && !isDragging ? editor.view.nodeDOM(target.pos) : null;
	const container = editor.isEditorContentInitialized ? editor.view.dom.parentElement : null;

	useEffect(() => {
		const { dom } = editor.view;
		function onOver(event) {
			setHovered(event.target instanceof Element ? event.target.closest("[data-resize-container]") : null);
		}
		function onLeave(event) {
			if (!isInside(menuRef.current, event.relatedTarget)) setHovered(null);
		}
		const onDragStart = () => setIsDragging(true);
		const onDragEnd = () => setIsDragging(false);
		dom.addEventListener("pointerover", onOver);
		dom.addEventListener("pointerleave", onLeave);
		window.addEventListener("dragstart", onDragStart);
		window.addEventListener("dragend", onDragEnd);
		window.addEventListener("drop", onDragEnd);
		return () => {
			dom.removeEventListener("pointerover", onOver);
			dom.removeEventListener("pointerleave", onLeave);
			window.removeEventListener("dragstart", onDragStart);
			window.removeEventListener("dragend", onDragEnd);
			window.removeEventListener("drop", onDragEnd);
		};
	}, [editor]);

	useLayoutEffect(() => {
		const menu = menuRef.current;
		if (!menu || !image) return;
		const picture = image.querySelector("img") ?? image;
		const place = () => placeMenu(menu, editor.view, picture);
		place();
		const observer = new ResizeObserver(place);
		observer.observe(editor.view.dom);
		observer.observe(picture);
		observer.observe(image);
		editor.on("transaction", place);
		window.addEventListener("resize", place);
		return () => {
			observer.disconnect();
			editor.off("transaction", place);
			window.removeEventListener("resize", place);
		};
	}, [editor, image, field]);

	if (!container || !image) return null;

	function setAlign(align) {
		editor.chain().focus().setNodeSelection(target.pos).updateAttributes("image", { align }).run();
	}

	function editField(name) {
		editor.chain().setNodeSelection(target.pos).run();
		setField(name);
	}

	function saveField(value) {
		value = value.trim();
		editor.chain().command(({ tr }) => Boolean(tr.setNodeAttribute(target.pos, field, value || (field === "link" ? null : "")))).run();
	}

	function finishField() {
		setField(null);
		setIsFocusInside(false);
		editor.chain().focus().setNodeSelection(target.pos).run();
	}

	function adjustmentEvents(name) {
		return {
			onPointerDown(event) {
				if (event.button !== 0) return;
				suppressAdjustmentClick.current = false;
				const picture = image.querySelector("img") ?? image;
				adjustment.current = { x: event.clientX, y: event.clientY, start: Number(target[name]) || 0, picture, moved: false };
				event.currentTarget.setPointerCapture(event.pointerId);
			},
			onPointerMove(event) {
				const drag = adjustment.current;
				if (!drag) return;
				const horizontal = event.clientX - drag.x;
				const vertical = drag.y - event.clientY;
				const delta = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
				if (!drag.moved && Math.abs(delta) < 3) return;
				drag.moved = true;
				drag.value = String(Math.max(0, Math.min(999, Math.round(drag.start + delta))));
				drag.picture.dataset[name === "radius" ? "imageRadius" : "imageSpacing"] = drag.value;
				if (menuRef.current) placeMenu(menuRef.current, editor.view, drag.picture);
			},
			onLostPointerCapture() {
				const drag = adjustment.current;
				adjustment.current = null;
				if (!drag?.moved) return;
				const attribute = name === "radius" ? "imageRadius" : "imageSpacing";
				if (target[name] == null) delete drag.picture.dataset[attribute];
				else drag.picture.dataset[attribute] = target[name];
			},
			onPointerUp() {
				const drag = adjustment.current;
				if (drag?.moved) {
					editor.commands.command(({ tr }) => Boolean(tr.setNodeAttribute(target.pos, name, drag.value)));
					suppressAdjustmentClick.current = true;
					adjustment.current = null;
				}
			},
			onClick(event) {
				if (event.detail === 0 || !suppressAdjustmentClick.current) editField(name);
				suppressAdjustmentClick.current = false;
			},
		};
	}

	function remove() {
		deleteBlock(editor, target.pos);
		setHovered(null);
	}

	return createPortal(
		<div
			ref={menuRef}
			onPointerLeave={(event) => !adjustment.current && !isInside(editor.view.dom, event.relatedTarget) && setHovered(null)}
			onFocus={() => setIsFocusInside(true)}
			onBlur={(event) => !isInside(event.currentTarget, event.relatedTarget) && setIsFocusInside(false)}
			className="absolute top-0 left-0 z-20 animate-in duration-150 fade-in-0"
		>
			<div className="flex items-center gap-0.5 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
				{field ? (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const input = event.currentTarget.elements.namedItem(field);
							const value = field === "link" ? normalizeUrl(input.value) : input.value;
							if (field === "link" && value && (!/^https?:\/\//i.test(value) || !URL.canParse(value))) {
								input.setCustomValidity("Enter a valid web address");
								input.reportValidity();
								return;
							}
							saveField(value);
							finishField();
						}}
						onMouseDown={(event) => event.target instanceof HTMLInputElement || event.preventDefault()}
						className="flex items-center gap-0.5"
					>
						<span className="pl-2 text-xs font-semibold text-muted-foreground">{FIELD_LABELS[field]}</span>
						<input
							name={field}
							type="text"
							inputMode={field === "link" ? "url" : undefined}
							pattern={field === "radius" || field === "spacing" ? "[0-9]{1,3}" : undefined}
							onInput={(event) => event.currentTarget.setCustomValidity("")}
							autoFocus
							defaultValue={target[field] ?? ""}
							placeholder={field === "link" ? "https://example.com" : field === "alt" ? "Describe this picture" : "0 px"}
							aria-label={FIELD_LABELS[field]}
							onKeyDown={(event) => event.key === "Escape" && finishField()}
							onBlur={(event) => {
								if (field === "alt") saveField(event.currentTarget.value);
								setField(null);
							}}
							className="h-8 w-56 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
						/>
						<ButtonFormat label="Done" type="submit">
							<CornerDownLeft />
						</ButtonFormat>
					</form>
				) : (
					// Clicks keep the editor's focus, and its selection, as the format menu's do.
					<div onMouseDown={(event) => event.preventDefault()} className="flex items-center gap-0.5">
						{ALIGNMENTS.map(({ value, label, icon: Icon }) => (
							<ButtonFormat key={value} label={label} isActive={target.align === value} onClick={() => setAlign(value)}>
								<Icon />
							</ButtonFormat>
						))}
						<span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
						<ButtonFormat label={target.alt ? `Alt text: ${target.alt}` : "Add alt text"} isActive={Boolean(target.alt)} onClick={() => editField("alt")}>
							<span className="text-xs font-semibold">Alt</span>
						</ButtonFormat>
						{target.link ? (
							<ButtonEditorLink href={target.link} label="Image link" onClick={() => editField("link")}
								className="max-sm:size-8 max-sm:justify-center max-sm:px-0 max-sm:[&>span]:hidden"
							/>
						) : (
							<ButtonFormat label="Image link" onClick={() => editField("link")}><Link2 /></ButtonFormat>
						)}
						<ButtonFormat label="Corner radius" style={{ cursor: "move", touchAction: "none" }}
							onPointerDown={(event) => adjustmentEvents("radius").onPointerDown(event)}
							onPointerMove={(event) => adjustmentEvents("radius").onPointerMove(event)}
							onPointerUp={() => adjustmentEvents("radius").onPointerUp()}
							onLostPointerCapture={() => adjustmentEvents("radius").onLostPointerCapture()}
							onClick={(event) => adjustmentEvents("radius").onClick(event)}>
							<SquareRoundCorner aria-hidden="true" />
						</ButtonFormat>
						<ButtonFormat label="Vertical spacing" style={{ cursor: "move", touchAction: "none" }}
							onPointerDown={(event) => adjustmentEvents("spacing").onPointerDown(event)}
							onPointerMove={(event) => adjustmentEvents("spacing").onPointerMove(event)}
							onPointerUp={() => adjustmentEvents("spacing").onPointerUp()}
							onLostPointerCapture={() => adjustmentEvents("spacing").onLostPointerCapture()}
							onClick={(event) => adjustmentEvents("spacing").onClick(event)}>
							<MoveVertical aria-hidden="true" />
						</ButtonFormat>
						<ButtonFormat label="Duplicate image" onClick={() => {
							const tr = duplicateBlock(editor.state, target.pos);
							if (tr) editor.view.dispatch(tr);
						}}>
							<Copy aria-hidden="true" />
						</ButtonFormat>
						<ButtonFormat label="Delete image" onClick={remove}>
							<Trash2 />
						</ButtonFormat>
					</div>
				)}
			</div>
		</div>,
		container
	);
}

// The picture being edited from the toolbar, else the one under the pointer, else the selected one while the editor has
// the focus.
function getTarget(editor, hovered, isFocusInside) {
	if (!editor.isEditable) return null;
	const { selection, doc } = editor.state;
	const selected = selection instanceof NodeSelection && selection.node.type.name === "image" ? selection.from : null;
	const isPinned = isFocusInside && !editor.isFocused && selected !== null;
	const pos = isPinned ? selected : (getImagePos(editor.view, hovered) ?? (editor.isFocused ? selected : null));
	const node = pos === null ? null : doc.nodeAt(pos);
	return node?.type.name === "image" ? { pos, align: node.attrs.align, alt: node.attrs.alt ?? "", link: node.attrs.link, radius: node.attrs.radius, spacing: node.attrs.spacing } : null;
}

function getImagePos(view, element) {
	if (!element?.isConnected || !view.dom.contains(element)) return null;
	return view.posAtDOM(element, 0);
}

// Centered in the picture's top edge, and within the text column so the grip in the gutter stays free.
function placeMenu(menu, view, image) {
	const parent = menu.offsetParent?.getBoundingClientRect();
	if (!parent) return;
	const picture = image.getBoundingClientRect();
	const editor = view.dom.getBoundingClientRect();
	const style = getComputedStyle(view.dom);
	const columnLeft = editor.left + Number.parseFloat(style.paddingLeft);
	const columnRight = editor.right - Number.parseFloat(style.paddingRight);
	const width = menu.offsetWidth;
	const left = Math.max(columnLeft, Math.min(picture.left + (picture.width - width) / 2, columnRight - width));
	menu.style.transform = `translate(${Math.round(left - parent.left)}px, ${Math.round(picture.top - parent.top + INSET)}px)`;
}

function isInside(element, node) {
	return Boolean(element) && node instanceof Node && element.contains(node);
}

const FIELD_LABELS = { alt: "Alt text", link: "Image link", radius: "Corner radius", spacing: "Vertical spacing" };
const INSET = 8;
// Also a button's (components/MenuButton.jsx).
export const ALIGNMENTS = [
	{ value: "left", label: "Align left", icon: AlignLeft },
	{ value: "center", label: "Center", icon: AlignCenter },
	{ value: "right", label: "Align right", icon: AlignRight },
];
