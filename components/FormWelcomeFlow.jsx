"use client";

import { useState } from "react";
import { Clock, GitBranch, LogOut, Mail, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_FLOW_STEPS, simulateWelcomeFlow } from "@/lib/welcome-flow";

const TYPES = {
	email: { label: "Email", icon: Mail, field: "Subject" },
	delay: { label: "Delay", icon: Clock, field: "Hours" },
	filter: { label: "Tag split", icon: GitBranch, field: "Contact tag" },
	repeat: { label: "Repeat twice", icon: Repeat },
	exit: { label: "Exit", icon: LogOut },
};
const EMPTY = { nodes: [], entryTag: "", exitTag: "" };

export default function FormWelcomeFlow({ storageKey }) {
	const [flow, setFlow] = useState(EMPTY);
	const [loaded, setLoaded] = useState(false);
	const [tags, setTags] = useState("");
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");

	function load() {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) setFlow(JSON.parse(saved));
		} catch {
			setError("Could not open the saved draft");
		}
		setLoaded(true);
	}

	function change(next) {
		setFlow(next);
		setResult(null);
		try {
			localStorage.setItem(storageKey, JSON.stringify(next));
			setError("");
		} catch {
			setError("Could not save this browser draft");
		}
	}

	function add(type) {
		const id = crypto.randomUUID();
		const previous = flow.nodes.at(-1);
		const nodes = flow.nodes.map((node) => node === previous && node.type !== "exit" && !node.next ? { ...node, next: id } : node);
		change({ ...flow, nodes: [...nodes, { id, type, value: type === "delay" ? "24" : "", next: "", other: "" }] });
	}

	function update(id, values) {
		change({ ...flow, nodes: flow.nodes.map((node) => node.id === id ? { ...node, ...values } : node) });
	}

	function connection(node, key, label) {
		return (
			<label className="grid gap-1 text-sm">
				{label}
				<select className="h-9 rounded-md border bg-background px-2" value={node[key]} onChange={(event) => update(node.id, { [key]: event.target.value })}>
					<option value="">End flow</option>
					{flow.nodes.map((item, index) => item.id !== node.id && <option key={item.id} value={item.id}>{index + 1}. {TYPES[item.type].label}</option>)}
				</select>
			</label>
		);
	}

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">Draft and simulate a welcome flow in this browser. Simulation sends no email.</p>
			{!loaded ? <Button onClick={load}>Open welcome flow draft</Button> : (
				<>
					<section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
						<h2 className="font-medium sm:col-span-2">Trigger · Subscriber joins</h2>
						<label className="grid gap-1 text-sm">Required entry tag<Input value={flow.entryTag} onChange={(event) => change({ ...flow, entryTag: event.target.value })} /></label>
						<label className="grid gap-1 text-sm">Exit if tagged<Input value={flow.exitTag} onChange={(event) => change({ ...flow, exitTag: event.target.value })} /></label>
					</section>
					{flow.nodes.map((node, index) => {
						const { label, icon: Icon, field } = TYPES[node.type];
						return (
							<div key={node.id} className="space-y-3">
								<section className="space-y-3 rounded-xl border bg-card p-4">
									<div className="flex items-center justify-between">
										<h2 className="flex items-center gap-2 text-sm font-medium"><Icon aria-hidden="true" className="size-4" />{index + 1}. {label}</h2>
										<Button size="icon" variant="ghost" aria-label={`Delete step ${index + 1}`} onClick={() => change({
											...flow,
											nodes: flow.nodes.filter((item) => item.id !== node.id).map((item) => ({
												...item, next: item.next === node.id ? "" : item.next, other: item.other === node.id ? "" : item.other,
											})),
										})}><Trash2 /></Button>
									</div>
									{field && <label className="grid gap-1 text-sm">{field}<Input type={node.type === "delay" ? "number" : "text"} min={0} value={node.value} onChange={(event) => update(node.id, { value: event.target.value })} /></label>}
									{node.type !== "exit" && connection(node, "next", node.type === "filter" ? "If tag matches" : "Next step")}
									{node.type === "filter" && connection(node, "other", "Otherwise")}
									{node.type === "repeat" && connection(node, "other", "Repeat from")}
								</section>
							</div>
						);
					})}
					<div className="flex flex-wrap gap-2">{Object.entries(TYPES).map(([type, { label }]) => <Button key={type} variant="outline" disabled={flow.nodes.length >= MAX_FLOW_STEPS} onClick={() => add(type)}>Add {label.toLowerCase()}</Button>)}</div>
					<section className="space-y-3 rounded-xl border bg-card p-4">
						<label className="grid gap-1 text-sm">Sample contact tags<Input placeholder="vip, customer" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
						<Button onClick={() => setResult(simulateWelcomeFlow(flow, tags.split(",").map((tag) => tag.trim())))}>Simulate flow</Button>
						{result && <div aria-live="polite" className="space-y-2 text-sm">
							<ol className="list-inside list-decimal">{result.path.map((step, index) => <li key={index}>{TYPES[step.type].label}{step.value && ` · ${step.value}`} · +{step.hours} h</li>)}</ol>
							<p>{result.reason}</p>
						</div>}
					</section>
				</>
			)}
			{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
