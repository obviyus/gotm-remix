export interface Pitch {
    id: number;
    nominationId: number;
    pitch: string;
    discordId: string;
}

export interface Nomination {
    id: number;
    gameId: string;
    short: boolean;
    jurySelected: boolean;
    monthId: number;
    gameName: string;
    summary?: string;
    gameYear: string;
    gameCover?: string;
    gameUrl: string;
    gamePlatformIds: string;
    discordId: string;
    pitches: Pitch[];
}

export interface Vote {
    id: number;
    monthId: number;
    discordId: string;
    short: boolean;
}

export interface Ranking {
    voteId: number;
    nominationId: number;
    rank: number;
}

export interface Theme {
    id: number;
    name: string;
    description: string | null;
}

export interface ThemeCategory {
    id: number;
    name: string;
}

export interface Month {
    id: number;
    month: number;
    year: number;
    theme: Theme;
    status: "nominating" | "voting" | "complete" | "playing" | "over" | "ready";
    winners: Nomination[];
}

export interface NominationFormData {
    game: {
        id: number;
        name: string;
        cover?: string;
        firstReleaseDate?: number;
        gameYear?: string;
        summary?: string;
        url?: string;
    };
    monthId: string;
    short: boolean;
    pitch?: string | null;
}
