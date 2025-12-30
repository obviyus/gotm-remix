import { redirect } from "react-router";

export function loader() {
	// Redirect to today's date - shows games that became "patient" today (released 1 year ago)
	const today = new Date().toISOString().split("T")[0];
	return redirect(`/patience/${today}`);
}
