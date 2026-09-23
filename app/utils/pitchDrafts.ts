// Unsaved pitch text lives in the browser until the server confirms the save,
// so a failed request, reload or closed tab never loses what was typed.
// Storage can be unavailable (private windows, blocked site data); drafts are
// then best-effort and the dialog still works.

const draftKey = (monthId: number, gameId: string) => `gotm:pitch-draft:${monthId}:${gameId}`;

export function readPitchDraft(monthId: number, gameId: string): string | null {
	try {
		return localStorage.getItem(draftKey(monthId, gameId));
	} catch {
		return null;
	}
}

export function writePitchDraft(monthId: number, gameId: string, pitch: string): void {
	try {
		if (pitch.trim()) {
			localStorage.setItem(draftKey(monthId, gameId), pitch);
		} else {
			localStorage.removeItem(draftKey(monthId, gameId));
		}
	} catch {
		// Storage unavailable: keep the in-memory text only.
	}
}
