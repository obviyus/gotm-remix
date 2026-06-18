import React from "react";
import { redirect } from "react-router";
import { requireAdmin, requireAuthenticatedUser } from "~/route-context.server";
import { getCurrentMonth } from "~/server/month.server";
import type { Route } from "./+types/admin";

export const middleware: Route.MiddlewareFunction[] = [requireAuthenticatedUser, requireAdmin];

export async function loader() {
	const month = await getCurrentMonth();
	return redirect(`/admin/${month.id}`);
}
