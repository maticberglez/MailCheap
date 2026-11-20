import assert from "node:assert/strict";
import { test } from "node:test";
import { CREATE_DISCOUNT_CODES, readShopifyDomain, requestShopifyAccess, requestShopifyDiscounts } from "../lib/shopify-connection.js";

test("Shopify credentials only go to the normalized Shopify host, with redirects disabled", async () => {
	for (const domain of ["shop.myshopify.com.evil.example", "https://shop.myshopify.com", "shop.myshopify.com:443", "shop.myshopify.com/a"]) {
		assert.equal(readShopifyDomain(domain), null);
		await assert.rejects(requestShopifyAccess({ domain }, () => assert.fail("invalid host must not be requested")));
	}
	const credentials = { domain: " Example-Shop.myshopify.com ", clientId: "client", clientSecret: "secret" };
	const result = await requestShopifyAccess(credentials, (url, init) => {
		assert.equal(url, "https://example-shop.myshopify.com/admin/oauth/access_token");
		assert.equal(init.redirect, "error");
		assert.equal(init.body.get("client_secret"), "secret");
		return Response.json({ access_token: "token", scope: "write_discounts, read_discounts", expires_in: 86399 });
	});
	assert.deepEqual(result.scopes, ["write_discounts", "read_discounts"]);
	await assert.rejects(requestShopifyAccess(credentials, () => { throw new Error("secret"); }), (error) => !error.message.includes("secret"));
});

test("discount writes use GraphQL variables on the connected store", async () => {
	const variables = { discountId: "gid://shopify/DiscountCodeNode/123", codes: [{ code: "MC-EXAMPLE" }] };
	const expected = { discountRedeemCodeBulkAdd: { bulkCreation: { id: "gid://shopify/DiscountRedeemCodeBulkCreation/456" } } };
	let calls = 0;
	const result = await requestShopifyDiscounts({ domain: "shop.myshopify.com", clientId: "client", clientSecret: "secret" },
		CREATE_DISCOUNT_CODES, variables, (url, init) => {
			calls++;
			if (url.endsWith("/oauth/access_token")) return Response.json({ access_token: "token", scope: "write_discounts", expires_in: 60 });
			assert.equal(url, "https://shop.myshopify.com/admin/api/2026-10/graphql.json");
			assert.equal(init.headers["X-Shopify-Access-Token"], "token");
			assert.deepEqual(JSON.parse(init.body).variables, variables);
			return Response.json({ data: expected });
		});
	assert.equal(calls, 2);
	assert.deepEqual(result, expected);
});
