import { redirect } from "react-router";
import { destroySession, getSession } from "~/sessions";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
	const session = await getSession(request.headers.get("Cookie"));

	return redirect("/", {
		headers: {
			"Set-Cookie": await destroySession(session),
		},
	});
}
