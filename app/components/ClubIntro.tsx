import { DISCORD_INVITE_URL } from "~/utils/seo";

export default function ClubIntro() {
	return (
		<section className="mb-10 text-center">
			<h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
				PatientGamers Game of the Month
			</h1>
			<p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
				Every month the PatientGamers Discord plays two games together: one short, under 12 hours on
				HowLongToBeat, and one long. Anyone can nominate a game that fits the month&apos;s theme,
				the jury narrows the nominations down to a ballot, and members rank their favourites. The
				winner is decided by instant-runoff voting.
			</p>
			<p className="mx-auto mt-3 max-w-2xl text-base text-zinc-400">
				No signups, no schedule to keep up with — play at your own pace and talk about it when you
				get there.
			</p>
			<a
				href={DISCORD_INVITE_URL}
				target="_blank"
				rel="noopener noreferrer"
				className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
			>
				Join the Discord
			</a>
		</section>
	);
}
