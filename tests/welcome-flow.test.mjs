import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FLOW_STEPS, flowConnectionPath, simulateWelcomeFlow } from "../lib/welcome-flow.js";

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
		assert.equal(path.match(/ C /g).length, 2);
		assert.ok(path.endsWith(`180 ${y}`));
	}
});
