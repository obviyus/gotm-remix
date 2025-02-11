export type Game = {
    id: number;
    name: string;
    cover?: {
        url: string;
    };
    first_release_date?: number;
    game_year?: string;
    summary?: string;
    pitch?: string;
    short?: boolean;
    game_url?: string;
};

export interface Nomination {
    id: number;
    game_id: string;
    title: string;
    short: boolean;
    jury_selected: boolean;
    month_id: number;
    game_name: string;
    game_year: string | null;
    game_cover: string | null;
    game_url: string | null;
    game_platform_ids: string | null;
    pitch?: string;
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

export interface NominationFormData {
    game: {
        id: number;
        name: string;
        cover?: {
            url: string;
        };
        first_release_date?: number;
        game_year?: string;
        summary?: string;
        url?: string;
    };
    monthId: string;
    short: boolean;
    pitch?: string | null;
}
