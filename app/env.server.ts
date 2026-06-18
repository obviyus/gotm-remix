export function getEnv(
	name: string,
	env: Record<string, string | undefined> = process.env,
): string {
	const value = env[name];

	if (!value) {
		throw new Error(`${name} must be defined`);
	}

	return value;
}
