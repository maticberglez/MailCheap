"use client";

import PanelAutomationTrigger from "@/components/PanelAutomationTrigger";
import PreviewAutomationEmail from "@/components/PreviewAutomationEmail";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bell, Clock, Copy, FlaskConical, Tag, Zap, Focus, GitBranch, Play, LogOut, Mail, Minus, Plus, MessageSquare, Repeat, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FLOW_TRIGGERS, MAX_FLOW_STEPS, connectFlowNodes, flowConnectionPath, nearestFlowInput, orientFlowConnection, resistCanvasPan, reverseWireLane, simulateWelcomeFlow, zoomCanvasAround } from "@/lib/welcome-flow";

const TYPES = {
	email: { label: "Email", icon: Mail },
	sms: { label: "SMS", icon: MessageSquare },
	delay: { label: "Delay", icon: Clock, field: "Hours" },
	push: { label: "Push notification", icon: Bell },
	tag: { label: "Tag contact", icon: Tag, field: "Contact tag" },
	ab: { label: "A/B testing", icon: FlaskConical },
	filter: { label: "Split", icon: GitBranch, field: "Contact tag" },
	repeat: { label: "Repeat twice", icon: Repeat },
	exit: { label: "Exit", icon: LogOut },
};
const TOOL_GROUPS = [["Messages", ["email", "sms", "push"]], ["Flow actions", ["delay", "tag", "filter", "ab", "exit"]]];
const FIRST_NODE_TOP = 208;
const TRIGGER_DRAG = Symbol("trigger");
const TRIGGER_HEIGHT = 144;
const hasBranches = (type) => ["filter", "ab", "repeat"].includes(type);
const NODE_WIDTH = 240;
const NODE_HEIGHT = 148;
const PAN_MARGIN = 220;
const TOOL_BUTTON = "h-11 min-w-0 justify-start rounded-xl border-border bg-card px-2.5 text-sm font-medium shadow-sm hover:bg-muted sm:w-40 sm:px-3 [&_svg]:size-5";
function nodePosition(node, index) {
	return { x: node.x ?? 56, y: node.y ?? 32 + index * 176 };
}

function triggerAbove({ x, y }) {
	return { x, y: y - TRIGGER_HEIGHT - 16 };
}

