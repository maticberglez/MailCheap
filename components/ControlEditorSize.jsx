"use client";

import { useEffect, useRef, useState } from "react";

export default function ControlEditorSize({ icon: Icon, label, min, max, value, getFallback, onChange, onPreview }) {
	const input = useRef(null);
	const drag = useRef(null);
	const didDrag = useRef(false);
	const [draft, setDraft] = useState(null);
	const clamp = (number) => Math.max(min, Math.min(max, Math.round(number)));

	useEffect(() => {
		const field = input.current;
		function adjustWithWheel(event) {
			if (document.activeElement !== field || event.ctrlKey || !event.deltaY) return;
			event.preventDefault();
			const start = field.value === "" ? getFallback?.() ?? min : field.valueAsNumber;
			const next = Math.max(min, Math.min(max, Math.round(start - Math.sign(event.deltaY))));
			setDraft(null);
			onChange(next);
		}
		field.addEventListener("wheel", adjustWithWheel, { passive: false });
		return () => field.removeEventListener("wheel", adjustWithWheel);
	}, [getFallback, min, max, onChange]);

	function commitDraft() {
		if (draft == null || drag.current) return;
		setDraft(null);
		onChange(draft === "" ? null : clamp(Number(draft)));
	}

	function finish(event, commit) {
		const current = drag.current;
		if (current?.id !== event.pointerId) return;
		drag.current = null;
		if (current.value == null) return;
		onPreview?.(null);
		setDraft(null);
		if (commit) onChange(current.value);
	}

	return (
		<div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-1.5">
			<button
				type="button"
				aria-label={`Adjust ${label.toLowerCase()}`}
				title={`Drag to adjust ${label.toLowerCase()}, or click to type`}
				className="grid size-8 shrink-0 touch-none cursor-ew-resize place-items-center rounded-md bg-muted text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
				onPointerDown={(event) => {
					if (event.button !== 0 || !event.isPrimary) return;
					didDrag.current = false;
					drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: clamp(value ?? getFallback?.() ?? min) };
					event.currentTarget.setPointerCapture(event.pointerId);
				}}
				onPointerMove={(event) => {
					const current = drag.current;
					if (current?.id !== event.pointerId) return;
					const x = event.clientX - current.x;
					const y = current.y - event.clientY;
					const delta = Math.abs(x) >= Math.abs(y) ? x : y;
					if (current.value == null && Math.abs(delta) < 3) return;
					const next = clamp(current.start + delta);
					if (next === current.value) return;
					didDrag.current = true;
					current.value = next;
					setDraft(String(next));
					onPreview?.(next);
				}}
				onPointerUp={(event) => finish(event, true)}
				onLostPointerCapture={(event) => finish(event, false)}
				onClick={(event) => {
					if (event.detail && didDrag.current) return;
					input.current?.focus();
					input.current?.select();
				}}
			>
				<Icon aria-hidden="true" className="size-4" />
			</button>
			<label className="min-w-0 flex-1">
				<span className="block text-xs font-medium">{label}</span>
				<input
					ref={input}
					type="number"
					min={min}
					max={max}
					value={draft ?? value ?? ""}
					placeholder="Auto"
					className="w-full bg-transparent text-sm tabular-nums outline-none focus-visible:underline"
					onChange={(event) => setDraft(event.target.value)}
					onBlur={commitDraft}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							commitDraft();
						}
					}}
				/>
			</label>
			<span aria-hidden="true" className="pr-1 text-xs text-muted-foreground">px</span>
		</div>
	);
}
