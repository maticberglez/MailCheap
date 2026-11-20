import { FLOW_TRIGGERS } from "@/lib/welcome-flow";

export default function SelectAutomationTrigger({ value, onChange }) {
	return (
		<select value={value} onChange={(event) => onChange(event.target.value)}
			className="h-9 rounded-md border bg-background px-3">
			<optgroup label="Contact">
				{Object.entries(FLOW_TRIGGERS).filter(([, trigger]) => !trigger.commerce)
					.map(([id, trigger]) => <option key={id} value={id}>{trigger.label}</option>)}
			</optgroup>
			<optgroup label="E-commerce">
				{Object.entries(FLOW_TRIGGERS).filter(([, trigger]) => trigger.commerce)
					.map(([id, trigger]) => <option key={id} value={id}>{trigger.label}</option>)}
			</optgroup>
		</select>
	);
}