function outputX(node, key) {
	if (!hasBranches(node.type)) return NODE_WIDTH / 2;
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
	const [variant, setVariant] = useState("a");
	const [sampleEvent, setSampleEvent] = useState(null);
	const [isTriggerOpen, setIsTriggerOpen] = useState(false);
	const [isSimulationOpen, setIsSimulationOpen] = useState(false);
	const [result, setResult] = useState(null);
	const [error, setError] = useState("");
	const [selectedId, setSelectedId] = useState(selectedNodeId);
	const [deleteId, setDeleteId] = useState(null);
	const [deleteWire, setDeleteWire] = useState(null);
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
	const [{ pan, zoom }, setCamera] = useState({ pan: { x: 0, y: 0 }, zoom: 1 });
	const [start] = useState(() => initialFlow.triggerPosition ?? triggerAbove(nodePosition(initialFlow.nodes[0] ?? {}, 0)));
	const setViewport = useCallback((element) => {
		viewport.current = element;
		if (!element) return;
		setCamera({ pan: { x: (element.clientWidth - NODE_WIDTH) / 2 - start.x, y: FIRST_NODE_TOP - TRIGGER_HEIGHT - 16 - start.y }, zoom: 1 });
	}, [start]);
	const [isPanning, setIsPanning] = useState(false);
	const [isWheelZooming, setIsWheelZooming] = useState(false);
	const wheelTimer = useRef(null);
	const selectedNode = flow.nodes.find(({ id }) => id === selectedId);
	const deletingNode = flow.nodes.find(({ id }) => id === deleteId);
	const positions = new Map(flow.nodes.map((node, index) => [node.id, position?.id === node.id ? position : nodePosition(node, index)]));
	const savedPositions = flow.nodes.map(nodePosition);
	const firstNode = flow.nodes[0];
	const firstPosition = firstNode ? positions.get(firstNode.id) : { x: 56, y: 32 };
	const triggerPosition = position?.id === TRIGGER_DRAG ? position : flow.triggerPosition ?? triggerAbove(firstPosition);
	const hasNodeSettings = Boolean(selectedNode && (
		TYPES[selectedNode.type].field || ["email", "sms", "push"].includes(selectedNode.type)
	));
	const hasSettings = hasNodeSettings || isTriggerOpen;
	const triggerText = flow.trigger === "tag" && flow.triggerTag
		? `receive the “${flow.triggerTag}” tag`
		: FLOW_TRIGGERS[flow.trigger] ?? FLOW_TRIGGERS.subscribe;

	function setPan(next) {
		setCamera((camera) => ({ ...camera, pan: typeof next === "function" ? next(camera.pan) : next }));
	}

	function panWithinFlow(x, y, elastic = false, scale = zoom) {
		const { clientWidth, clientHeight } = viewport.current;
		const points = [...savedPositions, triggerPosition];
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
		const { clientWidth, clientHeight } = viewport.current;
		setCamera((camera) => {
			const requested = typeof next === "function" ? next(camera.zoom) : next;
			const value = Math.max(0.5, Math.min(1.6, requested));
			if (value === camera.zoom) return camera;
			const point = zoomCanvasAround(camera.pan, camera.zoom, value, anchor?.x ?? clientWidth / 2, anchor?.y ?? clientHeight / 2);
			return { zoom: value, pan: panWithinFlow(point.x, point.y, false, value) };
		});
	}

	const zoomByWheel = useEffectEvent((event) => {
		if (!event.deltaY) return;
		const toolbar = event.target.closest("[role=toolbar]");
		if (toolbar && toolbar.scrollHeight > toolbar.clientHeight) return;
		event.preventDefault();
		const bounds = viewport.current.getBoundingClientRect();
		const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
		setIsWheelZooming(true);
		clearTimeout(wheelTimer.current);
		wheelTimer.current = setTimeout(() => setIsWheelZooming(false), 120);
		changeZoom((scale) => scale * Math.exp(-delta * 0.0015), { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
	});

	useEffect(() => {
		const element = viewport.current;
		const onWheel = (event) => zoomByWheel(event);
		element?.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			element?.removeEventListener("wheel", onWheel);
			clearTimeout(wheelTimer.current);
		};
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
		const y = Math.max(start.y, Math.min(end.y - (current.id === TRIGGER_DRAG ? TRIGGER_HEIGHT : NODE_HEIGHT), point.y - current.offsetY));
		current.position = { id: current.id, x, y };
		setPosition(current.position);
	}

	function finishMove(event, save) {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId) return;
		drag.current = null;
		if (save && current.position) {
			const { id, x, y } = current.position;
			if (id === TRIGGER_DRAG) change({ ...flow, triggerPosition: { x, y } });
			else update(id, { x, y });
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
		const preview = previewWire(gesture, { x, y });
		if (!preview) return null;
		setWire(preview);
		return preview;
	}

	function previewWire(endpoint, { x, y }) {
		const node = flow.nodes.find(({ id }) => id === endpoint.id);
		const origin = positions.get(endpoint.id);
		if (!node || !origin) return null;
		const reverse = endpoint.key === "input";
		const points = flow.nodes.filter((node) => node.id !== endpoint.id).flatMap((node) => {
			const point = positions.get(node.id);
			if (!reverse) return [{ id: node.id, key: "input", x: point.x + NODE_WIDTH / 2, y: point.y }];
			if (node.type === "exit") return [];
			const outputs = hasBranches(node.type) ? ["next", "other"] : ["next"];
			return outputs.map((key) => ({ id: node.id, key, x: point.x + outputX(node, key), y: point.y + NODE_HEIGHT }));
		});
		const target = nearestFlowInput(points, x, y, 28 / zoom);
		const fixed = { x: origin.x + (reverse ? NODE_WIDTH / 2 : outputX(node, endpoint.key)), y: origin.y + (reverse ? 0 : NODE_HEIGHT) };
		const free = target ?? { x, y };
		return { id: endpoint.id, key: endpoint.key, target, from: reverse ? free : fixed, to: reverse ? fixed : free,
			lane: target ? reverseWireLane(origin.x, positions.get(target.id).x, NODE_WIDTH) : undefined };
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
		const snapped = shownWire?.target?.id === node.id && shownWire.target.key === key;
		return <button type="button" title={label} aria-label={label} aria-pressed={active}
			onPointerDown={(event) => startWire(event, node, key)}
			onPointerMove={(event) => trackWire(event)}
			onPointerUp={finishWire}
			onLostPointerCapture={() => { wireGesture.current = null; setWire(null); }}
			onClick={(event) => {
				if (event.detail !== 0 && suppressWireClick.current) return;
				setSelectedId(null);
				const endpoint = { id: node.id, key };
				if (!connectPorts(connecting, endpoint)) setConnecting(active ? null : { ...endpoint, point: event.detail ? canvasPoint(event.clientX, event.clientY) : null });
			}}
			className={`absolute size-4 cursor-crosshair touch-none -translate-x-1/2 rounded-full border-2 border-background hover:ring-2 hover:ring-ring ${isInput ? "-top-2" : "-bottom-2"} ${active || snapped ? "bg-primary ring-2 ring-ring" : "bg-muted-foreground"}`}
			style={{ left: isInput ? NODE_WIDTH / 2 : outputX(node, key) }} />;
	}

	const shownWire = wire ?? (connecting?.point ? previewWire(connecting, connecting.point) : null);

	return (
		<div className="relative" onKeyDown={(event) => {
			if (event.key === "Escape" && (placement || connecting)) {
				setPlacement(null);
				setConnecting(null);
				return;
			}
			if (event.key !== "Backspace" || event.defaultPrevented || event.isComposing || !selectedNode || deleteId || deleteWire ||
				event.target.closest("input, textarea, select, [contenteditable]")) return;
			event.preventDefault();
			setDeleteId(selectedNode.id);
		}}>
			<div className="grid h-[calc(100dvh-var(--plan-bar-height)-6.75rem)] min-h-80 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none md:h-[calc(100dvh-var(--plan-bar-height)-3.25rem)] lg:grid-cols-[minmax(0,1fr)_min(32rem,var(--node-settings-width))] lg:grid-rows-1"
				style={{ "--node-settings-width": hasSettings ? "42%" : "0%" }}>
				<div ref={setViewport} aria-label="Automation playground" className={`relative isolate min-w-0 min-h-0 touch-none overflow-clip bg-background bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] ${placement ? "cursor-crosshair" : isPanning ? "cursor-grabbing select-none" : "cursor-grab"} ${isPanning ? "transition-none" : `transition-[background-position,background-size] ease-out motion-reduce:transition-none ${isWheelZooming ? "duration-100" : "duration-300"}`}`}
					style={{ backgroundPosition: `${pan.x}px ${pan.y}px`, backgroundSize: `${16 * zoom}px ${16 * zoom}px` }}
					onPointerDown={(event) => {
						if (placement && event.target === event.currentTarget && event.button === 0) place(placementPoint(event.clientX, event.clientY));
						else startPan(event);
					}}
					onPointerMove={(event) => {
						if (placement) setPlacement({ ...placement, ...placementPoint(event.clientX, event.clientY) });
						else if (connecting && !wireGesture.current && !panDrag.current) {
							const point = canvasPoint(event.clientX, event.clientY);
							setConnecting((current) => current && { ...current, point });
						} else movePan(event);
					}} onPointerUp={finishPan} onPointerCancel={finishPan} onLostPointerCapture={finishPan}>
					<div ref={canvas} className={`pointer-events-none absolute inset-0 origin-top-left ${isPanning ? "transition-none" : `transition-transform ease-out motion-reduce:transition-none ${isWheelZooming ? "duration-100" : "duration-300"}`}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
						<svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
							{flow.nodes.flatMap((node) => ["next", "other"].map((key) => {
								const from = positions.get(node.id);
								const to = positions.get(node[key]);
								if (!to || (wire?.id === node.id && wire.key === key)) return null;
								const x = from.x + outputX(node, key);
								const y = from.y + NODE_HEIGHT;
								const endX = to.x + NODE_WIDTH / 2;
								const endY = to.y;
								const d = flowConnectionPath(x, y, endX, endY, reverseWireLane(from.x, to.x, NODE_WIDTH), NODE_HEIGHT);
								return (
									<g key={`${node.id}-${key}`} role="button" tabIndex={placement ? -1 : 0}
										aria-label={`Select ${node.type === "ab" ? (key === "other" ? "B" : "A") + " branch" : key === "other" ? "secondary connection" : "connection"} from step ${flow.nodes.indexOf(node) + 1} to step ${flow.nodes.findIndex(({ id }) => id === node[key]) + 1}`}
										onClick={(event) => { event.currentTarget.focus(); setSelectedId(null); setIsTriggerOpen(false); }}
										onKeyDown={(event) => {
											if (!["Backspace", "Enter", " "].includes(event.key) || deleteWire || placement) return;
											event.preventDefault();
											setDeleteWire({ id: node.id, key, destination: node[key] });
										}}
										className="group cursor-pointer outline-none">
										<path d={d} fill="none" stroke="transparent" strokeWidth="16" vectorEffect="non-scaling-stroke"
											className={placement ? "" : "pointer-events-auto [pointer-events:stroke]"} />
										<path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
											strokeDasharray={key === "other" && node.type !== "ab" ? "5 4" : undefined}
											className="text-muted-foreground group-hover:text-primary group-focus:stroke-[3] group-focus:text-primary" />
									</g>
								);
							}))}
							{shownWire && <path aria-hidden="true" d={flowConnectionPath(shownWire.from.x, shownWire.from.y, shownWire.to.x, shownWire.to.y, shownWire.lane, shownWire.target ? NODE_HEIGHT : 0)}
								fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary" />}
							{firstNode && <path aria-hidden="true"
								d={flowConnectionPath(triggerPosition.x + NODE_WIDTH / 2, triggerPosition.y + TRIGGER_HEIGHT, firstPosition.x + NODE_WIDTH / 2, firstPosition.y)}
								fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground" />}
						</svg>
						<button type="button" onClick={(event) => {
							if (event.detail !== 0 && moved.current) return;
							setSelectedId(null);
							setIsTriggerOpen(true);
						}}
							onPointerDown={(event) => startMove(event, TRIGGER_DRAG, triggerPosition.x, triggerPosition.y)}
							onPointerMove={move}
							onPointerUp={(event) => { move(event); finishMove(event, true); }}
							onPointerCancel={(event) => finishMove(event, false)}
							onLostPointerCapture={(event) => finishMove(event, true)}
							disabled={Boolean(placement)} aria-pressed={isTriggerOpen}
							className="pointer-events-auto absolute grid touch-none cursor-grab content-start active:cursor-grabbing gap-1 overflow-hidden rounded-xl border bg-card p-4 text-left text-xs shadow-sm aria-pressed:ring-2 aria-pressed:ring-ring"
							style={{ left: triggerPosition.x, top: triggerPosition.y, width: NODE_WIDTH, height: TRIGGER_HEIGHT }}>
							<span className="flex items-center gap-1.5 text-sm font-medium"><Zap className="size-4" />Trigger</span>
							<span className="line-clamp-2 wrap-anywhere">Customers enter the workflow when they <strong>{triggerText}</strong>.</span>
							<span className="line-clamp-2 border-t pt-1 wrap-anywhere">{flow.exitTag ? <>Customers exit the workflow when they <strong>receive the “{flow.exitTag}” tag</strong>.</> : "No exit condition set."}</span>
						</button>

						{flow.nodes.map((node, index) => {
							const { label, icon: Icon } = TYPES[node.type];
							const { x, y } = positions.get(node.id);
							return (
								<article key={node.id} className={`group ${placement ? "" : "pointer-events-auto"} absolute space-y-2 rounded-xl border bg-card p-4 shadow-sm ${selectedId === node.id ? "ring-2 ring-ring" : ""}`} style={{ left: x, top: y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
									<div className="flex items-center gap-2">
										<button type="button" aria-label={`Select or move step ${index + 1}`} className="absolute inset-0 touch-none cursor-grab rounded-xl focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
											onClick={(event) => { if (event.detail === 0 || !moved.current) { event.currentTarget.focus({ preventScroll: true }); setIsTriggerOpen(false); setSelectedId(node.id); } }}
											onKeyDown={(event) => {
												if (event.key !== "Enter" || selectedId !== node.id || event.repeat) return;
												event.preventDefault();
												setDeleteId(node.id);
											}}
											onPointerDown={(event) => startMove(event, node.id, x, y)}
											onPointerMove={move}
											onPointerUp={(event) => { move(event); finishMove(event, true); }}
											onPointerCancel={(event) => finishMove(event, false)}
											onLostPointerCapture={(event) => finishMove(event, true)}
										/>
										<span className="pointer-events-none flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
											<Icon className="size-4 shrink-0" /><span className="truncate">{node.type === "email" ? node.title || node.value || "Untitled email" : `${index + 1}. ${label}`}</span>
										</span>
										<Button variant="ghost" size="icon-sm" aria-label={`Duplicate step ${index + 1}`} title="Duplicate node"
											disabled={flow.nodes.length >= MAX_FLOW_STEPS}
											className="relative opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
											onClick={() => add(node.type, node)}><Copy aria-hidden="true" /></Button>

									</div>
									<p className="pointer-events-none truncate text-sm text-muted-foreground">{node.type === "email" ? node.previewText || "No preview text" : node.value ? node.type === "delay" ? `${node.value} h` : node.value : node.type === "sms" || node.type === "push" ? "No message yet" : ""}</p>
									{node.type === "email" && <dl aria-label="Email analytics" className="pointer-events-none grid grid-cols-4 gap-2 border-t pt-2 text-xs text-muted-foreground">
										{["Sent", "Revenue", "Opened", "Clicked"].map((label) => <div key={label}><dt>{label}</dt><dd aria-label="No data" className="mt-1">—</dd></div>)}
									</dl>}
									{node.type === "exit" && <dl aria-label="Exit analytics" className="pointer-events-none border-t pt-2 text-xs text-muted-foreground">
										<dt>Completed</dt>
										<dd aria-label="No data" className="mt-1">—</dd>
									</dl>}
									{port(node, "input", `Input for step ${index + 1}`)}
									{node.type !== "exit" && port(node, "next", `Connect step ${index + 1} ${node.type === "filter" ? "if tag matches" : node.type === "ab" ? "variant A" : "to next step"}`)}
									{hasBranches(node.type) && port(node, "other", `Connect step ${index + 1} ${node.type === "filter" ? "otherwise" : node.type === "ab" ? "variant B" : "to repeat from"}`)}
								</article>
							);
						})}
						{placement && <div aria-hidden="true" className="absolute rounded-xl border border-dashed border-primary bg-card/90 p-3 text-sm font-medium shadow-sm" style={{ left: placement.x, top: placement.y, width: NODE_WIDTH, height: NODE_HEIGHT }}>
							{TYPES[placement.type].label}
						</div>}
						{!flow.nodes.length && !placement && <p className="p-8 text-sm text-muted-foreground">Add a node to start your flow.</p>}
					</div>
					<div role="toolbar" aria-label="Automation tools" className="absolute top-3 bottom-16 left-3 z-10 flex w-max flex-col items-stretch gap-1.5 overflow-y-auto p-0.5 pointer-events-none [&_button]:pointer-events-auto">
						{TOOL_GROUPS.map(([group, types]) => (
							<div key={group} role="group" aria-label={group} className="grid gap-1.5">
								<span className="hidden text-xs font-medium text-muted-foreground sm:block">{group}</span>
								{types.map((type) => {
									const { label, icon: Icon } = TYPES[type];
									return <Button key={type} variant="outline" className={TOOL_BUTTON} title={label} aria-label={`Add ${label.toLowerCase()} node`}
										disabled={flow.nodes.length >= MAX_FLOW_STEPS} onClick={() => add(type)}>
										<Icon aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
									</Button>;
								})}
							</div>
						))}
						<Button variant="outline" className={TOOL_BUTTON} title="Back to start" aria-label="Back to start" onClick={() => revealNode(triggerPosition)}>
							<Focus aria-hidden="true" /><span className="hidden sm:inline">Back to start</span>
						</Button>
						<Button variant="outline" className={TOOL_BUTTON} title="Simulate flow" aria-label="Simulate flow" onClick={() => setIsSimulationOpen(true)}>
							<Play aria-hidden="true" /><span className="hidden sm:inline">Simulate</span>
						</Button>
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
				<div className={`min-h-0 min-w-0 overflow-hidden ${hasSettings ? "block lg:flex lg:flex-col lg:p-3" : "hidden lg:block"}`} inert={!hasSettings}>
					<aside key={isTriggerOpen ? "trigger" : selectedNode?.id} aria-label="Node settings" aria-hidden={!hasSettings}
						className={`m-2 max-h-[40dvh] min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-2xl bg-card shadow-float ring-1 ring-foreground/10 transition-[translate,opacity] duration-300 ease-out starting:translate-x-4 starting:opacity-0 motion-reduce:transition-none sm:m-3 lg:m-0 lg:max-h-none ${hasSettings ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}>
						{isTriggerOpen && <PanelAutomationTrigger flow={flow} onChange={change} onClose={() => setIsTriggerOpen(false)} />}
						{hasNodeSettings && <section className="space-y-3 p-4">
							<div className="flex items-center gap-1">
								<h2 className="mr-auto font-medium">{TYPES[selectedNode.type].label} settings</h2>
								<Button size="icon" variant="ghost" aria-label="Delete selected node" onClick={() => setDeleteId(selectedNode.id)}><Trash2 /></Button>
								<Button size="icon" variant="ghost" aria-label="Close node settings" onClick={() => setSelectedId(null)}><X /></Button>
							</div>
							{TYPES[selectedNode.type].field && <label className="grid gap-1 text-sm">{TYPES[selectedNode.type].field}<Input type={selectedNode.type === "delay" ? "number" : "text"} min={0} value={selectedNode.value} onChange={(event) => update(selectedNode.id, { value: event.target.value })} /></label>}
							{(selectedNode.type === "sms" || selectedNode.type === "push") && <label className="grid gap-1 text-sm">
								Message
								<textarea className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
									value={selectedNode.value} onChange={(event) => update(selectedNode.id, { value: event.target.value })} />
							</label>}
							{selectedNode.other && <div className="flex flex-wrap gap-2">
								{selectedNode.other && <Button size="sm" variant="outline" onClick={() => update(selectedNode.id, { other: "" })}>Disconnect {selectedNode.type === "filter" ? "otherwise" : selectedNode.type === "ab" ? "B" : "repeat"}</Button>}
							</div>}

							{selectedNode.type === "email" && (
								<PreviewAutomationEmail key={selectedNode.id} node={selectedNode} addresses={addresses} editHref={`${editPath}/${selectedNode.id}`} />
							)}
						</section>}
					</aside>
				</div>
			</div>

			<Dialog open={isSimulationOpen} onOpenChange={setIsSimulationOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogTitle>Simulate flow</DialogTitle>
					<DialogDescription>Try the flow with sample contact tags. Simulation sends no messages.</DialogDescription>
					<section className="space-y-3 rounded-xl border bg-card p-4">
						<label className="grid gap-1 text-sm">Sample trigger
							<select value={sampleEvent ?? flow.trigger ?? "subscribe"} onChange={(event) => setSampleEvent(event.target.value)} className="h-9 rounded-md border bg-background px-3">
								<option value="subscribe">Subscriber joins</option>
								<option value="tag">Contact tag added</option>
							</select>
						</label>
						<label className="grid gap-1 text-sm">Sample contact tags<Input placeholder="vip, customer" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
						{flow.nodes.some(({ type }) => type === "ab") && <label className="grid gap-1 text-sm">A/B variant
							<select value={variant} onChange={(event) => setVariant(event.target.value)} className="h-9 rounded-md border bg-background px-3">
								<option value="a">A</option><option value="b">B</option>
							</select>
						</label>}
						<Button onClick={() => setResult(simulateWelcomeFlow(flow, tags.split(",").map((tag) => tag.trim()), { variant, event: sampleEvent ?? undefined }))}>Simulate flow</Button>
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
					<DialogFooter onKeyDown={(event) => {
						if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
						event.preventDefault();
						const buttons = [...event.currentTarget.querySelectorAll("button")];
						buttons.find((button) => button !== event.target)?.focus();
					}}>
						<Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
						<Button variant="destructive" onClick={confirmDelete}>Delete node</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={Boolean(deleteWire)} onOpenChange={(open) => { if (!open) setDeleteWire(null); }}>
				<DialogContent>
					<DialogTitle>Delete this connection?</DialogTitle>
					<DialogDescription>The two nodes will stay in the flow.</DialogDescription>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteWire(null)}>Cancel</Button>
						<Button variant="destructive" onClick={() => {
							const { id, key, destination } = deleteWire;
							if (flow.nodes.find((node) => node.id === id)?.[key] === destination) update(id, { [key]: "" });
							setDeleteWire(null);
						}}>Delete connection</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
