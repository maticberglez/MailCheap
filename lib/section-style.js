export const SECTION_RADIUS_MAX = 100;

export function readSectionRadius(value) {
	if (!/^\d{1,3}$/.test(value ?? "")) return null;
	const radius = Number(value);
	return radius <= SECTION_RADIUS_MAX ? radius : null;
}
