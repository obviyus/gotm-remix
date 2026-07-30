import React from "react";
import { redirect } from "react-router";
import { requireAdmin, requireAuthenticatedUser } from "~/route-context.server";
import { getCurrentMonth } from "~/server/month.server";
import { SITE_NAME, pageMeta } from "~/utils/seo";
import type { Route } from "./+types/admin";

export const meta: Route.MetaFunction = () =>
	pageMeta({
		title: `Admin — ${SITE_NAME}`,
		description: "Jury tools.",
		path: "/admin",
		noIndex: true,
	});

export const middleware: Route.MiddlewareFunction[] = [requireAuthenticatedUser, requireAdmin];

export async function loader() {
	const month = await getCurrentMonth();
	return redirect(`/admin/${month.id}`);
}
