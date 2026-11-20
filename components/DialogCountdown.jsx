"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function DialogCountdown({ onOpenChange, onInsert }) {
	const [error, setError] = useState("");

	function insert(event) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const src = URL.parse(String(data.get("url")));
		if (!src || src.protocol !== "https:" || src.username || src.password) {
			setError("Enter an HTTPS countdown image URL.");
			return;
		}
		onOpenChange(false);
		onInsert({ src: src.href, alt: String(data.get("fallback")).trim() || "Countdown" });
	}

	return (
		<Dialog open onOpenChange={onOpenChange}>
			<DialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
				<DialogTitle>Countdown</DialogTitle>
				<DialogDescription>Paste the image URL from your email countdown provider.</DialogDescription>
				<form onSubmit={insert} className="grid gap-3">
					<label className="grid gap-1 text-sm">Countdown image URL<Input name="url" type="url" required maxLength={2048} /></label>
					<label className="grid gap-1 text-sm">Fallback text<Input name="fallback" placeholder="Offer ends Friday at midnight" maxLength={200} /></label>
					{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
					<DialogFooter><Button type="submit">Insert countdown</Button></DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
