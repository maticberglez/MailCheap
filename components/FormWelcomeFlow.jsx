"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Clock, Copy, Focus, GitBranch, Pencil, Play, LogOut, Mail, Minus, Plus, MessageSquare, Repeat, Trash2, X } from "lucide-react";
import { sendAutomationTest } from "@/app/(app)/automations/actions";
import { renderEmail } from "@/lib/render-email";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_FLOW_STEPS, connectFlowNodes, flowConnectionPath, nearestFlowInput, orientFlowConnection, resistCanvasPan, reverseWireLane, simulateWelcomeFlow, zoomCanvasAround } from "@/lib/welcome-flow";

const TYPES = {
	email: { label: "Email", icon: Mail },
	sms: { label: "SMS", icon: MessageSquare },
	delay: { label: "Delay", icon: Clock, field: "Hours" },
	filter: { label: "Fork", icon: GitBranch, field: "Contact tag" },
	repeat: { label: "Repeat twice", icon: Repeat },
	exit: { label: "Exit", icon: LogOut },
};
const NODE_WIDTH = 240;
const NODE_HEIGHT = 112;
const PAN_MARGIN = 220;
const TOOL_BUTTON = "h-11 min-w-0 justify-start rounded-xl border-border bg-card px-2.5 text-sm font-medium shadow-sm hover:bg-muted sm:w-36 sm:px-3 [&_svg]:size-5";
const EMAIL_FIELDS = [
	["value", "Subject", "Welcome to our newsletter"],
	["previewText", "Preview text", "A quick hello and what to expect"],
	["fromName", "Sender name", "Your newsletter name"],
];

function AddressField({ label, placeholder, options, value, onChange }) {
	return (
		<label className="grid gap-1 text-sm">
			{label}
			<select className="h-9 w-full min-w-0 rounded-md border bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)}>
				<option value="">{placeholder}</option>
				{value && !options.includes(value) && <option value={value} disabled>{value} (unavailable)</option>}
				{options.map((email) => <option key={email} value={email}>{email}</option>)}
			</select>
		</label>
	);
}

function EmailNodePreview({ node, addresses, editHref }) {
	const [isSending, startSending] = useTransition();
	const [result, setResult] = useState("");
	const { html } = renderEmail({
		format: "rich", html: node.html ?? "", subject: node.value, previewText: node.previewText,
		newsletter: { name: addresses.senderName, fromName: node.fromName || addresses.senderName },
	});

	function send() {
		startSending(async () => {
			setResult("");
			try {
				const result = await sendAutomationTest({
					newsletterId: addresses.newsletterId, subject: node.value || "", previewText: node.previewText || "",
					fromName: node.fromName || "", fromEmail: node.fromEmail || "", replyTo: node.replyTo || "", html: node.html || "",
				});
				setResult(result.sent ? `Test sent to ${result.to}.` : result.error);
			} catch {
				setResult("Could not send the test email.");
			}
		});
	}

	return (
		<div className="space-y-2">
			<div className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-muted/30">
				{node.html ? <iframe title="Email preview" sandbox="" srcDoc={html} className="absolute inset-0 block size-full bg-white" />
					: <p className="p-4 text-sm text-muted-foreground">Add content to see a preview.</p>}
			</div>
			<div className="grid grid-cols-2 gap-2">
				<Button variant="outline" size="sm" disabled={isSending || !node.value?.trim() || !node.html || !addresses.testRecipient}
					title={`Send to ${addresses.testRecipient}`} onClick={send}><Mail />{isSending ? "Sending…" : "Send test to me"}</Button>
				<Button size="sm" asChild><Link href={editHref}><Pencil /> Edit email</Link></Button>
			</div>
			{result && <p role="status" className="text-sm text-muted-foreground">{result}</p>}
		</div>
	);
}

function nodePosition(node, index) {
	return { x: node.x ?? 56, y: node.y ?? 32 + index * 176 };
}

function outputX(node, key) {
	if (node.type !== "filter" && node.type !== "repeat") return NODE_WIDTH / 2;
	return key === "next" ? NODE_WIDTH / 3 : NODE_WIDTH * 2 / 3;
}

function subscribeToDraft(listener) {
	window.addEventListener("storage", listener);
	window.addEventListener("pageshow", listener);
	return () => {
		window.removeEventListener("storage", listener);
		window.removeEventListener("pageshow", listener);
	};
}

