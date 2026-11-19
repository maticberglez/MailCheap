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

export function flowConnectionPath(x, y, endX, endY) {
	const dy = endY - y;
	const bend = Math.max(28, Math.abs(dy) * 0.45);
	const loop = Math.min(180, Math.max(0, -dy) * 0.7);
	const middleX = (x + endX) / 2 - loop;
	const middleY = (y + endY) / 2;
	const tangentX = (endX - x) / 6;
	const tangentY = dy / 6;
	return `M ${x} ${y} C ${x} ${y + bend}, ${middleX - tangentX} ${middleY - tangentY}, ${middleX} ${middleY} C ${middleX + tangentX} ${middleY + tangentY}, ${endX} ${endY - bend}, ${endX} ${endY}`;
}
