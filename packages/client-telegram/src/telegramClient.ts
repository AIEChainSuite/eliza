import {Scenes, Telegraf} from "telegraf";
import {elizaLogger, IAgentRuntime} from "@ai16z/eliza";
import {MessageManager} from "./messageManager.ts";
import {getOrCreateRecommenderInBe} from "./getOrCreateRecommenderInBe.ts";


interface WizardContext extends Scenes.WizardContext<Scenes.WizardSessionData> {
    scene: Scenes.SceneContextScene<WizardContext, Scenes.WizardSessionData>;
    wizard: Scenes.WizardContextWizard<WizardContext>;
}

export class TelegramClient {
    private readonly bot: Telegraf<WizardContext>;
    private readonly runtime: IAgentRuntime;
    private messageManager: MessageManager;
    private readonly backend: any;
    private readonly backendToken: any;
    private readonly tgTrader: any;

    constructor(runtime: IAgentRuntime, botToken: string) {
        elizaLogger.log("📱 Constructing new TelegramClient...");
        this.runtime = runtime;
        this.bot = new Telegraf(botToken);
        this.messageManager = new MessageManager(this.bot, this.runtime);
        this.backend = runtime.getSetting("BACKEND_URL");
        this.backendToken = runtime.getSetting("BACKEND_TOKEN");
        this.tgTrader = runtime.getSetting("TG_TRADER"); // boolean To Be added to the settings
        elizaLogger.log("✅ TelegramClient constructor completed");
    }

    public async start(): Promise<void> {
        elizaLogger.log("🚀 Starting Telegram bot...");
        try {
            await this.initializeBot();
            this.setupMessageHandlers();
            this.setupShutdownHandlers();
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Telegram bot:", error);
            throw error;
        }
    }

    private async initializeBot(): Promise<void> {
        this.bot.launch({ dropPendingUpdates: true });
        elizaLogger.log(
            "✨ Telegram bot successfully launched and is running!"
        );

        const botInfo = await this.bot.telegram.getMe();
        this.bot.botInfo = botInfo;
        elizaLogger.success(`Bot username: @${botInfo.username}`);

        this.messageManager.bot = this.bot;
    }



    private setupMessageHandlers(): void {
        elizaLogger.log("Setting up message handler...");
        //handle start command
        this.bot.start(async (ctx) => {
            elizaLogger.log(`${ctx.from.username} on start bot`)
            const startMessage = `
              🤖 *Welcome ${ctx.from.username}!*

              I am your AI assistant bot.

              Commands:
              - /help - Show all commands
              - /start - Start conversation
              - /info - Show information
              - /new - Create new Character
              - /characters - Show All your character

              Send me a message to begin!
              `;
            await ctx.reply(startMessage)
        })
        // Handle voice command
        this.bot.command('audio', async (ctx) => {

            await ctx.scene.enter('chat_voice');
        })
        // Handle image command
        this.bot.command('image', async (ctx) => {

        })

        this.bot.on("message", async (ctx) => {
            try {
                if (this.tgTrader) {
                    const userId = ctx.from?.id.toString();
                    const username =
                        ctx.from?.username || ctx.from?.first_name || "Unknown";
                    if (!userId) {
                        elizaLogger.warn(
                            "Received message from a user without an ID."
                        );
                        return;
                    }
                    try {
                        await getOrCreateRecommenderInBe(
                            userId,
                            username,
                            this.backendToken,
                            this.backend
                        );
                    } catch (error) {
                        elizaLogger.error(
                            "Error getting or creating recommender in backend",
                            error
                        );
                    }
                }
                await this.messageManager.handleMessage(ctx);
            } catch (error) {
                elizaLogger.error("❌ Error handling message:", error);
                await ctx.reply(
                    "An error occurred while processing your message."
                );
            }
        });


        this.bot.catch(async (err, ctx) => {
            elizaLogger.error(`❌ Telegram Error for ${ctx.updateType}:`, err);
            await ctx.reply("An unexpected error occurred. Please try again later.");
        });
    }

    private setupShutdownHandlers(): void {
        const shutdownHandler = async (signal: string) => {
            elizaLogger.log(
                `⚠️ Received ${signal}. Shutting down Telegram bot gracefully...`
            );
            try {
                await this.stop();
                elizaLogger.log("🛑 Telegram bot stopped gracefully");
            } catch (error) {
                elizaLogger.error(
                    "❌ Error during Telegram bot shutdown:",
                    error
                );
                throw error;
            }
        };

        process.once("SIGINT", () => shutdownHandler("SIGINT"));
        process.once("SIGTERM", () => shutdownHandler("SIGTERM"));
        process.once("SIGHUP", () => shutdownHandler("SIGHUP"));
    }

    public async stop(): Promise<void> {
        elizaLogger.log("Stopping Telegram bot...");
        this.bot.stop();
        elizaLogger.log("Telegram bot stopped");
    }
}
