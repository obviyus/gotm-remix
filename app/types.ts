export interface Nomination {
	id: number;
	title: string;
	short: boolean;
	jury_selected: boolean;
	month_id: number;
}

export interface Vote {
	id: number;
	month_id: number;
	discord_id: string;
	short: boolean;
}

export interface Ranking {
	vote_id: number;
	nomination_id: number;
	rank: number;
}
