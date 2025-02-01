export default function Privacy() {
	return (
		<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
			<article className="mx-auto max-w-none">
				<header className="mb-6">
					<h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
						Privacy
					</h1>
				</header>

				<p>
					This website gets the following information from your Discord account
					when you authenticate:
				</p>

				<ul className="list-disc ml-6 mt-2">
					<li>Account ID</li>
					<li>Account nickname</li>
					<li>Account avatar</li>
				</ul>

				<p className="mt-4">
					All of these are publicly visible to anyone in every server you
					joined.
				</p>

				<p className="mt-4">
					The only data that is used and saved on this site, is the account id
					and ONLY if you nominate or vote for a game. The sole purpose of this
					is to prevent multiple nominations and votings by the same user in one
					month.
				</p>

				<p className="mt-4">No other data is made use of in any way.</p>
			</article>
		</div>
	);
}
