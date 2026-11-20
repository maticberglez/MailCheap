import assert from "node:assert/strict";
import { test } from "node:test";
import { activate, as, callApi, catchRedirect, form, signIn, startTestApp } from "./helpers/app.mjs";

test("a newsletter owner connects Shopify, generates a batch and reads only confirmed codes", async (t) => {
	const app = await startTestApp({ CREDENTIALS_ENCRYPTION_KEY: "01".repeat(32) });
	t.after(() => app.stop());
	const newsletters = await import("../app/(app)/newsletters/actions.js");
	const { createApiKey } = await import("../app/(app)/api-keys/actions.js");
	const { default: Newsletter } = await import("../models/Newsletter.js");
	const user = await signIn("shopify-owner@example.com");
	await activate(user);
	const redirect = await as(user, () => catchRedirect(newsletters.saveNewsletter(null, form({
		name: "Shopify newsletter", slug: "shopify-newsletter", postalAddress: "1 Main St, Paris",
	}))));
	const id = redirect.split("/").at(-1);
	const { key } = await as(user, () => createApiKey(null, form({ name: "Shopify test", level: "full" })));
	const domain = "mailcheap-test.myshopify.com";
	const jobId = "gid://shopify/DiscountRedeemCodeBulkCreation/123";
	const discountId = "gid://shopify/DiscountCodeNode/123";
	let codes;
	const originalFetch = globalThis.fetch;
	t.after(() => { globalThis.fetch = originalFetch; });
	globalThis.fetch = async (url, options) => {
		if (String(url) === `https://${domain}/admin/oauth/access_token`) {
			assert.equal(options.body.get("client_secret"), "fake-secret");
			return Response.json({ access_token: "fake-token", scope: "write_discounts,read_discounts", expires_in: 60 });
		}
		assert.equal(url, `https://${domain}/admin/api/2026-10/graphql.json`);
		const { query, variables } = JSON.parse(options.body);
		if (query.includes("mutation CreateCodes")) {
			assert.equal(variables.discountId, discountId);
			codes = variables.codes.map(({ code }) => code);
			assert.equal(new Set(codes).size, 2);
			return Response.json({ data: { discountRedeemCodeBulkAdd: { bulkCreation: { id: jobId }, userErrors: [] } } });
		}
		assert.equal(variables.id, jobId);
		return Response.json({ data: { discountRedeemCodeBulkCreation: {
			done: true, failedCount: 1, codes: { nodes: [{ code: codes[0], discountRedeemCode: { id: "verified" } }, { code: codes[1] }] },
		} } });
	};

	const path = `/api/v1/newsletters/${id}/shopify`;
	assert.deepEqual((await callApi("POST", path, { key, body: { domain, clientId: "fake-client", clientSecret: "fake-secret" } })).body, { domain });
	const publicRead = await Newsletter.findOne({ accountId: user.accountId, _id: id }).lean();
	assert.equal(publicRead.shopify.clientSecret, undefined);
	const privateRead = await Newsletter.findOne({ accountId: user.accountId, _id: id }).select("+shopify.clientSecret").lean();
	assert.ok(privateRead.shopify.clientSecret.startsWith("v1."));
	assert.deepEqual((await callApi("POST", `${path}/discount-codes`, { key, body: { discountId, count: 2 } })).body, { jobId });
	assert.deepEqual((await callApi("GET", `${path}/discount-codes?jobId=${encodeURIComponent(jobId)}`, { key })).body,
		{ done: true, failed: 1, codes: [codes[0]] });
	assert.deepEqual((await callApi("DELETE", path, { key })).body, { disconnected: true });
});
