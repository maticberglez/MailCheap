export const FONT_WEIGHTS = [
	[400, "Regular"], [500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"],
];

export function readFontWeight(value) {
	return FONT_WEIGHTS.find(([weight]) => String(weight) === String(value))?.[0] ?? null;
}
