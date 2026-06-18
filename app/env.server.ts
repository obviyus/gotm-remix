export function getEnv(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} must be defined`);
	}

	return value;
}