export default function FormWelcomeFlow({ storageKey, initialFlow, editPath, selectedNodeId, addresses }) {
	const stored = useSyncExternalStore(subscribeToDraft, () => {
		try { return localStorage.getItem(storageKey); } catch { return null; }
	}, () => null);
	const flow = useMemo(() => {
		try { return stored === null ? initialFlow : JSON.parse(stored); } catch { return initialFlow; }
	}, [stored, initialFlow]);
	const [tags, setTags] = useState("");
	const [isSimulationOpen, setIsSimulationOpen] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");
	const [selectedId, setSelectedId] = useState(selectedNodeId);
	const [deleteId, setDeleteId] = useState(null);
	const [connecting, setConnecting] = useState(null);
	const wireGesture = useRef(null);
	const suppressWireClick = useRef(false);
	const [wire, setWire] = useState(null);
	const [placement, setPlacement] = useState(null);
	const [position, setPosition] = useState(null);
	const drag = useRef(null);
	const moved = useRef(false);
	const canvas = useRef(null);
	const viewport = useRef(null);
	const panDrag = useRef(null);
	const [pan, setPan] = useState(() => {
		const index = Math.max(0, initialFlow.nodes.findIndex(({ id }) => id === selectedNodeId));
		const first = nodePosition(initialFlow.nodes[index] ?? {}, index);
		return { x: 56 - first.x, y: 32 - first.y };
	});
	const [isPanning, setIsPanning] = useState(false);
	const [zoom, setZoom] = useState(1);
	const selectedNode = flow.nodes.find(({ id }) => id === selectedId);
	const deletingNode = flow.nodes.find(({ id }) => id === deleteId);
	const positions = new Map(flow.nodes.map((node, index) => [node.id, position?.id === node.id ? position : nodePosition(node, index)]));
	const savedPositions = flow.nodes.map(nodePosition);

	function panWithinFlow(x, y, elastic = false, scale = zoom) {
		const { clientWidth, clientHeight } = viewport.current;
		const points = savedPositions.length ? savedPositions : [{ x: 56, y: 32 }];
		const left = Math.min(...points.map((point) => point.x));
		const top = Math.min(...points.map((point) => point.y));
		const right = Math.max(...points.map((point) => point.x + NODE_WIDTH));
		const bottom = Math.max(...points.map((point) => point.y + NODE_HEIGHT));
		const constrain = elastic ? resistCanvasPan : (value, min, max) => Math.max(min, Math.min(max, value));
		return {
			x: constrain(x, Math.min(56 - left * scale, clientWidth - right * scale) - PAN_MARGIN, Math.max(-left * scale, (clientWidth - NODE_WIDTH * scale) / 2 - points[0].x * scale) + PAN_MARGIN),
			y: constrain(y, Math.min(32 - top * scale, clientHeight - bottom * scale) - PAN_MARGIN, -top * scale + PAN_MARGIN),
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

	function changeZoom(next, anchor) {
		if (!viewport.current || drag.current || panDrag.current || wireGesture.current || placement) return;
		const value = Math.max(0.5, Math.min(1.6, Math.round(next * 100) / 100));
		const { clientWidth, clientHeight } = viewport.current;
		const point = zoomCanvasAround(pan, zoom, value, anchor?.x ?? clientWidth / 2, anchor?.y ?? clientHeight / 2);
		setZoom(value);
		setPan(panWithinFlow(point.x, point.y, false, value));
	}

	const zoomByWheel = useEffectEvent((event) => {
		event.preventDefault();
		const bounds = viewport.current.getBoundingClientRect();
		const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
		changeZoom(zoom * Math.exp(-delta * 0.002), { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
	});

	useEffect(() => {
		const element = viewport.current;
		const onWheel = (event) => zoomByWheel(event);
		element?.addEventListener("wheel", onWheel, { passive: false });
		return () => element?.removeEventListener("wheel", onWheel);
	}, []);

	function canvasPoint(clientX, clientY) {
		const { left, top, width } = canvas.current.getBoundingClientRect();
		const scale = width / canvas.current.clientWidth || zoom;
		return { x: (clientX - left) / scale, y: (clientY - top) / scale };
	}

	function revealNode({ x, y }) {
		if (!viewport.current) return;
		setPan({ x: (viewport.current.clientWidth - NODE_WIDTH * zoom) / 2 - x * zoom, y: 32 - y * zoom });
	}

	function startMove(event, id, x, y) {
		if (event.button !== 0 || drag.current || panDrag.current || !canvas.current) return;
		const point = canvasPoint(event.clientX, event.clientY);
		moved.current = false;
		drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: point.x - x, offsetY: point.y - y };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function move(event) {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId || !canvas.current) return;
		if (!moved.current && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 4) return;
		moved.current = true;
		const view = viewport.current.getBoundingClientRect();
		const start = canvasPoint(view.left + 12, view.top + 12);
		const end = canvasPoint(view.right - 12, view.bottom - 12);
		const point = canvasPoint(event.clientX, event.clientY);
		const x = Math.max(start.x, Math.min(end.x - NODE_WIDTH, point.x - current.offsetX));
		const y = Math.max(start.y, Math.min(end.y - NODE_HEIGHT, point.y - current.offsetY));
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


	function change(next) {
		setResult(null);
		try {
			localStorage.setItem(storageKey, JSON.stringify({ ...next, updatedAt: new Date().toISOString() }));
			window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
			setError("");
		} catch {
			setError("Could not save this browser draft");
		}
	}

	function placementPoint(clientX, clientY) {
		const view = viewport.current.getBoundingClientRect();
		const start = canvasPoint(view.left + 8, view.top + 8);
		const end = canvasPoint(view.right - 8, view.bottom - 8);
		const point = canvasPoint(clientX, clientY);
		return {
			x: Math.max(start.x, Math.min(end.x - NODE_WIDTH, point.x - NODE_WIDTH / 2)),
			y: Math.max(start.y, Math.min(end.y - NODE_HEIGHT, point.y - 18)),
		};
	}

	function add(type, source = null) {
		if (flow.nodes.length >= MAX_FLOW_STEPS || !viewport.current) return;
		const bounds = viewport.current.getBoundingClientRect();
		setConnecting(null);
		setPlacement({ type, source, ...placementPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) });
	}

	function place(point) {
		const { type, source } = placement;
		const node = { value: type === "delay" ? "24" : "", ...source, id: crypto.randomUUID(), type, ...point, next: "", other: "" };
		change({ ...flow, nodes: [...flow.nodes, node] });
		setPlacement(null);
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

	function connectPorts(first, second) {
		const connection = orientFlowConnection(first, second);
		if (!connection) return false;
		change(connectFlowNodes(flow, connection.sourceId, connection.output, connection.destinationId));
		setConnecting(null);
		return true;
	}

	function startWire(event, node, key) {
		if (event.button !== 0 || drag.current || panDrag.current || placement) return;
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
		const { x, y } = canvasPoint(event.clientX, event.clientY);
		const reverse = gesture.key === "input";
		const points = flow.nodes.filter((node) => node.id !== gesture.id).flatMap((node) => {
			const point = positions.get(node.id);
			if (!reverse) return [{ id: node.id, key: "input", x: point.x + NODE_WIDTH / 2, y: point.y }];
			if (node.type === "exit") return [];
			const outputs = node.type === "filter" || node.type === "repeat" ? ["next", "other"] : ["next"];
			return outputs.map((key) => ({ id: node.id, key, x: point.x + outputX(node, key), y: point.y + NODE_HEIGHT }));
		});
		const target = nearestFlowInput(points, x, y, 28 / zoom);
		const node = flow.nodes.find(({ id }) => id === gesture.id);
		const point = positions.get(gesture.id);
		const fixed = { x: point.x + (reverse ? NODE_WIDTH / 2 : outputX(node, gesture.key)), y: point.y + (reverse ? 0 : NODE_HEIGHT) };
		const free = target ?? { x, y };
		const preview = { id: gesture.id, key: gesture.key, target, from: reverse ? free : fixed, to: reverse ? fixed : free,
			lane: target ? reverseWireLane(point.x, positions.get(target.id).x, NODE_WIDTH) : undefined };

		setWire(preview);
		return preview;
	}

	function finishWire(event) {
		const preview = trackWire(event);
		if (!preview) return;
		if (preview.target) connectPorts(preview, preview.target);
		setConnecting(null);
		setWire(null);
	}

	function port(node, key, label) {
		const isInput = key === "input";
		const active = (connecting?.id === node.id && connecting.key === key) || (wire?.id === node.id && wire.key === key);
		const snapped = wire?.target?.id === node.id && wire.target.key === key;
		return <button type="button" title={label} aria-label={label} aria-pressed={active}
			onPointerDown={(event) => startWire(event, node, key)}
			onPointerMove={(event) => trackWire(event)}
			onPointerUp={finishWire}
			onLostPointerCapture={() => { wireGesture.current = null; setWire(null); }}
			onClick={(event) => {
				if (event.detail !== 0 && suppressWireClick.current) return;
				setSelectedId(null);
				const endpoint = { id: node.id, key };
				if (!connectPorts(connecting, endpoint)) setConnecting(active ? null : endpoint);
			}}
			className={`absolute size-4 cursor-crosshair touch-none -translate-x-1/2 rounded-full border-2 border-background hover:ring-2 hover:ring-ring ${isInput ? "-top-2" : "-bottom-2"} ${active || snapped ? "bg-primary ring-2 ring-ring" : "bg-muted-foreground"}`}
			style={{ left: isInput ? NODE_WIDTH / 2 : outputX(node, key) }} />;
	}

	return (
		<div className="relative" onKeyDown={(event) => {
			if (event.key === "Escape" && (placement || connecting)) {
				setPlacement(null);
				setConnecting(null);
				return;
			}
			if (event.key !== "Backspace" || event.defaultPrevented || event.isComposing || !selectedNode || deleteId ||
				event.target.closest("input, textarea, select, [contenteditable]")) return;
			event.preventDefault();
			setDeleteId(selectedNode.id);
		}}>
			<div className="grid h-[calc(100dvh-var(--plan-bar-height)-6.75rem)] min-h-80 min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none md:h-[calc(100dvh-var(--plan-bar-height)-3.25rem)] lg:grid-cols-[auto_minmax(0,1fr)_min(32rem,var(--node-settings-width))] lg:grid-rows-1"
				style={{ "--node-settings-width": selectedNode ? "42%" : "0%" }}>
				<div role="toolbar" aria-label="Automation tools" className="flex min-h-0 flex-col items-stretch gap-1.5 overflow-y-auto p-1.5 sm:p-3">
					{Object.entries(TYPES).filter(([type]) => type !== "repeat").map(([type, { label, icon: Icon }]) => (
						<Button key={type} variant="outline" className={TOOL_BUTTON} title={label} aria-label={`Add ${label.toLowerCase()} node`} disabled={flow.nodes.length >= MAX_FLOW_STEPS} onClick={() => add(type)}>
							<Icon aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
						</Button>
					))}
					<Button variant="outline" className={TOOL_BUTTON} title="Back to start" aria-label="Back to start" onClick={() => revealNode(savedPositions[0] ?? { x: 56, y: 32 })}>
						<Focus aria-hidden="true" /><span className="hidden sm:inline">Back to start</span>
					</Button>
					<Button variant="outline" className={TOOL_BUTTON} title="Simulate flow" aria-label="Simulate flow" onClick={() => setIsSimulationOpen(true)}>
						<Play aria-hidden="true" /><span className="hidden sm:inline">Simulate</span>
					</Button>
				</div>
				<div ref={viewport} aria-label="Automation playground" className={`relative isolate min-w-0 min-h-0 touch-none overflow-clip bg-background bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] ${placement ? "cursor-crosshair" : isPanning ? "cursor-grabbing select-none" : "cursor-grab transition-[background-position] duration-300 ease-out motion-reduce:transition-none"}`}
					style={{ backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${16 * zoom}px ${16 * zoom}px` }}
					onPointerDown={(event) => {
						if (placement && event.target === event.currentTarget && event.button === 0) place(placementPoint(event.clientX, event.clientY));
						else startPan(event);
					}}
					onPointerMove={(event) => {
						if (placement) setPlacement({ ...placement, ...placementPoint(event.clientX, event.clientY) });
						else movePan(event);
					}} onPointerUp={finishPan} onPointerCancel={finishPan} onLostPointerCapture={finishPan}>
					<div ref={canvas} className={`pointer-events-none absolute inset-0 origin-top-left ${isPanning ? "" : "transition-transform duration-300 ease-out motion-reduce:transition-none"}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
						<svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
							{flow.nodes.flatMap((node) => ["next", "other"].map((key) => {
								const from = positions.get(node.id);
								const to = positions.get(node[key]);
								if (!to || (wire?.id === node.id && wire.key === key)) return null;
								const x = from.x + outputX(node, key);
								const y = from.y + NODE_HEIGHT;
								const endX = to.x + NODE_WIDTH / 2;
								const endY = to.y;
								return <path key={`${node.id}-${key}`} d={flowConnectionPath(x, y, endX, endY, reverseWireLane(from.x, to.x, NODE_WIDTH))} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={key === "other" ? "5 4" : undefined} className="text-muted-foreground" />;
							}))}
							{wire && <path d={flowConnectionPath(wire.from.x, wire.from.y, wire.to.x, wire.to.y, wire.lane)}
								fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary" />}
						</svg>
						{flow.nodes.map((node, index) => {
							const { label, icon: Icon } = TYPES[node.type];
							const { x, y } = positions.get(node.id);
							return (
								<article key={node.id} className={`group ${placement ? "" : "pointer-events-auto"} absolute space-y-2 rounded-xl border bg-card p-3 shadow-sm ${selectedId === node.id ? "ring-2 ring-ring" : ""}`} style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
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
										<Button variant="ghost" size="icon-sm" aria-label={`Duplicate step ${index + 1}`} title="Duplicate node"
											disabled={flow.nodes.length >= MAX_FLOW_STEPS}
											className="relative opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
											onClick={() => add(node.type, node)}><Copy aria-hidden="true" /></Button>

									</div>
									<p className="pointer-events-none truncate text-sm text-muted-foreground">{node.value ? node.type === "delay" ? `${node.value} h` : node.value : node.type === "email" ? "Untitled email" : node.type === "sms" ? "No message yet" : ""}</p>
									{node.type === "email" && <dl aria-label="Email analytics" className="pointer-events-none grid grid-cols-3 border-t pt-1 text-xs text-muted-foreground">
										{["Revenue", "Opened", "Clicked"].map((label) => <div key={label}><dt>{label}</dt><dd aria-label="No data">—</dd></div>)}
									</dl>}
									{index === 0 && <span className="pointer-events-none absolute -top-6 left-0 rounded bg-background px-1.5 text-xs font-medium text-muted-foreground">Subscriber joins</span>}
									{port(node, "input", `Input for step ${index + 1}`)}
									{node.type !== "exit" && port(node, "next", `Connect step ${index + 1} ${node.type === "filter" ? "if tag matches" : "to next step"}`)}
									{(node.type === "filter" || node.type === "repeat") && port(node, "other", `Connect step ${index + 1} ${node.type === "filter" ? "otherwise" : "to repeat from"}`)}
								</article>
							);
						})}
						{placement && <div aria-hidden="true" className="absolute rounded-xl border border-dashed border-primary bg-card/90 p-3 text-sm font-medium shadow-sm" style={{ left: placement.x, top: placement.y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
							{TYPES[placement.type].label}
						</div>}
						{!flow.nodes.length && !placement && <p className="p-8 text-sm text-muted-foreground">Add a node to start your flow.</p>}
					</div>
					<div className="absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm">
						<Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => changeZoom(zoom - 0.1)}><Minus /></Button>
						<Button variant="ghost" size="sm" aria-label="Reset zoom" onClick={() => changeZoom(1)}>{Math.round(zoom * 100)}%</Button>
						<Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 1.6} onClick={() => changeZoom(zoom + 0.1)}><Plus /></Button>
					</div>
					{placement && <div role="status" className="absolute right-2 bottom-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-1 text-sm shadow-sm">
						Click the canvas to place the node.
						<Button variant="outline" size="sm" onClick={() => place({ x: placement.x, y: placement.y })}>Place node</Button>
						<Button variant="ghost" size="sm" onClick={() => setPlacement(null)}>Cancel</Button>
					</div>}
					{connecting && <div role="status" className="absolute right-2 bottom-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-1 text-sm shadow-sm">Select {connecting.key === "input" ? "an output dot" : "an input dot"}. <Button variant="ghost" size="sm" onClick={() => setConnecting(null)}>Cancel</Button></div>}
				</div>
				<div className={`col-span-2 min-h-0 min-w-0 overflow-hidden lg:col-span-1 ${selectedNode ? "block" : "hidden lg:block"}`} inert={!selectedNode}>
					<aside aria-label="Node settings" aria-hidden={!selectedNode}
						className={`m-2 max-h-[40dvh] min-w-0 overflow-y-auto rounded-2xl bg-card shadow-float ring-1 ring-foreground/10 transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none sm:m-3 lg:max-h-[calc(100%_-_1.5rem)] ${selectedNode ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}>
						{selectedNode && <section className="space-y-3 p-4">
							<div className="flex items-center gap-1">
								<h2 className="mr-auto font-medium">{TYPES[selectedNode.type].label} settings</h2>
								<Button size="icon" variant="ghost" aria-label="Delete selected node" onClick={() => setDeleteId(selectedNode.id)}><Trash2 /></Button>
								<Button size="icon" variant="ghost" aria-label="Close node settings" onClick={() => setSelectedId(null)}><X /></Button>
							</div>
							{TYPES[selectedNode.type].field && <label className="grid gap-1 text-sm">{TYPES[selectedNode.type].field}<Input type={selectedNode.type === "delay" ? "number" : "text"} min={0} value={selectedNode.value} onChange={(event) => update(selectedNode.id, { value: event.target.value })} /></label>}
							{selectedNode.type === "sms" && <label className="grid gap-1 text-sm">
								Message
								<textarea className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
									value={selectedNode.value} onChange={(event) => update(selectedNode.id, { value: event.target.value })} />
							</label>}
							{(selectedNode.next || selectedNode.other) && <div className="flex flex-wrap gap-2">
								{selectedNode.next && <Button size="sm" variant="outline" onClick={() => update(selectedNode.id, { next: "" })}>Disconnect {selectedNode.type === "filter" ? "match" : "next"}</Button>}
								{selectedNode.other && <Button size="sm" variant="outline" onClick={() => update(selectedNode.id, { other: "" })}>Disconnect {selectedNode.type === "filter" ? "otherwise" : "repeat"}</Button>}
							</div>}
							{selectedNode.id === flow.nodes[0]?.id && <fieldset className="grid gap-3 border-b pb-3">
								<legend className="mb-2 text-sm font-medium">Trigger · Subscriber joins</legend>
								<label className="grid gap-1 text-sm">Required entry tag<Input placeholder="Any subscriber" value={flow.entryTag} onChange={(event) => change({ ...flow, entryTag: event.target.value })} /></label>
								<label className="grid gap-1 text-sm">Exit if tagged<Input placeholder="For example, customer" value={flow.exitTag} onChange={(event) => change({ ...flow, exitTag: event.target.value })} /></label>
							</fieldset>}
							{selectedNode.type === "email" && <>
								<div className="grid gap-3">
									{EMAIL_FIELDS.map(([key, label, placeholder]) => <label key={key} className="grid gap-1 text-sm">
										{label}<Input value={selectedNode[key] ?? ""} placeholder={key === "fromName" ? addresses.senderName || placeholder : placeholder}
											onChange={(event) => update(selectedNode.id, { [key]: event.target.value })} />
									</label>)}
									<AddressField label="Sender email" placeholder={addresses.sender || "Select a sender address"} options={addresses.fromEmails}
										value={selectedNode.fromEmail ?? ""} onChange={(fromEmail) => update(selectedNode.id, { fromEmail })} />
									<AddressField label="Reply to" placeholder="Use the sender address" options={addresses.replyEmails}
										value={selectedNode.replyTo ?? ""} onChange={(replyTo) => update(selectedNode.id, { replyTo })} />
								</div>
								<EmailNodePreview key={selectedNode.id} node={selectedNode} addresses={addresses} editHref={`${editPath}/${selectedNode.id}`} />
							</>}
						</section>}
					</aside>
				</div>
			</div>

			<Dialog open={isSimulationOpen} onOpenChange={setIsSimulationOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogTitle>Simulate flow</DialogTitle>
					<DialogDescription>Try the flow with sample contact tags. Simulation sends no messages.</DialogDescription>
					<section className="space-y-3 rounded-xl border bg-card p-4">
						<label className="grid gap-1 text-sm">Sample contact tags<Input placeholder="vip, customer" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
						<Button onClick={() => setResult(simulateWelcomeFlow(flow, tags.split(",").map((tag) => tag.trim())))}>Simulate flow</Button>
						{result && <div aria-live="polite" className="space-y-2 text-sm">
							<ol className="list-inside list-decimal">{result.path.map((step, index) => <li key={index}>{TYPES[step.type].label}{step.value && ` · ${step.value}`} · +{step.hours} h</li>)}</ol>
							<p>{result.reason}</p>
						</div>}
					</section>
				</DialogContent>
			</Dialog>
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
