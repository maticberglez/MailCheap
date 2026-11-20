"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@teispace/next-themes";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function PanelEmailEditor({ children, className }) {
	const { resolvedTheme } = useTheme();
	const [pickedMode, setPickedMode] = useState(null);
	const mode = pickedMode ?? resolvedTheme;

	return (
		<div data-email-editor-mode={mode} style={{ colorScheme: mode }} className={cn("overflow-hidden rounded-xl bg-card text-card-foreground", className)}>
			<label className="flex h-11 items-center justify-end gap-2 border-b border-border/60 px-4 text-sm">
				<Sun className="size-4" aria-hidden="true" />
				<Switch aria-label="Dark mode" checked={mode === "dark"} onCheckedChange={(dark) => setPickedMode(dark ? "dark" : "light")} />
				<Moon className="size-4" aria-hidden="true" />
			</label>
			{children}
		</div>
	);
}
