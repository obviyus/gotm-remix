import { DISCORD_INVITE_URL } from "~/utils/seo";

export default function ClubIntro() {
	return (
		<section className="mb-10 text-center">
			<h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
				PatientGamers Game of the Month
			</h1>
			<p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
				Every month the PatientGamers Discord picks two games to play. One is under 12 hours on
				HowLongToBeat and one is longer. The jury sets a theme, anyone can nominate a game that fits
				it, then the jury cuts the nominations down to a ballot. Members rank that ballot and
				instant-runoff voting decides the winners.
			</p>
			<p className="mx-auto mt-3 max-w-2xl text-base text-zinc-400">
				Nothing is scheduled. Play the winners whenever you get to them.
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
