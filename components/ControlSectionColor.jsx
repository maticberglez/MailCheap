"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizeHexColor, toChannels, toHex } from "@/lib/colors";

const CHANNELS = ["Red", "Green", "Blue"];

export default function ControlSectionColor({ label, color, onChange, onClear }) {
	const [text, setText] = useState(null);
	const [invalid, setInvalid] = useState(false);
	const channels = toChannels(color);

	function commitHex() {
		if (text === null) return;
		const hex = normalizeHexColor(text);
		setInvalid(!hex);
		if (!hex) return;
		setText(null);
		onChange(hex);
	}

	function colorAt(index, value) {
		return toHex(channels.map((channel, at) => at === index ? value : channel));
	}

	return (
		<fieldset className="grid min-w-0 gap-3 rounded-lg border bg-background p-3">
			<legend className="px-1 text-xs font-medium">{label}</legend>
			{CHANNELS.map((channel, index) => (
				<label key={channel} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2 text-xs">
					{channel}
					<input
						type="range" min="0" max="255" value={channels[index]}
						className="h-2 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-white"
						style={{ background: `linear-gradient(to right, ${colorAt(index, 0)}, ${colorAt(index, 255)})` }}
						onChange={(event) => {
							setText(null);
							setInvalid(false);
							onChange(colorAt(index, Number(event.target.value)));
						}}
					/>
				</label>
			))}
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
