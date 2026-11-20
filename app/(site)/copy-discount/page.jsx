"use client";

import { useSyncExternalStore } from "react";
import { Scissors } from "lucide-react";
import ButtonCopy from "@/components/ButtonCopy";

function subscribe(change) {
	window.addEventListener("hashchange", change);
	return () => window.removeEventListener("hashchange", change);
}

function readCode() {
	try {
		return decodeURIComponent(window.location.hash.slice(1)).trim().slice(0, 64);
	} catch {
		return "";
	}
}

export default function CopyDiscountPage() {
	const code = useSyncExternalStore(subscribe, readCode, () => "");
	return (
		<main className="mx-auto grid w-full max-w-md gap-5 px-6 py-16 text-center">
			<h1 className="text-2xl font-semibold">Discount code</h1>
			{code ? (
				<div className="relative grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-6">
					<Scissors aria-hidden="true" className="absolute -top-3 left-4 size-6 bg-background p-1 text-muted-foreground" />
					<strong className="select-all break-all font-mono text-2xl">{code}</strong>
					<ButtonCopy value={code} label="Copy code" hasLabel />
				</div>
			) : <p className="text-sm text-muted-foreground">Open the copy link in your email to see your code.</p>}
		</main>
	);
}
