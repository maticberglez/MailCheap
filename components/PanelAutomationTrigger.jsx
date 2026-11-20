"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FLOW_TRIGGERS } from "@/lib/welcome-flow";

export default function PanelAutomationTrigger({ flow, onChange, onClose }) {
	const filters = flow.triggerFilters ?? (flow.entryTag ? [flow.entryTag] : []);
	const update = (values) => onChange({ ...flow, ...values });
	const setFilters = (triggerFilters) => update({ triggerFilters, entryTag: "" });

	return (
		<section className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<h2 className="font-medium">Trigger settings</h2>
				<Button type="button" size="icon" variant="ghost" aria-label="Close trigger settings" onClick={onClose}><X /></Button>
			</div>
			<label className="grid gap-1 text-sm">
				Trigger
				<select value={flow.trigger ?? "subscribe"} onChange={(event) => update({ trigger: event.target.value })}
					className="h-9 rounded-md border bg-background px-3">
					<option value="subscribe">Subscriber joins</option>
					<option value="tag">Contact tag added</option>
				</select>
			</label>
			{flow.trigger === "tag" && (
				<label className="grid gap-1 text-sm">Trigger tag
					<Input placeholder={FLOW_TRIGGERS.tag} value={flow.triggerTag ?? ""} onChange={(event) => update({ triggerTag: event.target.value })} />
				</label>
			)}
			<fieldset className="grid gap-2 border-t pt-3">
				<legend className="text-sm font-medium">Trigger filters</legend>
				{filters.map((tag, index) => (
					<div key={index} className="flex gap-2">
						<Input aria-label={`Required tag ${index + 1}`} placeholder="Required contact tag" value={tag}
							onChange={(event) => setFilters(filters.map((value, i) => i === index ? event.target.value : value))} />
						<Button type="button" variant="ghost" size="icon" aria-label={`Remove filter ${index + 1}`}
							onClick={() => setFilters(filters.filter((_, i) => i !== index))}><X /></Button>
					</div>
				))}
				<Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setFilters([...filters, ""])}><Plus /> Add trigger filter</Button>
			</fieldset>
			<label className="grid gap-1 border-t pt-3 text-sm">Exit when tagged
				<Input placeholder="No exit condition" value={flow.exitTag ?? ""} onChange={(event) => update({ exitTag: event.target.value })} />
			</label>
		</section>
	);
}
