export const MAX_FLOW_STEPS = 24;

export function simulateWelcomeFlow({ nodes, entryTag, exitTag }, tags) {
	const path = [];
	if (entryTag && !tags.includes(entryTag)) return { path, reason: "Entry filter did not match" };
	if (exitTag && tags.includes(exitTag)) return { path, reason: "Exit filter matched" };
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const visits = new Map();
	let next = nodes[0]?.id;
	let hours = 0;
	while (next && path.length < MAX_FLOW_STEPS * 4) {
		const node = byId.get(next);
		if (!node) return { path, reason: "A connection points to a missing step" };
		const times = (visits.get(node.id) ?? 0) + 1;
		visits.set(node.id, times);
		if (node.type === "delay") hours += Math.max(0, Number(node.value) || 0);
		path.push({ id: node.id, type: node.type, value: node.value, hours });
		if (node.type === "exit") return { path, reason: "Reached an exit" };
		if (node.type === "filter") next = tags.includes(node.value) ? node.next : node.other;
		else if (node.type === "repeat") next = times <= 2 ? node.other : node.next;
		else next = node.next;
	}
	return { path, reason: next ? "Stopped at the simulation step limit" : "Reached the end" };
}

export function flowConnectionPath(x, y, endX, endY, reverseLane = Math.min(x, endX) - 148) {
	const dy = endY - y;
	if (dy >= 0) {
		const bend = Math.max(24, dy / 2);
		return `M ${x} ${y} C ${x} ${y + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`;
	}
	const spread = Math.max(-28, Math.min(28, (x - endX) * 0.12));
	const bottomX = reverseLane + spread;
	const topX = reverseLane - spread;
	const lower = y + 20;
	const upper = endY - 20;
	const bend = (lower - upper) / 3;
	return `M ${x} ${y} C ${x} ${lower + 28}, ${bottomX} ${lower + 36}, ${bottomX} ${lower} C ${bottomX} ${lower - bend}, ${topX} ${upper + bend}, ${topX} ${upper} C ${topX} ${upper - 36}, ${endX} ${upper - 28}, ${endX} ${endY}`;
}

export function connectFlowNodes(flow, sourceId, output, destinationId) {
	if (sourceId === destinationId || !flow.nodes.some(({ id }) => id === destinationId)) return flow;
	return {
		...flow,
		nodes: flow.nodes.map((node) => node.id === sourceId ? { ...node, [output]: destinationId } : node),
	};
}

const PAN_OVERSCROLL = 96;

// A soft edge that approaches the overscroll allowance as the pointer travels farther.
export function resistCanvasPan(value, min, max) {
	const edge = Math.max(min, Math.min(max, value));
	const overshoot = value - edge;
	return edge + (overshoot * PAN_OVERSCROLL) / (Math.abs(overshoot) + PAN_OVERSCROLL);
}

export function resumeCanvasPan(visible, edge) {
	const overshoot = visible - edge;
	return edge + overshoot * PAN_OVERSCROLL / Math.max(1, PAN_OVERSCROLL - Math.abs(overshoot));
}

export function nearestFlowInput(points, x, y, radius = 28) {
	let closest = null;
	for (const point of points) {
		const distance = Math.hypot(point.x - x, point.y - y);
		if (distance > radius) continue;
		closest = point;
		radius = distance;
	}
	return closest;
}

export function orientFlowConnection(first, second) {
	if (!first || !second || first.id === second.id || (first.key === "input") === (second.key === "input")) return null;
	const input = first.key === "input" ? first : second;
	const output = first.key === "input" ? second : first;
	return { sourceId: output.id, output: output.key, destinationId: input.id };
}

export function zoomCanvasAround(pan, zoom, nextZoom, x, y) {
	const ratio = nextZoom / zoom;
	return { x: x - (x - pan.x) * ratio, y: y - (y - pan.y) * ratio };
}

export function reverseWireLane(fromX, toX, width) {
	const left = Math.min(fromX, toX);
	const right = Math.max(fromX, toX);
	return right - left > width + 24 ? (left + width + right) / 2 : left - 28;
}
