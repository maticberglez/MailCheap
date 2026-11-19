"use client";

import { useRef, useState } from "react";
import { Clock, Focus, GitBranch, Pencil, LogOut, Mail, Repeat, Trash2, X } from "lucide-react";
import EditorRich from "@/components/EditorRich";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_FLOW_STEPS, connectFlowNodes, flowConnectionPath, nearestFlowInput, resistCanvasPan, simulateWelcomeFlow } from "@/lib/welcome-flow";

const TYPES = {
	email: { label: "Email", icon: Mail },
	delay: { label: "Delay", icon: Clock, field: "Hours" },
	filter: { label: "Fork", icon: GitBranch, field: "Contact tag" },
	repeat: { label: "Repeat twice", icon: Repeat },
	exit: { label: "Exit", icon: LogOut },
};
const NODE_WIDTH = 240;
const NODE_HEIGHT = 112;
const PAN_MARGIN = 220;
const EMAIL_FIELDS = [["value", "Subject"], ["previewText", "Preview text"], ["fromName", "Sender name"], ["fromEmail", "Sender email"], ["replyTo", "Reply to"]];

function nodePosition(node, index) {
	return { x: node.x ?? 56, y: node.y ?? 32 + index * 176 };
}

function outputX(node, key) {
	if (node.type !== "filter" && node.type !== "repeat") return NODE_WIDTH / 2;
	return key === "next" ? NODE_WIDTH / 3 : NODE_WIDTH * 2 / 3;
}

const EMPTY = { nodes: [], entryTag: "", exitTag: "" };

