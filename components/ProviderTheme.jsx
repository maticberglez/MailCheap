"use client";

import { ThemeProvider } from "@teispace/next-themes";

export default function ProviderTheme({ children }) {
	return (
		<ThemeProvider attribute="class" storage="local" defaultTheme="system" enableSystem disableTransitionOnChange>
			{children}
		</ThemeProvider>
	);
}
