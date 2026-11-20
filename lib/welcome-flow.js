export const MAX_FLOW_STEPS = 24;

export const FLOW_TRIGGERS = { subscribe: "join the newsletter", tag: "receive a contact tag" };

export function readPublishableWelcomeFlow(flow) {
	if (!flow || (flow.trigger && flow.trigger !== "subscribe") || flow.entryTag || flow.exitTag ||
		(flow.triggerFilters != null && (!Array.isArray(flow.triggerFilters) || flow.triggerFilters.some(Boolean)))) return null;
	const [email, exit] = Array.isArray(flow.nodes) ? flow.nodes : [];
	if (!email || email.type !== "email" || email.other || flow.nodes.length > 2) return null;
	if (exit ? exit.type !== "exit" || !exit.id || email.next !== exit.id || exit.next || exit.other : email.next) return null;
	if (typeof email.value !== "string" || typeof email.html !== "string" ||
		[email.previewText, email.fromName, email.fromEmail, email.replyTo].some((value) => value != null && typeof value !== "string")) return null;
	return {
		subject: email.value.trim(), previewText: email.previewText?.trim() ?? "", html: email.html,
		fromName: email.fromName?.trim() ?? "", fromEmail: email.fromEmail?.trim() ?? "", replyTo: email.replyTo?.trim() ?? "",
	};
}

export function simulateWelcomeFlow({ nodes, entryTag, exitTag, trigger = "subscribe", triggerTag, triggerFilters = [] }, tags, { event = trigger, variant = "a" } = {}) {
	const path = [];
	if (event !== trigger || (trigger === "tag" && (!triggerTag || !tags.includes(triggerTag)))) {
		return { path, reason: "Trigger did not match" };
	}
	const contactTags = new Set(tags);
	if ((entryTag && !contactTags.has(entryTag)) || triggerFilters.some((tag) => tag && !contactTags.has(tag))) return { path, reason: "Entry filter did not match" };
	if (exitTag && contactTags.has(exitTag)) return { path, reason: "Exit filter matched" };
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
		if (node.type === "tag" && node.value) contactTags.add(node.value);
		if (exitTag && contactTags.has(exitTag)) return { path, reason: "Exit filter matched" };
		if (node.type === "filter") next = contactTags.has(node.value) ? node.next : node.other;
		else if (node.type === "ab") next = variant === "b" ? node.other : node.next;
		else if (node.type === "repeat") next = times <= 2 ? node.other : node.next;
		else next = node.next;
	}
	return { path, reason: next ? "Stopped at the simulation step limit" : "Reached the end" };
}

export function flowConnectionPath(x, y, endX, endY, reverseLane = Math.min(x, endX) - 148, nodeHeight = 0) {
	const dy = endY - y;
	if (dy >= 0) {
		const bend = Math.max(24, dy / 2);
		return `M ${x} ${y} C ${x} ${y + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`;
	}
	// With room between the cards, a single curve avoids joints in the S bend.
	if (reverseLane > Math.min(x, endX) && reverseLane < Math.max(x, endX)) {
		const bend = 100 - dy * 2.6;
		return `M ${x} ${y} C ${x} ${y + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`;
	}
	if (-dy < nodeHeight * 2) {
		// Clear both cards before turning horizontally. Each rounded turn shares a tangent with its adjoining line.
		const radius = 20;
		const bottom = Math.max(y, endY + nodeHeight) + 2 * radius;
		const top = Math.min(endY, y - nodeHeight) - 2 * radius;
		const lane = reverseLane;
		return `M ${x} ${y} V ${bottom - radius} Q ${x} ${bottom} ${x - radius} ${bottom} H ${lane + radius} Q ${lane} ${bottom} ${lane} ${bottom - radius} V ${top + radius} Q ${lane} ${top} ${lane + radius} ${top} H ${endX - radius} Q ${endX} ${top} ${endX} ${top + radius} V ${endY}`;
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

// A soft edge that approaches the overscroll allowance as the pointer travels farther.
export function resistCanvasPan(value, min, max) {
	const edge = Math.max(min, Math.min(max, value));
	const overshoot = value - edge;
	return edge + (overshoot * 96) / (Math.abs(overshoot) + 192);
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
