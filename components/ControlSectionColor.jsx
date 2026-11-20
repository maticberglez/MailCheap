"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { hsvToHex, normalizeHexColor, toHsv } from "@/lib/colors";

const clamp = (value) => Math.min(1, Math.max(0, value));

export default function ControlSectionColor({ label, color, onChange, onClear }) {
	const [text, setText] = useState(null);
	const [invalid, setInvalid] = useState(false);
	const [selection, setSelection] = useState(null);
	const hsv = selection?.color === color ? selection.hsv : toHsv(color);

	function pick(next) {
		const hex = hsvToHex(next);
		setSelection({ color: hex, hsv: next });
		setText(null);
		setInvalid(false);
		if (hex !== color) onChange(hex);
	}

	function pickPoint(event) {
		const rect = event.currentTarget.getBoundingClientRect();
		pick({ ...hsv, saturation: clamp((event.clientX - rect.left) / rect.width), value: clamp(1 - (event.clientY - rect.top) / rect.height) });
	}

	function commitHex() {
		if (text === null) return;
		const hex = normalizeHexColor(text);
		setInvalid(!hex);
		if (!hex) return;
		setText(null);
		setSelection(null);
		onChange(hex);
	}

	return (
		<fieldset className="grid min-w-0 gap-3 rounded-lg border bg-background p-3">
			<legend className="px-1 text-xs font-medium">{label}</legend>
			<div role="group" tabIndex={0}
				aria-label={`Color box, saturation ${Math.round(hsv.saturation * 100)} percent, brightness ${Math.round(hsv.value * 100)} percent`}
				className="relative h-32 touch-none cursor-crosshair rounded-md ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.hue} 100% 50%))` }}
				onPointerDown={(event) => {
					if (event.button !== 0) return;
					event.currentTarget.setPointerCapture(event.pointerId);
					pickPoint(event);
				}}
				onPointerMove={(event) => {
					if (event.currentTarget.hasPointerCapture(event.pointerId)) pickPoint(event);
				}}
				onKeyDown={(event) => {
					const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
					if (!direction) return;
					event.preventDefault();
					const [x, y] = direction;
					const step = event.shiftKey ? 0.1 : 0.01;
					pick({ ...hsv, saturation: clamp(hsv.saturation + x * step), value: clamp(hsv.value + y * step) });
				}}
			>
				<span aria-hidden="true" className="pointer-events-none absolute size-3.5 -translate-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_#0009]"
					style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.value) * 100}%` }}
				/>
			</div>
			<input aria-label="Hue" type="range" min="0" max="359" value={Math.floor(hsv.hue)}
				className="h-3 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,red,yellow,lime,cyan,blue,magenta,red)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-white"
				onChange={(event) => pick({ ...hsv, hue: Number(event.target.value) })}
			/>
			<div className="flex items-center gap-2">
				<span aria-hidden="true" className="size-8 shrink-0 rounded-md border" style={{ background: color }} />
				<Input aria-label={`${label} hex code`} aria-invalid={invalid} spellCheck={false} autoComplete="off"
					value={text ?? color} className="h-8 min-w-0 font-mono uppercase"
					onChange={(event) => { setText(event.target.value); setInvalid(false); }}
					onBlur={commitHex}
					onKeyDown={(event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						commitHex();
					}}
				/>
				{onClear && <button type="button" className="shrink-0 px-1 text-xs text-muted-foreground underline" onClick={() => {
					setText(null);
					setInvalid(false);
					onClear();
				}}>Clear</button>}
			</div>
			{invalid && <p role="alert" className="text-xs text-destructive">Enter a valid hex color, such as #1a2b3c.</p>}
		</fieldset>
	);
}
