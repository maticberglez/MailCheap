"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// hasLabel: the label shows next to the icon, in an outlined button, for code that's the page's point to copy.
export default function ButtonCopy({ value, label = "Copy", hasLabel = false }) {
	const [feedback, setFeedback] = useState(null);
	const timeout = useRef(null);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setFeedback("Copied");
		} catch {
			setFeedback("Couldn’t copy");
		}
		clearTimeout(timeout.current);
		timeout.current = setTimeout(() => setFeedback(null), 1500);
	}

	const Icon = feedback === "Copied" ? Check : Copy;

	if (hasLabel) {
		return (
			<Button type="button" variant="outline" size="sm" onClick={copy} className="min-w-20">
				<Icon key={String(feedback)} data-icon="inline-start" className="animate-icon-in" />
				<span aria-live="polite">{feedback ?? label}</span>
			</Button>
		);
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={copy}
					aria-label={label}
					className="relative text-muted-foreground after:absolute after:-inset-1.5 hover:text-foreground"
				>
					<Icon key={String(feedback)} className="animate-icon-in" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{feedback ?? label}</TooltipContent>
		</Tooltip>
	);
}
