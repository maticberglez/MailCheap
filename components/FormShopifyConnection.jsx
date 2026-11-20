"use client";

import { useActionState } from "react";
import { manageShopifyCodes, saveShopifyConnection } from "@/app/(app)/newsletters/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FormShopifyConnection({ newsletterId, domain }) {
	const [state, action, pending] = useActionState(saveShopifyConnection, null);

	return (
		<div className="grid gap-4">
			<div className="grid gap-4 rounded-xl bg-card p-4 shadow-border">
				{domain && <p className="text-sm">Connected to <strong>{domain}</strong></p>}
				<form action={action} className="grid gap-3">
					<input type="hidden" name="newsletterId" value={newsletterId} />
					<label className="grid gap-1 text-sm">Store domain<Input name="domain" defaultValue={domain} placeholder="your-store.myshopify.com" required maxLength={100} /></label>
					<label className="grid gap-1 text-sm">App client ID<Input name="clientId" required maxLength={200} autoComplete="off" /></label>
					<label className="grid gap-1 text-sm">App client secret<Input name="clientSecret" type="password" required maxLength={500} autoComplete="new-password" /></label>
					<Button name="action" value="connect" disabled={pending} className="justify-self-start">{domain ? "Update connection" : "Connect with Shopify"}</Button>
				</form>
				{domain && (
					<form action={action}>
						<input type="hidden" name="newsletterId" value={newsletterId} />
						<Button variant="outline" name="action" value="disconnect" disabled={pending}>Disconnect</Button>
					</form>
				)}
				{state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
			</div>
			{domain && <DiscountCodes key={domain} newsletterId={newsletterId} />}
		</div>
	);
}

function DiscountCodes({ newsletterId }) {
	const [result, action, pending] = useActionState(manageShopifyCodes, null);

	return (
		<section className="grid gap-4 rounded-xl bg-card p-4 shadow-border">
			<h2 className="font-medium">Unique discount codes</h2>
			<form action={action} className="grid gap-3">
				<input type="hidden" name="newsletterId" value={newsletterId} />
				<label className="grid gap-1 text-sm">Shopify discount ID<Input name="discountId" placeholder="gid://shopify/DiscountCodeNode/123" required /></label>
				<label className="grid gap-1 text-sm">Number of codes<Input name="count" type="number" min="1" max="250" defaultValue="10" required /></label>
				<Button name="action" value="generate" disabled={pending} className="justify-self-start">Generate codes</Button>
			</form>
			<form action={action} className="grid gap-3">
				<input type="hidden" name="newsletterId" value={newsletterId} />
				<label className="grid gap-1 text-sm">Shopify batch ID<Input key={result?.jobId} name="jobId" defaultValue={result?.jobId} required /></label>
				<Button name="action" value="check" variant="outline" disabled={pending} className="justify-self-start">Check batch</Button>
			</form>
			{result?.error && <p role="alert" className="text-sm text-destructive">{result.error}</p>}
			{result?.jobId && !result.done && <p role="status" className="text-sm text-muted-foreground">Shopify is preparing the batch.</p>}
			{result?.done && <p role="status" className="text-sm text-muted-foreground">{result.codes.length} created, {result.failed} failed.</p>}
			{result?.codes?.length > 0 && (
				<textarea aria-label="Verified Shopify codes" readOnly value={result.codes.join("\n")} className="min-h-32 rounded-md border p-2 font-mono text-sm" />
			)}
		</section>
	);
}
