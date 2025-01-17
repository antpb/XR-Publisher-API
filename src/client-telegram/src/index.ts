import { elizaLogger } from "../../eliza-core";
import { Client, IAgentRuntime } from "../../eliza-core";
import { TelegramClient } from "./telegramClient";
import { validateTelegramConfig } from "./environment";

export const TelegramClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        await validateTelegramConfig(runtime);

        const tg = new TelegramClient(
            runtime,
            runtime.getSetting("TELEGRAM_BOT_TOKEN")
        );

        await tg.start();

        elizaLogger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );
        return tg;
    },
    stop: async (_runtime: IAgentRuntime) => {
        elizaLogger.warn("Telegram client does not support stopping yet");
    },
};

export default TelegramClientInterface;
