"use client";

import { useRef, useState } from "react";
import { Clock, GitBranch, Grip, Pencil, LogOut, Mail, Repeat, Trash2 } from "lucide-react";
import EditorRich from "@/components/EditorRich";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_FLOW_STEPS, simulateWelcomeFlow } from "@/lib/welcome-flow";

const TYPES = {
	email: { label: "Email", icon: Mail },
	delay: { label: "Delay", icon: Clock, field: "Hours" },
	filter: { label: "Tag split", icon: GitBranch, field: "Contact tag" },
	repeat: { label: "Repeat twice", icon: Repeat },
	exit: { label: "Exit", icon: LogOut },
};
const NODE_WIDTH = 240;
const NODE_HEIGHT = 112;
const EMAIL_FIELDS = [["value", "Subject"], ["previewText", "Preview text"], ["fromName", "Sender name"], ["fromEmail", "Sender email"], ["replyTo", "Reply to"]];

function nodePosition(node, index) {
	return { x: node.x ?? 32 + index % 3 * 294, y: node.y ?? 32 + Math.floor(index / 3) * 164 };
}

const EMPTY = { nodes: [], entryTag: "", exitTag: "" };

export default function FormWelcomeFlow({ storageKey }) {
	const [flow, setFlow] = useState(EMPTY);
	const [loaded, setLoaded] = useState(false);
	const [tags, setTags] = useState("");
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");
	const [selectedId, setSelectedId] = useState(null);
	const [connecting, setConnecting] = useState(null);
	const [emailId, setEmailId] = useState(null);
	const [position, setPosition] = useState(null);
	const drag = useRef(null);
	const selectedNode = flow.nodes.find(({ id }) => id === selectedId);
	const editingEmail = flow.nodes.find(({ id }) => id === emailId);
	const positions = new Map(flow.nodes.map((node, index) => [node.id, position?.id === node.id ? position : nodePosition(node, index)]));
	const canvasWidth = Math.max(720, ...[...positions.values()].map(({ x }) => x + NODE_WIDTH + 48));
	const canvasHeight = Math.max(320, ...[...positions.values()].map(({ y }) => y + NODE_HEIGHT + 48));

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
		setSelectedId(id);
	}

	function update(id, values) {
		change({ ...flow, nodes: flow.nodes.map((node) => node.id === id ? { ...node, ...values } : node) });
	}

	function selectNode(id) {
		if (connecting && connecting.id !== id) {
			update(connecting.id, { [connecting.key]: id });
			setConnecting(null);
		}
		setSelectedId(id);
	}

	function port(node, key, label) {
		const active = connecting?.id === node.id && connecting.key === key;
		return <button type="button" title={label} aria-label={label} aria-pressed={active}
			onClick={() => setConnecting(active ? null : { id: node.id, key })}
			className={`absolute -right-2 size-4 rounded-full border-2 border-background ${active ? "bg-primary ring-2 ring-ring" : "bg-muted-foreground"} ${key === "next" ? "top-8" : "top-[68px]"}`} />;
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
					<div className="max-h-[65vh] overflow-auto rounded-xl border bg-muted/30">
						<div className="relative bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px]" style={{ width: canvasWidth, height: canvasHeight }}>
							<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
								{flow.nodes.flatMap((node) => ["next", "other"].map((key) => {
									const from = positions.get(node.id);
									const to = positions.get(node[key]);
									if (!to) return null;
									const x = from.x + NODE_WIDTH;
									const y = from.y + (key === "next" ? 40 : 76);
									const endY = to.y + NODE_HEIGHT / 2;
									const bend = Math.max(32, Math.abs(to.x - x) / 2);
									return <path key={`${node.id}-${key}`} d={`M ${x} ${y} C ${x + bend} ${y}, ${to.x - bend} ${endY}, ${to.x} ${endY}`} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={key === "other" ? "5 4" : undefined} className="text-muted-foreground" />;
								}))}
							</svg>
							{flow.nodes.map((node, index) => {
								const { label, icon: Icon } = TYPES[node.type];
								const { x, y } = positions.get(node.id);
								return (
									<article key={node.id} className={`absolute space-y-2 rounded-xl border bg-card p-3 shadow-sm ${selectedId === node.id ? "ring-2 ring-ring" : ""}`} style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
										<div className="flex items-center gap-2">
											<button type="button" aria-label={`Select or move step ${index + 1}`} className="touch-none cursor-grab rounded text-muted-foreground active:cursor-grabbing"
												onClick={() => setSelectedId(node.id)}
												onPointerDown={(event) => {
													if (event.button !== 0) return;
													drag.current = { x, y, startX: event.clientX, startY: event.clientY };
													event.currentTarget.setPointerCapture(event.pointerId);
													setSelectedId(node.id);
												}}
												onPointerMove={(event) => {
													if (!drag.current) return;
													const { x, y, startX, startY } = drag.current;
													setPosition({ id: node.id, x: Math.max(8, x + event.clientX - startX), y: Math.max(8, y + event.clientY - startY) });
												}}
												onPointerUp={(event) => {
													const start = drag.current;
													if (start) update(node.id, { x: Math.max(8, start.x + event.clientX - start.startX), y: Math.max(8, start.y + event.clientY - start.startY) });
												}}
												onLostPointerCapture={() => { drag.current = null; setPosition(null); }}
											><Grip className="size-4" /></button>
											<button type="button" onClick={() => selectNode(node.id)} className="flex flex-1 items-center gap-1.5 text-left text-sm font-medium"><Icon className="size-4" />{index + 1}. {label}</button>
											{node.type === "email" && <Button variant="ghost" size="sm" onClick={() => setEmailId(node.id)}><Pencil /> Edit</Button>}
										</div>
										<p className="truncate text-sm text-muted-foreground">{node.value ? node.type === "delay" ? `${node.value} h` : node.value : node.type === "email" ? "Untitled email" : ""}</p>
										{node.type === "email" && <dl aria-label="Email analytics" className="grid grid-cols-3 border-t pt-1 text-xs text-muted-foreground">
											{["Revenue", "Opened", "Clicked"].map((label) => <div key={label}><dt>{label}</dt><dd aria-label="No data">—</dd></div>)}
										</dl>}
										{node.type !== "exit" && port(node, "next", `Connect step ${index + 1} ${node.type === "filter" ? "if tag matches" : "to next step"}`)}
										{(node.type === "filter" || node.type === "repeat") && port(node, "other", `Connect step ${index + 1} ${node.type === "filter" ? "otherwise" : "to repeat from"}`)}
									</article>
								);
							})}
							{!flow.nodes.length && <p className="p-8 text-sm text-muted-foreground">Add a node to start your flow.</p>}
						</div>
					</div>
					{connecting && <div role="status" className="flex items-center gap-2 text-sm">Select a destination node. <Button variant="ghost" size="sm" onClick={() => setConnecting(null)}>Cancel</Button></div>}
					{selectedNode && <section className="space-y-3 rounded-xl border bg-card p-4">
						<div className="flex items-center justify-between">
							<h2 className="font-medium">{TYPES[selectedNode.type].label} settings</h2>
							<Button size="icon" variant="ghost" aria-label="Delete selected node" onClick={() => {
								const id = selectedNode.id;
								change({ ...flow, nodes: flow.nodes.filter((node) => node.id !== id).map((node) => ({
									...node, next: node.next === id ? "" : node.next, other: node.other === id ? "" : node.other,
								})) });
								setSelectedId(null);
								setConnecting(null);
							}}><Trash2 /></Button>
						</div>
						{TYPES[selectedNode.type].field && <label className="grid gap-1 text-sm">{TYPES[selectedNode.type].field}<Input type={selectedNode.type === "delay" ? "number" : "text"} min={0} value={selectedNode.value} onChange={(event) => update(selectedNode.id, { value: event.target.value })} /></label>}
						{selectedNode.type !== "exit" && connection(selectedNode, "next", selectedNode.type === "filter" ? "If tag matches" : "Next step")}
						{selectedNode.type === "filter" && connection(selectedNode, "other", "Otherwise")}
						{selectedNode.type === "repeat" && connection(selectedNode, "other", "Repeat from")}
					</section>}
					<Dialog open={Boolean(editingEmail)} onOpenChange={(open) => !open && setEmailId(null)}>
						<DialogContent className="sm:max-w-3xl">
							<DialogTitle>Edit automation email</DialogTitle>
							<DialogDescription>Changes save to this browser draft.</DialogDescription>
							{editingEmail && <>
								<div className="grid gap-3 sm:grid-cols-2">
									{EMAIL_FIELDS.map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<Input value={editingEmail[key] ?? ""} type={key === "fromEmail" || key === "replyTo" ? "email" : "text"} onChange={(event) => update(editingEmail.id, { [key]: event.target.value })} /></label>)}
								</div>
								<div className="overflow-hidden rounded-lg border">
									<EditorRich key={editingEmail.id} content={editingEmail.html ?? ""} onChange={(html) => update(editingEmail.id, { html })} minHeight="min-h-64" />
								</div>
							</>}
						</DialogContent>
					</Dialog>
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
