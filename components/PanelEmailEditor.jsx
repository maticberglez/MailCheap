"use client";

import { createContext, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@teispace/next-themes";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const EmailModePreviewContext = createContext(null);

export default function PanelEmailEditor({ children, className, mode: sharedMode, onModeChange }) {
	const { resolvedTheme } = useTheme();
	const [pickedMode, setPickedMode] = useState(null);
	const [previewMode, setPreviewMode] = useState(null);
	const mode = previewMode ?? sharedMode ?? pickedMode ?? resolvedTheme;
	const changeMode = onModeChange ?? setPickedMode;

	return (
		<div data-email-editor-mode={mode} style={{ colorScheme: mode }} className={cn("overflow-hidden rounded-xl bg-card text-card-foreground motion-safe:transition-colors motion-safe:duration-200", className)}>
			<label className="flex h-11 items-center justify-end gap-2 border-b border-border/60 px-4 text-sm motion-safe:transition-colors motion-safe:duration-200">
				<Sun className="size-4" aria-hidden="true" />
				<Switch aria-label="Dark mode" checked={mode === "dark"} onCheckedChange={(dark) => changeMode(dark ? "dark" : "light")} />
				<Moon className="size-4" aria-hidden="true" />
			</label>
			<EmailModePreviewContext value={setPreviewMode}>
				{typeof children === "function" ? children(mode) : children}
			</EmailModePreviewContext>
		</div>
	);
}
