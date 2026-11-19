import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FLOW_STEPS, connectFlowNodes, flowConnectionPath, nearestFlowInput, orientFlowConnection, resistCanvasPan, reverseWireLane, simulateWelcomeFlow, zoomCanvasAround } from "../lib/welcome-flow.js";

test("a welcome flow checks entry and exit tags, branches and accumulates delay through repeats", () => {
	const flow = {
		entryTag: "subscriber",
		exitTag: "customer",
		nodes: [
			{ id: "split", type: "filter", value: "vip", next: "email", other: "exit" },
			{ id: "email", type: "email", value: "Welcome", next: "delay" },
			{ id: "delay", type: "delay", value: "24", next: "repeat" },
			{ id: "repeat", type: "repeat", other: "email", next: "exit" },
			{ id: "exit", type: "exit" },
		],
	};
	assert.match(simulateWelcomeFlow(flow, []).reason, /Entry filter/);
	assert.match(simulateWelcomeFlow(flow, ["subscriber", "customer"]).reason, /Exit filter/);
	assert.deepEqual(simulateWelcomeFlow(flow, ["subscriber"]).path.map(({ id }) => id), ["split", "exit"]);
	const { path, reason } = simulateWelcomeFlow(flow, ["subscriber", "vip"]);
	assert.equal(reason, "Reached an exit");
	assert.deepEqual(path.filter(({ type }) => type === "email").map(({ hours }) => hours), [0, 24, 48]);
	assert.equal(path.at(-1).hours, 72);
});

test("accidental cycles have a fixed simulation limit", () => {
	const { path, reason } = simulateWelcomeFlow({
		nodes: [{ id: "a", next: "b" }, { id: "b", next: "a" }],
	}, []);
	assert.equal(path.length, MAX_FLOW_STEPS * 4);
	assert.match(reason, /step limit/);
});

test("connections use smooth curves above, below and level with their source", () => {
	for (const y of [60, 120, 180]) {
		const path = flowConnectionPath(100, 120, 180, y);
		assert.match(path, /^M 100 120 C /);
		assert.equal(path.match(/ C /g).length, y < 120 ? 3 : 1);
		assert.ok(path.endsWith(`180 ${y}`));
	}
});

test("canvas overscroll resists the pointer outside its bounds", () => {
	assert.equal(resistCanvasPan(12, -40, 40), 12);
	assert.ok(resistCanvasPan(100, -40, 40) > 40);
	assert.ok(resistCanvasPan(100, -40, 40) < 100);
	assert.ok(resistCanvasPan(1e6, -40, 40) < 136);
	assert.ok(resistCanvasPan(-100, -40, 40) > -100);
});

test("a wire snaps to the closest input inside the snap radius", () => {
	const inputs = [{ id: "first", x: 10, y: 30 }, { id: "second", x: 40, y: 30 }];
	assert.equal(nearestFlowInput(inputs, 34, 28)?.id, "second");
	assert.equal(nearestFlowInput(inputs, 100, 100), null);
});

test("a later node can connect back to the first node", () => {
	const flow = { nodes: [{ id: "first", next: "last" }, { id: "last" }] };
	const linked = connectFlowNodes(flow, "last", "next", "first");
	assert.deepEqual(simulateWelcomeFlow(linked, []).path.slice(0, 3).map(({ id }) => id), ["first", "last", "first"]);
	assert.match(flowConnectionPath(176, 320, 176, 32, 28), /C 28 [^,]+, 28 [^,]+, 28 12 C 28/);
});

test("an SMS step carries its message and follows its outgoing connection", () => {
	const { path } = simulateWelcomeFlow({ nodes: [
		{ id: "sms", type: "sms", value: "Welcome!", next: "end" },
		{ id: "end", type: "exit" },
	] }, []);
	assert.deepEqual(path.map(({ type, value }) => [type, value]), [["sms", "Welcome!"], ["exit", undefined]]);
});

test("starting a connection at an input still saves the wire from output to input", () => {
	const input = { id: "first", key: "input" };
	const output = { id: "last", key: "other" };
	const expected = { sourceId: "last", output: "other", destinationId: "first" };
	assert.deepEqual(orientFlowConnection(input, output), expected);
	assert.deepEqual(orientFlowConnection(output, input), expected);
	assert.equal(orientFlowConnection(input, { id: "last", key: "input" }), null);
	assert.equal(orientFlowConnection(input, { id: "first", key: "next" }), null);
});

test("reverse connections use the gap between separated cards", () => {
	const lane = reverseWireLane(446, 142, 240);
	assert.equal(lane, 414);
	const path = flowConnectionPath(566, 286, 262, 98, lane);
	assert.match(path, /^M 566 286 C 566 [^,]+, 262 [^,]+, 262 98$/);
	assert.equal(path.match(/ C /g).length, 1);
	assert.equal(reverseWireLane(142, 142, 240), 114);
});

test("zooming keeps the world point at the viewport center fixed", () => {
	const pan = { x: 100, y: -80 };
	const center = { x: 360, y: 250 };
	const next = zoomCanvasAround(pan, 1, 1.5, center.x, center.y);
	assert.equal((center.x - next.x) / 1.5, center.x - pan.x);
	assert.equal((center.y - next.y) / 1.5, center.y - pan.y);
});

test("tight backward connections turn outside both cards", () => {
	const lane = reverseWireLane(264, 96, 240);
	const path = flowConnectionPath(384, 162, 216, 152, lane, 112);
	assert.equal(lane, 68);
	assert.match(path, /^M 384 162 V 284 Q 384 304 /);
	assert.match(path, /V 30 Q 68 10 .* Q 216 10 216 30 V 152$/);
});
