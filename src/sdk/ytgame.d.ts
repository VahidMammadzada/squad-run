// The subset of the YouTube Playables SDK (window.ytgame) this game uses.
// https://developers.google.com/youtube/gaming/playables/reference/sdk

export interface YtGame {
    SDK_VERSION: string;
    IN_PLAYABLES_ENV: boolean;
    game: {
        firstFrameReady(): void;
        gameReady(): void;
        loadData(): Promise<string>;
        saveData(data: string): Promise<void>;
    };
    system: {
        isAudioEnabled(): boolean;
        onAudioEnabledChange(callback: (enabled: boolean) => void): () => void;
        onPause(callback: () => void): () => void;
        onResume(callback: () => void): () => void;
    };
    engagement: {
        sendScore(score: { value: number }): Promise<void>;
    };
}

declare global {
    interface Window {
        ytgame?: YtGame;
    }
}
