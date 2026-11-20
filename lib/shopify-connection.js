const SHOP_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/;

export function readShopifyDomain(value) {
	const domain = String(value ?? "").trim().toLowerCase();
	return SHOP_DOMAIN_PATTERN.test(domain) ? domain : null;
}

export async function requestShopifyAccess({ domain, clientId, clientSecret }, request = fetch) {
	const shop = readShopifyDomain(domain);
	if (!shop) throw new Error("Enter the store’s .myshopify.com domain.");
	try {
		const response = await request(`https://${shop}/admin/oauth/access_token`, {
			method: "POST",
			redirect: "error",
			signal: AbortSignal.timeout(8_000),
			body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
		});
		if (response.ok) {
			const { access_token: token, scope, expires_in: expiresIn } = await response.json();
			if (typeof token === "string" && token && typeof scope === "string" && Number.isFinite(expiresIn) && expiresIn > 0) {
				return { token, scopes: scope.split(",").map((item) => item.trim()).filter(Boolean), expiresIn };
			}
		}
	} catch {
		// Network details can contain credentials.
	}
	throw new Error("Shopify rejected the connection. Check the store domain and installed app credentials.");
}

export const CREATE_DISCOUNT_CODES = `mutation CreateCodes($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
	discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) {
		bulkCreation { id }
		userErrors { code }
	}
}`;

export const READ_DISCOUNT_CODES = `query ReadCodes($id: ID!) {
	discountRedeemCodeBulkCreation(id: $id) {
		done
		failedCount
		codes(first: 250) { nodes { code discountRedeemCode { id } } }
	}
}`;

export async function requestShopifyDiscounts(credentials, query, variables, request = fetch) {
	const shop = readShopifyDomain(credentials.domain);
	const { token } = await requestShopifyAccess(credentials, request);
	try {
		const response = await request(`https://${shop}/admin/api/2026-10/graphql.json`, {
			method: "POST",
			redirect: "error",
			signal: AbortSignal.timeout(8_000),
			headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
			body: JSON.stringify({ query, variables }),
		});
		if (response.ok) {
			const result = await response.json();
			if (result.data && !result.errors?.length) return result.data;
		}
	} catch {
		// Do not expose provider requests or credentials in action errors.
	}
	throw new Error("Shopify could not complete the discount request.");
}
