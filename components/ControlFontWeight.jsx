import { ChevronDown } from "lucide-react";
import { FONT_WEIGHTS, readFontWeight } from "@/lib/font-weight";

export default function ControlFontWeight({ value, onChange }) {
	return (
		<label className="grid gap-1 text-sm">
			Font weight
			<span className="relative">
				<select value={value ?? ""} onChange={(event) => onChange(readFontWeight(event.target.value))}
					className="h-9 w-full appearance-none rounded-lg border bg-background py-1 pl-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="">Default</option>
					{FONT_WEIGHTS.map(([weight, label]) => <option key={weight} value={weight}>{label}</option>)}
				</select>
				<ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			</span>
		</label>
	);
}