export default function FormWelcomeFlow({ storageKey }) {
	const [flow, setFlow] = useState(EMPTY);
	const [loaded, setLoaded] = useState(false);
	const [tags, setTags] = useState("");
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");
	const [selectedId, setSelectedId] = useState(null);
	const [deleteId, setDeleteId] = useState(null);
	const [connecting, setConnecting] = useState(null);
	const wireGesture = useRef(null);
	const suppressWireClick = useRef(false);
	const [wire, setWire] = useState(null);
	const [position, setPosition] = useState(null);
	const drag = useRef(null);
	const moved = useRef(false);
	const canvas = useRef(null);
	const viewport = useRef(null);
	const panDrag = useRef(null);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const selectedNode = flow.nodes.find(({ id }) => id === selectedId);
	const deletingNode = flow.nodes.find(({ id }) => id === deleteId);
	const positions = new Map(flow.nodes.map((node, index) => [node.id, position?.id === node.id ? position : nodePosition(node, index)]));
	const savedPositions = flow.nodes.map(nodePosition);

	function panWithinFlow(x, y, elastic = false) {
		const { clientWidth, clientHeight } = viewport.current;
		const points = savedPositions.length ? savedPositions : [{ x: 56, y: 32 }];
		const left = Math.min(...points.map((point) => point.x));
		const top = Math.min(...points.map((point) => point.y));
		const right = Math.max(...points.map((point) => point.x + NODE_WIDTH));
		const bottom = Math.max(...points.map((point) => point.y + NODE_HEIGHT));
		const constrain = elastic ? resistCanvasPan : (value, min, max) => Math.max(min, Math.min(max, value));
		return {
			x: constrain(x, Math.min(56 - left, clientWidth - right) - PAN_MARGIN, -left + PAN_MARGIN),
			y: constrain(y, Math.min(32 - top, clientHeight - bottom) - PAN_MARGIN, -top + PAN_MARGIN),
		};
	}

	function startPan(event) {
		if (event.target !== event.currentTarget || event.button !== 0 || drag.current || panDrag.current || wireGesture.current) return;
		const transform = new DOMMatrix(getComputedStyle(canvas.current).transform);
		setPan({ x: transform.m41, y: transform.m42 });
		panDrag.current = { pointerId: event.pointerId, x: event.clientX - transform.m41, y: event.clientY - transform.m42 };
		event.currentTarget.setPointerCapture(event.pointerId);
		setIsPanning(true);
	}

	function movePan(event) {
		const start = panDrag.current;
		if (start?.pointerId !== event.pointerId) return;
		setPan(panWithinFlow(event.clientX - start.x, event.clientY - start.y, true));
	}

	function finishPan(event) {
		if (panDrag.current?.pointerId !== event.pointerId) return;
		panDrag.current = null;
		setIsPanning(false);
		setPan((point) => panWithinFlow(point.x, point.y));
	}

	function revealNode({ x, y }) {
		if (!viewport.current) return;
		setPan({ x: Math.min(56, Math.max(12, (viewport.current.clientWidth - NODE_WIDTH) / 2)) - x, y: 32 - y });
	}

	function startMove(event, id, x, y) {
		if (event.button !== 0 || drag.current || panDrag.current || !canvas.current) return;
		const bounds = canvas.current.getBoundingClientRect();
		moved.current = false;
		drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - bounds.left - x, offsetY: event.clientY - bounds.top - y };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function move(event) {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId || !canvas.current) return;
		if (!moved.current && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
		moved.current = true;
		const bounds = canvas.current.getBoundingClientRect();
		const x = Math.max(12 - pan.x, Math.min(viewport.current.clientWidth - NODE_WIDTH - 12 - pan.x, event.clientX - bounds.left - current.offsetX));
		const y = Math.max(12 - pan.y, Math.min(viewport.current.clientHeight - NODE_HEIGHT - 12 - pan.y, event.clientY - bounds.top - current.offsetY));
		current.position = { id: current.id, x, y };
		setPosition(current.position);
	}

	function finishMove(event, save) {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId) return;
		drag.current = null;
		if (save && current.position) {
			const { id, x, y } = current.position;
			update(id, { x, y });
		}
		setPosition(null);
	}


	function load() {
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const draft = JSON.parse(saved);
				setFlow(draft);
				if (draft.nodes.length) {
					const first = nodePosition(draft.nodes[0], 0);
					setPan({ x: 56 - first.x, y: 32 - first.y });
				}
			}
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
		const x = 56;
		const y = Math.max(-144, ...savedPositions.map((point) => point.y)) + 176;
		change({ ...flow, nodes: [...flow.nodes, { id, type, x, y, value: type === "delay" ? "24" : "", next: "", other: "" }] });
		setSelectedId(null);
		revealNode({ x, y });
	}

	function update(id, values) {
		change({ ...flow, nodes: flow.nodes.map((node) => node.id === id ? { ...node, ...values } : node) });
	}

	function confirmDelete() {
		change({ ...flow, nodes: flow.nodes.filter(({ id }) => id !== deleteId).map((node) => ({
			...node,
			next: node.next === deleteId ? "" : node.next,
			other: node.other === deleteId ? "" : node.other,
		})) });
		setDeleteId(null);
		setSelectedId(null);
		setConnecting(null);
	}

	function connectTo(id) {
		if (connecting && connecting.id !== id) {
			change(connectFlowNodes(flow, connecting.id, connecting.key, id));
			setConnecting(null);
		}
	}

	function startWire(event, node, key) {
		if (event.button !== 0 || drag.current || panDrag.current) return;
		suppressWireClick.current = false;
		wireGesture.current = { id: node.id, key, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
		event.currentTarget.setPointerCapture(event.pointerId);
		setSelectedId(null);
	}

	function trackWire(event) {
		const gesture = wireGesture.current;
		if (!gesture || gesture.pointerId !== event.pointerId) return null;
		if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 3) return null;
		gesture.moved = true;
		suppressWireClick.current = true;
		const bounds = canvas.current.getBoundingClientRect();
		const x = event.clientX - bounds.left;
		const y = event.clientY - bounds.top;
		const inputs = [...positions].filter(([id]) => id !== gesture.id).map(([id, point]) => ({ id, x: point.x + NODE_WIDTH / 2, y: point.y }));
		const target = nearestFlowInput(inputs, x, y);
		const preview = { id: gesture.id, key: gesture.key, x: target?.x ?? x, y: target?.y ?? y, targetId: target?.id };
		setWire(preview);
		return preview;
	}

	function finishWire(event) {
		const preview = trackWire(event);
		if (!preview) return;
		if (preview.targetId) change(connectFlowNodes(flow, preview.id, preview.key, preview.targetId));
		setConnecting(null);
		setWire(null);
	}

	function port(node, key, label) {
		const active = (connecting?.id === node.id && connecting.key === key) || (wire?.id === node.id && wire.key === key);
		return <button type="button" title={label} aria-label={label} aria-pressed={active}
			onPointerDown={(event) => startWire(event, node, key)}
			onPointerMove={(event) => trackWire(event)}
			onPointerUp={finishWire}
			onLostPointerCapture={() => { wireGesture.current = null; setWire(null); }}
			onClick={(event) => {
				if (event.detail !== 0 && suppressWireClick.current) return;
				setSelectedId(null);
				setConnecting(active ? null : { id: node.id, key });
			}}
			className={`absolute -bottom-2 size-4 cursor-crosshair touch-none -translate-x-1/2 rounded-full border-2 border-background hover:ring-2 hover:ring-ring ${active ? "bg-primary ring-2 ring-ring" : "bg-muted-foreground"}`} style={{ left: outputX(node, key) }} />;
	}

	return (
		<div className="space-y-4" onKeyDown={(event) => {
			if (event.key !== "Backspace" || event.defaultPrevented || event.isComposing || !selectedNode || deleteId ||
				event.target.closest("input, textarea, select, [contenteditable]")) return;
			event.preventDefault();
			setDeleteId(selectedNode.id);
		}}>
			<p className="px-3 text-sm text-muted-foreground">Draft and simulate a welcome flow in this browser. Simulation sends no email.</p>
			{!loaded ? <Button onClick={load}>Open welcome flow draft</Button> : (
				<>
					<div className="flex flex-wrap gap-2 px-3">{Object.entries(TYPES).map(([type, { label, icon: Icon }]) => <Button key={type} variant="outline" size="sm" disabled={flow.nodes.length >= MAX_FLOW_STEPS} onClick={() => add(type)}><Icon aria-hidden="true" />{label}</Button>)}
						<Button variant="ghost" size="sm" onClick={() => revealNode(savedPositions[0] ?? { x: 56, y: 32 })}><Focus aria-hidden="true" /> Back to start</Button>
					</div>
					<div className="grid min-w-0 border-y transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none lg:grid-cols-[minmax(0,1fr)_var(--node-settings-width)]" style={{ "--node-settings-width": selectedNode ? "min(32rem, 42%)" : "0px" }}>
						<div ref={viewport} aria-label="Automation playground" className={`relative isolate min-w-0 h-[calc(100dvh-7rem)] min-h-96 touch-none overflow-clip bg-muted/30 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] ${isPanning ? "cursor-grabbing select-none" : "cursor-grab transition-[background-position] duration-300 ease-out motion-reduce:transition-none"}`}
							style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
							onPointerDown={startPan} onPointerMove={movePan} onPointerUp={finishPan} onPointerCancel={finishPan} onLostPointerCapture={finishPan}>
							<div ref={canvas} className={`pointer-events-none absolute inset-0 ${isPanning ? "" : "transition-transform duration-300 ease-out motion-reduce:transition-none"}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
								<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
									{flow.nodes.flatMap((node) => ["next", "other"].map((key) => {
										const from = positions.get(node.id);
										const to = positions.get(node[key]);
										if (!to || (wire?.id === node.id && wire.key === key)) return null;
										const x = from.x + outputX(node, key);
										const y = from.y + NODE_HEIGHT;
										const endX = to.x + NODE_WIDTH / 2;
										const endY = to.y;
										return <path key={`${node.id}-${key}`} d={flowConnectionPath(x, y, endX, endY, Math.min(from.x, to.x))} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={key === "other" ? "5 4" : undefined} className="text-muted-foreground" />;
									}))}
									{wire && positions.has(wire.id) && <path d={flowConnectionPath(
										positions.get(wire.id).x + outputX(flow.nodes.find(({ id }) => id === wire.id), wire.key),
										positions.get(wire.id).y + NODE_HEIGHT, wire.x, wire.y,
										Math.min(positions.get(wire.id).x, positions.get(wire.targetId)?.x ?? wire.x - NODE_WIDTH / 2)
									)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary" />}
								</svg>
								{flow.nodes.map((node, index) => {
									const { label, icon: Icon } = TYPES[node.type];
									const { x, y } = positions.get(node.id);
									return (
										<article key={node.id} className={`pointer-events-auto absolute space-y-2 rounded-xl border bg-card p-3 shadow-sm ${selectedId === node.id ? "ring-2 ring-ring" : ""}`} style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
											<div className="flex items-center gap-2">
												<button type="button" aria-label={`Select or move step ${index + 1}`} className="absolute inset-0 touch-none cursor-grab rounded-xl focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
													onClick={(event) => { if (event.detail === 0 || !moved.current) setSelectedId(node.id); }}
													onPointerDown={(event) => startMove(event, node.id, x, y)}
													onPointerMove={move}
													onPointerUp={(event) => { move(event); finishMove(event, true); }}
													onPointerCancel={(event) => finishMove(event, false)}
													onLostPointerCapture={(event) => finishMove(event, true)}
												/>
												<span className="pointer-events-none flex flex-1 items-center gap-1.5 text-sm font-medium"><Icon className="size-4" />{index + 1}. {label}</span>
												{node.type === "email" && <Button variant="ghost" size="sm" className="relative" onClick={() => setSelectedId(node.id)}><Pencil /> Edit</Button>}
											</div>
											<p className="pointer-events-none truncate text-sm text-muted-foreground">{node.value ? node.type === "delay" ? `${node.value} h` : node.value : node.type === "email" ? "Untitled email" : ""}</p>
											{node.type === "email" && <dl aria-label="Email analytics" className="pointer-events-none grid grid-cols-3 border-t pt-1 text-xs text-muted-foreground">
												{["Revenue", "Opened", "Clicked"].map((label) => <div key={label}><dt>{label}</dt><dd aria-label="No data">—</dd></div>)}
											</dl>}
											<button type="button" title="Input" aria-label={`Connect into step ${index + 1}`}
												disabled={!connecting || connecting.id === node.id}
												onClick={() => connectTo(node.id)}
												className={`absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full border-2 border-background enabled:hover:ring-2 enabled:hover:ring-ring ${wire?.targetId === node.id ? "bg-primary ring-2 ring-ring" : "bg-muted-foreground enabled:bg-primary"}`} />
											{node.type !== "exit" && port(node, "next", `Connect step ${index + 1} ${node.type === "filter" ? "if tag matches" : "to next step"}`)}
											{(node.type === "filter" || node.type === "repeat") && port(node, "other", `Connect step ${index + 1} ${node.type === "filter" ? "otherwise" : "to repeat from"}`)}
										</article>
									);
								})}
								{!flow.nodes.length && <p className="p-8 text-sm text-muted-foreground">Add a node to start your flow.</p>}
							</div>
						</div>
						<aside aria-label="Node settings" inert={!selectedNode} aria-hidden={!selectedNode}
							className={`min-w-0 overflow-y-auto bg-card lg:h-[calc(100dvh-7rem)] ${selectedNode ? "border-t lg:border-t-0 lg:border-l" : "hidden lg:block"}`}>
							{selectedNode && <section className="space-y-3 p-4">
								<div className="flex items-center gap-1">
									<h2 className="mr-auto font-medium">{TYPES[selectedNode.type].label} settings</h2>
									<Button size="icon" variant="ghost" aria-label="Delete selected node" onClick={() => setDeleteId(selectedNode.id)}><Trash2 /></Button>
									<Button size="icon" variant="ghost" aria-label="Close node settings" onClick={() => setSelectedId(null)}><X /></Button>
								</div>
								{TYPES[selectedNode.type].field && <label className="grid gap-1 text-sm">{TYPES[selectedNode.type].field}<Input type={selectedNode.type === "delay" ? "number" : "text"} min={0} value={selectedNode.value} onChange={(event) => update(selectedNode.id, { value: event.target.value })} /></label>}
								{(selectedNode.next || selectedNode.other) && <div className="flex flex-wrap gap-2">
									{selectedNode.next && <Button size="sm" variant="outline" onClick={() => update(selectedNode.id, { next: "" })}>Disconnect {selectedNode.type === "filter" ? "match" : "next"}</Button>}
									{selectedNode.other && <Button size="sm" variant="outline" onClick={() => update(selectedNode.id, { other: "" })}>Disconnect {selectedNode.type === "filter" ? "otherwise" : "repeat"}</Button>}
								</div>}
								{selectedNode.type === "email" && <>
									<div className="grid gap-3 sm:grid-cols-2">
										{EMAIL_FIELDS.map(([key, label]) => <label key={key} className="grid gap-1 text-sm">{label}<Input value={selectedNode[key] ?? ""} type={key === "fromEmail" || key === "replyTo" ? "email" : "text"} onChange={(event) => update(selectedNode.id, { [key]: event.target.value })} /></label>)}
									</div>
									<div className="overflow-hidden rounded-lg border">
										<EditorRich key={selectedNode.id} content={selectedNode.html ?? ""} onChange={(html) => update(selectedNode.id, { html })} minHeight="min-h-64" />
									</div>
								</>}
							</section>}
						</aside>
					</div>
					{connecting && <div role="status" className="flex items-center gap-2 text-sm">Select the destination’s input dot. <Button variant="ghost" size="sm" onClick={() => setConnecting(null)}>Cancel</Button></div>}
					<section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
						<h2 className="font-medium sm:col-span-2">Trigger · Subscriber joins</h2>
						<label className="grid gap-1 text-sm">Required entry tag<Input value={flow.entryTag} onChange={(event) => change({ ...flow, entryTag: event.target.value })} /></label>
						<label className="grid gap-1 text-sm">Exit if tagged<Input value={flow.exitTag} onChange={(event) => change({ ...flow, exitTag: event.target.value })} /></label>
					</section>
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
			<Dialog open={Boolean(deletingNode)} onOpenChange={(open) => !open && setDeleteId(null)}>
				<DialogContent>
					<DialogTitle>Delete {deletingNode ? TYPES[deletingNode.type].label.toLowerCase() : "node"}?</DialogTitle>
					<DialogDescription>This removes the node and its connections from the draft.</DialogDescription>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
						<Button variant="destructive" onClick={confirmDelete}>Delete node</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
