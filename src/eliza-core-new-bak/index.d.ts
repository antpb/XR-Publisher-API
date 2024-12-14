import { Readable } from 'stream';
import { GenerateObjectResult } from 'ai';
import { TiktokenModel } from 'js-tiktoken';
import { ZodSchema, z } from 'zod';

/**
 * Represents a UUID string in the format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 */
type UUID = `${string}-${string}-${string}-${string}-${string}`;
/**
 * Represents the content of a message or communication
 */
interface Content {
    /** The main text content */
    text: string;
    /** Optional action associated with the message */
    action?: string;
    /** Optional source/origin of the content */
    source?: string;
    /** URL of the original message/post (e.g. tweet URL, Discord message link) */
    url?: string;
    /** UUID of parent message if this is a reply/thread */
    inReplyTo?: UUID;
    /** Array of media attachments */
    attachments?: Media[];
    /** Additional dynamic properties */
    [key: string]: unknown;
}
/**
 * Example content with associated user for demonstration purposes
 */
interface ActionExample {
    /** User associated with the example */
    user: string;
    /** Content of the example */
    content: Content;
}
/**
 * Example conversation content with user ID
 */
interface ConversationExample {
    /** UUID of user in conversation */
    userId: UUID;
    /** Content of the conversation */
    content: Content;
}
/**
 * Represents an actor/participant in a conversation
 */
interface Actor {
    /** Display name */
    name: string;
    /** Username/handle */
    username: string;
    /** Additional profile details */
    details: {
        /** Short profile tagline */
        tagline: string;
        /** Longer profile summary */
        summary: string;
        /** Favorite quote */
        quote: string;
    };
    /** Unique identifier */
    id: UUID;
}
/**
 * Represents a single objective within a goal
 */
interface Objective {
    /** Optional unique identifier */
    id?: string;
    /** Description of what needs to be achieved */
    description: string;
    /** Whether objective is completed */
    completed: boolean;
}
/**
 * Status enum for goals
 */
declare enum GoalStatus {
    DONE = "DONE",
    FAILED = "FAILED",
    IN_PROGRESS = "IN_PROGRESS"
}
/**
 * Represents a high-level goal composed of objectives
 */
interface Goal {
    /** Optional unique identifier */
    id?: UUID;
    /** Room ID where goal exists */
    roomId: UUID;
    /** User ID of goal owner */
    userId: UUID;
    /** Name/title of the goal */
    name: string;
    /** Current status */
    status: GoalStatus;
    /** Component objectives */
    objectives: Objective[];
}
/**
 * Model size/type classification
 */
declare enum ModelClass {
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    EMBEDDING = "embedding",
    IMAGE = "image"
}
/**
 * Configuration for an AI model
 */
type Model = {
    /** Optional API endpoint */
    endpoint?: string;
    /** Model settings */
    settings: {
        /** Maximum input tokens */
        maxInputTokens: number;
        /** Maximum output tokens */
        maxOutputTokens: number;
        /** Optional frequency penalty */
        frequency_penalty?: number;
        /** Optional presence penalty */
        presence_penalty?: number;
        /** Optional repetition penalty */
        repetition_penalty?: number;
        /** Stop sequences */
        stop: string[];
        /** Temperature setting */
        temperature: number;
    };
    /** Optional image generation settings */
    imageSettings?: {
        steps?: number;
    };
    /** Model names by size class */
    model: {
        [ModelClass.SMALL]: string;
        [ModelClass.MEDIUM]: string;
        [ModelClass.LARGE]: string;
        [ModelClass.EMBEDDING]?: string;
        [ModelClass.IMAGE]?: string;
    };
};
/**
 * Model configurations by provider
 */
type Models = {
    [ModelProviderName.OPENAI]: Model;
    [ModelProviderName.ETERNALAI]: Model;
    [ModelProviderName.ANTHROPIC]: Model;
    [ModelProviderName.GROK]: Model;
    [ModelProviderName.GROQ]: Model;
    [ModelProviderName.LLAMACLOUD]: Model;
    [ModelProviderName.LLAMALOCAL]: Model;
    [ModelProviderName.GOOGLE]: Model;
    [ModelProviderName.CLAUDE_VERTEX]: Model;
    [ModelProviderName.REDPILL]: Model;
    [ModelProviderName.OPENROUTER]: Model;
    [ModelProviderName.OLLAMA]: Model;
    [ModelProviderName.HEURIST]: Model;
    [ModelProviderName.GALADRIEL]: Model;
    [ModelProviderName.FAL]: Model;
};
/**
 * Available model providers
 */
declare enum ModelProviderName {
    OPENAI = "openai",
    ETERNALAI = "eternalai",
    ANTHROPIC = "anthropic",
    GROK = "grok",
    GROQ = "groq",
    LLAMACLOUD = "llama_cloud",
    LLAMALOCAL = "llama_local",
    GOOGLE = "google",
    CLAUDE_VERTEX = "claude_vertex",
    REDPILL = "redpill",
    OPENROUTER = "openrouter",
    OLLAMA = "ollama",
    HEURIST = "heurist",
    GALADRIEL = "galadriel",
    FAL = "falai"
}
/**
 * Represents the current state/context of a conversation
 */
interface State {
    /** ID of user who sent current message */
    userId?: UUID;
    /** ID of agent in conversation */
    agentId?: UUID;
    /** Agent's biography */
    bio: string;
    /** Agent's background lore */
    lore: string;
    /** Message handling directions */
    messageDirections: string;
    /** Post handling directions */
    postDirections: string;
    /** Current room/conversation ID */
    roomId: UUID;
    /** Optional agent name */
    agentName?: string;
    /** Optional message sender name */
    senderName?: string;
    /** String representation of conversation actors */
    actors: string;
    /** Optional array of actor objects */
    actorsData?: Actor[];
    /** Optional string representation of goals */
    goals?: string;
    /** Optional array of goal objects */
    goalsData?: Goal[];
    /** Recent message history as string */
    recentMessages: string;
    /** Recent message objects */
    recentMessagesData: Memory[];
    /** Optional valid action names */
    actionNames?: string;
    /** Optional action descriptions */
    actions?: string;
    /** Optional action objects */
    actionsData?: Action[];
    /** Optional action examples */
    actionExamples?: string;
    /** Optional provider descriptions */
    providers?: string;
    /** Optional response content */
    responseData?: Content;
    /** Optional recent interaction objects */
    recentInteractionsData?: Memory[];
    /** Optional recent interactions string */
    recentInteractions?: string;
    /** Optional formatted conversation */
    formattedConversation?: string;
    /** Optional formatted knowledge */
    knowledge?: string;
    /** Optional knowledge data */
    knowledgeData?: KnowledgeItem[];
    /** Additional dynamic properties */
    [key: string]: unknown;
}
/**
 * Represents a stored memory/message
 */
interface Memory {
    /** Optional unique identifier */
    id?: UUID;
    /** Associated user ID */
    userId: UUID;
    /** Associated agent ID */
    agentId: UUID;
    /** Optional creation timestamp */
    createdAt?: number;
    /** Memory content */
    content: Content;
    /** Optional embedding vector */
    embedding?: number[];
    /** Associated room ID */
    roomId: UUID;
    /** Whether memory is unique */
    unique?: boolean;
    /** Embedding similarity score */
    similarity?: number;
}
/**
 * Example message for demonstration
 */
interface MessageExample {
    /** Associated user */
    user: string;
    /** Message content */
    content: Content;
}
/**
 * Handler function type for processing messages
 */
type Handler = (runtime: IAgentRuntime, message: Memory, state?: State, options?: {
    [key: string]: unknown;
}, callback?: HandlerCallback) => Promise<unknown>;
/**
 * Callback function type for handlers
 */
type HandlerCallback = (response: Content, files?: any) => Promise<Memory[]>;
/**
 * Validator function type for actions/evaluators
 */
type Validator = (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
/**
 * Represents an action the agent can perform
 */
interface Action {
    /** Similar action descriptions */
    similes: string[];
    /** Detailed description */
    description: string;
    /** Example usages */
    examples: ActionExample[][];
    /** Handler function */
    handler: Handler;
    /** Action name */
    name: string;
    /** Validation function */
    validate: Validator;
}
/**
 * Example for evaluating agent behavior
 */
interface EvaluationExample {
    /** Evaluation context */
    context: string;
    /** Example messages */
    messages: Array<ActionExample>;
    /** Expected outcome */
    outcome: string;
}
/**
 * Evaluator for assessing agent responses
 */
interface Evaluator {
    /** Whether to always run */
    alwaysRun?: boolean;
    /** Detailed description */
    description: string;
    /** Similar evaluator descriptions */
    similes: string[];
    /** Example evaluations */
    examples: EvaluationExample[];
    /** Handler function */
    handler: Handler;
    /** Evaluator name */
    name: string;
    /** Validation function */
    validate: Validator;
}
/**
 * Provider for external data/services
 */
interface Provider {
    /** Data retrieval function */
    get: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<any>;
}
/**
 * Represents a relationship between users
 */
interface Relationship {
    /** Unique identifier */
    id: UUID;
    /** First user ID */
    userA: UUID;
    /** Second user ID */
    userB: UUID;
    /** Primary user ID */
    userId: UUID;
    /** Associated room ID */
    roomId: UUID;
    /** Relationship status */
    status: string;
    /** Optional creation timestamp */
    createdAt?: string;
}
/**
 * Represents a user account
 */
interface Account {
    /** Unique identifier */
    id: UUID;
    /** Display name */
    name: string;
    /** Username */
    username: string;
    /** Optional additional details */
    details?: {
        [key: string]: any;
    };
    /** Optional email */
    email?: string;
    /** Optional avatar URL */
    avatarUrl?: string;
}
/**
 * Room participant with account details
 */
interface Participant {
    /** Unique identifier */
    id: UUID;
    /** Associated account */
    account: Account;
}
/**
 * Represents a conversation room
 */
interface Room {
    /** Unique identifier */
    id: UUID;
    /** Room participants */
    participants: Participant[];
}
/**
 * Represents a media attachment
 */
type Media = {
    /** Unique identifier */
    id: string;
    /** Media URL */
    url: string;
    /** Media title */
    title: string;
    /** Media source */
    source: string;
    /** Media description */
    description: string;
    /** Text content */
    text: string;
};
/**
 * Client interface for platform connections
 */
type Client = {
    /** Start client connection */
    start: (runtime?: IAgentRuntime) => Promise<unknown>;
    /** Stop client connection */
    stop: (runtime?: IAgentRuntime) => Promise<unknown>;
};
/**
 * Plugin for extending agent functionality
 */
type Plugin = {
    /** Plugin name */
    name: string;
    /** Plugin description */
    description: string;
    /** Optional actions */
    actions?: Action[];
    /** Optional providers */
    providers?: Provider[];
    /** Optional evaluators */
    evaluators?: Evaluator[];
    /** Optional services */
    services?: Service[];
    /** Optional clients */
    clients?: Client[];
};
/**
 * Available client platforms
 */
declare enum Clients {
    DISCORD = "discord",
    DIRECT = "direct",
    TWITTER = "twitter",
    TELEGRAM = "telegram"
}
/**
 * Configuration for an agent character
 */
type Character = {
    /** Optional unique identifier */
    id?: UUID;
    /** Character name */
    name: string;
    /** Optional username */
    username?: string;
    /** Optional system prompt */
    system?: string;
    /** Model provider to use */
    modelProvider: ModelProviderName;
    /** Image model provider to use, if different from modelProvider */
    imageModelProvider?: ModelProviderName;
    /** Optional model endpoint override */
    modelEndpointOverride?: string;
    /** Optional prompt templates */
    templates?: {
        goalsTemplate?: string;
        factsTemplate?: string;
        messageHandlerTemplate?: string;
        shouldRespondTemplate?: string;
        continueMessageHandlerTemplate?: string;
        evaluationTemplate?: string;
        twitterSearchTemplate?: string;
        twitterPostTemplate?: string;
        twitterMessageHandlerTemplate?: string;
        twitterShouldRespondTemplate?: string;
        farcasterPostTemplate?: string;
        farcasterMessageHandlerTemplate?: string;
        farcasterShouldRespondTemplate?: string;
        telegramMessageHandlerTemplate?: string;
        telegramShouldRespondTemplate?: string;
        discordVoiceHandlerTemplate?: string;
        discordShouldRespondTemplate?: string;
        discordMessageHandlerTemplate?: string;
    };
    /** Character biography */
    bio: string | string[];
    /** Character background lore */
    lore: string[];
    /** Example messages */
    messageExamples: MessageExample[][];
    /** Example posts */
    postExamples: string[];
    /** Known topics */
    topics: string[];
    /** Character traits */
    adjectives: string[];
    /** Optional knowledge base */
    knowledge?: string[];
    /** Supported client platforms */
    clients: Clients[];
    /** Available plugins */
    plugins: Plugin[];
    /** Optional configuration */
    settings?: {
        secrets?: {
            [key: string]: string;
        };
        buttplug?: boolean;
        voice?: {
            model?: string;
            url?: string;
        };
        model?: string;
        embeddingModel?: string;
        chains?: {
            evm?: any[];
            solana?: any[];
            [key: string]: any[];
        };
    };
    /** Optional client-specific config */
    clientConfig?: {
        discord?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
        telegram?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
    };
    /** Writing style guides */
    style: {
        all: string[];
        chat: string[];
        post: string[];
    };
    /** Optional Twitter profile */
    twitterProfile?: {
        id: string;
        username: string;
        screenName: string;
        bio: string;
        nicknames?: string[];
    };
};
/**
 * Interface for database operations
 */
interface IDatabaseAdapter {
    /** Database instance */
    db: any;
    /** Optional initialization */
    init(): Promise<void>;
    /** Close database connection */
    close(): Promise<void>;
    /** Get account by ID */
    getAccountById(userId: UUID): Promise<Account | null>;
    /** Create new account */
    createAccount(account: Account): Promise<boolean>;
    /** Get memories matching criteria */
    getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
        agentId: UUID;
        start?: number;
        end?: number;
    }): Promise<Memory[]>;
    getMemoryById(id: UUID): Promise<Memory | null>;
    getMemoriesByRoomIds(params: {
        tableName: string;
        agentId: UUID;
        roomIds: UUID[];
    }): Promise<Memory[]>;
    getCachedEmbeddings(params: {
        query_table_name: string;
        query_threshold: number;
        query_input: string;
        query_field_name: string;
        query_field_sub_name: string;
        query_match_count: number;
    }): Promise<{
        embedding: number[];
        levenshtein_score: number;
    }[]>;
    log(params: {
        body: {
            [key: string]: unknown;
        };
        userId: UUID;
        roomId: UUID;
        type: string;
    }): Promise<void>;
    getActorDetails(params: {
        roomId: UUID;
    }): Promise<Actor[]>;
    searchMemories(params: {
        tableName: string;
        agentId: UUID;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        match_count: number;
        unique: boolean;
    }): Promise<Memory[]>;
    updateGoalStatus(params: {
        goalId: UUID;
        status: GoalStatus;
    }): Promise<void>;
    searchMemoriesByEmbedding(embedding: number[], params: {
        match_threshold?: number;
        count?: number;
        roomId?: UUID;
        agentId?: UUID;
        unique?: boolean;
        tableName: string;
    }): Promise<Memory[]>;
    createMemory(memory: Memory, tableName: string, unique?: boolean): Promise<void>;
    removeMemory(memoryId: UUID, tableName: string): Promise<void>;
    removeAllMemories(roomId: UUID, tableName: string): Promise<void>;
    countMemories(roomId: UUID, unique?: boolean, tableName?: string): Promise<number>;
    getGoals(params: {
        agentId: UUID;
        roomId: UUID;
        userId?: UUID | null;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<Goal[]>;
    updateGoal(goal: Goal): Promise<void>;
    createGoal(goal: Goal): Promise<void>;
    removeGoal(goalId: UUID): Promise<void>;
    removeAllGoals(roomId: UUID): Promise<void>;
    getRoom(roomId: UUID): Promise<UUID | null>;
    createRoom(roomId?: UUID): Promise<UUID>;
    removeRoom(roomId: UUID): Promise<void>;
    getRoomsForParticipant(userId: UUID): Promise<UUID[]>;
    getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;
    addParticipant(userId: UUID, roomId: UUID): Promise<boolean>;
    removeParticipant(userId: UUID, roomId: UUID): Promise<boolean>;
    getParticipantsForAccount(userId: UUID): Promise<Participant[]>;
    getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;
    getParticipantUserState(roomId: UUID, userId: UUID): Promise<"FOLLOWED" | "MUTED" | null>;
    setParticipantUserState(roomId: UUID, userId: UUID, state: "FOLLOWED" | "MUTED" | null): Promise<void>;
    createRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<boolean>;
    getRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<Relationship | null>;
    getRelationships(params: {
        userId: UUID;
    }): Promise<Relationship[]>;
}
interface IDatabaseCacheAdapter {
    getCache(params: {
        agentId: UUID;
        key: string;
    }): Promise<string | undefined>;
    setCache(params: {
        agentId: UUID;
        key: string;
        value: string;
    }): Promise<boolean>;
    deleteCache(params: {
        agentId: UUID;
        key: string;
    }): Promise<boolean>;
}
interface IMemoryManager {
    runtime: IAgentRuntime;
    tableName: string;
    constructor: Function;
    addEmbeddingToMemory(memory: Memory): Promise<Memory>;
    getMemories(opts: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        start?: number;
        end?: number;
    }): Promise<Memory[]>;
    getCachedEmbeddings(content: string): Promise<{
        embedding: number[];
        levenshtein_score: number;
    }[]>;
    getMemoryById(id: UUID): Promise<Memory | null>;
    getMemoriesByRoomIds(params: {
        roomIds: UUID[];
    }): Promise<Memory[]>;
    searchMemoriesByEmbedding(embedding: number[], opts: {
        match_threshold?: number;
        count?: number;
        roomId: UUID;
        unique?: boolean;
    }): Promise<Memory[]>;
    createMemory(memory: Memory, unique?: boolean): Promise<void>;
    removeMemory(memoryId: UUID): Promise<void>;
    removeAllMemories(roomId: UUID): Promise<void>;
    countMemories(roomId: UUID, unique?: boolean): Promise<number>;
}
type CacheOptions = {
    expires?: number;
};
interface ICacheManager {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    delete(key: string): Promise<void>;
}
declare abstract class Service {
    private static instance;
    static get serviceType(): ServiceType;
    static getInstance<T extends Service>(): T;
    get serviceType(): ServiceType;
    abstract initialize(runtime: IAgentRuntime): Promise<void>;
}
interface IAgentRuntime {
    agentId: UUID;
    serverUrl: string;
    databaseAdapter: IDatabaseAdapter;
    token: string | null;
    modelProvider: ModelProviderName;
    imageModelProvider: ModelProviderName;
    character: Character;
    providers: Provider[];
    actions: Action[];
    evaluators: Evaluator[];
    plugins: Plugin[];
    messageManager: IMemoryManager;
    descriptionManager: IMemoryManager;
    documentsManager: IMemoryManager;
    knowledgeManager: IMemoryManager;
    loreManager: IMemoryManager;
    cacheManager: ICacheManager;
    services: Map<ServiceType, Service>;
    initialize(): Promise<void>;
    registerMemoryManager(manager: IMemoryManager): void;
    getMemoryManager(name: string): IMemoryManager | null;
    getService<T extends Service>(service: ServiceType): T | null;
    registerService(service: Service): void;
    getSetting(key: string): string | null;
    getConversationLength(): number;
    processActions(message: Memory, responses: Memory[], state?: State, callback?: HandlerCallback): Promise<void>;
    evaluate(message: Memory, state?: State, didRespond?: boolean): Promise<string[]>;
    ensureParticipantExists(userId: UUID, roomId: UUID): Promise<void>;
    ensureUserExists(userId: UUID, userName: string | null, name: string | null, source: string | null): Promise<void>;
    registerAction(action: Action): void;
    ensureConnection(userId: UUID, roomId: UUID, userName?: string, userScreenName?: string, source?: string): Promise<void>;
    ensureParticipantInRoom(userId: UUID, roomId: UUID): Promise<void>;
    ensureRoomExists(roomId: UUID): Promise<void>;
    composeState(message: Memory, additionalKeys?: {
        [key: string]: unknown;
    }): Promise<State>;
    updateRecentMessageState(state: State): Promise<State>;
}
interface IImageDescriptionService extends Service {
    describeImage(imageUrl: string): Promise<{
        title: string;
        description: string;
    }>;
}
interface ITranscriptionService extends Service {
    transcribeAttachment(audioBuffer: ArrayBuffer): Promise<string | null>;
    transcribeAttachmentLocally(audioBuffer: ArrayBuffer): Promise<string | null>;
    transcribe(audioBuffer: ArrayBuffer): Promise<string | null>;
    transcribeLocally(audioBuffer: ArrayBuffer): Promise<string | null>;
}
interface IVideoService extends Service {
    isVideoUrl(url: string): boolean;
    fetchVideoInfo(url: string): Promise<Media>;
    downloadVideo(videoInfo: Media): Promise<string>;
    processVideo(url: string, runtime: IAgentRuntime): Promise<Media>;
}
interface ITextGenerationService extends Service {
    initializeModel(): Promise<void>;
    queueMessageCompletion(context: string, temperature: number, stop: string[], frequency_penalty: number, presence_penalty: number, max_tokens: number): Promise<any>;
    queueTextCompletion(context: string, temperature: number, stop: string[], frequency_penalty: number, presence_penalty: number, max_tokens: number): Promise<string>;
    getEmbeddingResponse(input: string): Promise<number[] | undefined>;
}
interface IBrowserService extends Service {
    closeBrowser(): Promise<void>;
    getPageContent(url: string, runtime: IAgentRuntime): Promise<{
        title: string;
        description: string;
        bodyContent: string;
    }>;
}
interface ISpeechService extends Service {
    getInstance(): ISpeechService;
    generate(runtime: IAgentRuntime, text: string): Promise<Readable>;
}
interface IPdfService extends Service {
    getInstance(): IPdfService;
    convertPdfToText(pdfBuffer: Buffer): Promise<string>;
}
type SearchResult = {
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content: string | null;
};
type SearchResponse = {
    query: string;
    follow_up_questions: string[] | null;
    answer: string | null;
    images: string[];
    results: SearchResult[];
    response_time: number;
};
declare enum ServiceType {
    IMAGE_DESCRIPTION = "image_description",
    TRANSCRIPTION = "transcription",
    VIDEO = "video",
    TEXT_GENERATION = "text_generation",
    BROWSER = "browser",
    SPEECH_GENERATION = "speech_generation",
    PDF = "pdf",
    BUTTPLUG = "buttplug"
}
declare enum LoggingLevel {
    DEBUG = "debug",
    VERBOSE = "verbose",
    NONE = "none"
}
type KnowledgeItem = {
    id: UUID;
    content: Content;
};

/**
 * Composes a set of example conversations based on provided actions and a specified count.
 * It randomly selects examples from the provided actions and formats them with generated names.
 * @param actionsData - An array of `Action` objects from which to draw examples.
 * @param count - The number of examples to generate.
 * @returns A string containing formatted examples of conversations.
 */
declare const composeActionExamples: (actionsData: Action[], count: number) => string;
/**
 * Formats the names of the provided actions into a comma-separated string.
 * @param actions - An array of `Action` objects from which to extract names.
 * @returns A comma-separated string of action names.
 */
declare function formatActionNames(actions: Action[]): string;
/**
 * Formats the provided actions into a detailed string listing each action's name and description, separated by commas and newlines.
 * @param actions - An array of `Action` objects to format.
 * @returns A detailed string of actions, including names and descriptions.
 */
declare function formatActions(actions: Action[]): string;

/**
 * Composes a context string by replacing placeholders in a template with corresponding values from the state.
 *
 * This function takes a template string with placeholders in the format `{{placeholder}}` and a state object.
 * It replaces each placeholder with the value from the state object that matches the placeholder's name.
 * If a matching key is not found in the state object for a given placeholder, the placeholder is replaced with an empty string.
 *
 * @param {Object} params - The parameters for composing the context.
 * @param {State} params.state - The state object containing values to replace the placeholders in the template.
 * @param {string} params.template - The template string containing placeholders to be replaced with state values.
 * @returns {string} The composed context string with placeholders replaced by corresponding state values.
 *
 * @example
 * // Given a state object and a template
 * const state = { userName: "Alice", userAge: 30 };
 * const template = "Hello, {{userName}}! You are {{userAge}} years old";
 *
 * // Composing the context will result in:
 * // "Hello, Alice! You are 30 years old."
 * const context = composeContext({ state, template });
 */
declare const composeContext: ({ state, template, }: {
    state: State;
    template: string;
}) => string;
/**
 * Adds a header to a body of text.
 *
 * This function takes a header string and a body string and returns a new string with the header prepended to the body.
 * If the body string is empty, the header is returned as is.
 *
 * @param {string} header - The header to add to the body.
 * @param {string} body - The body to which to add the header.
 * @returns {string} The body with the header prepended.
 *
 * @example
 * // Given a header and a body
 * const header = "Header";
 * const body = "Body";
 *
 * // Adding the header to the body will result in:
 * // "Header\nBody"
 * const text = addHeader(header, body);
 */
declare const addHeader: (header: string, body: string) => string;

/**
 * An abstract class representing a database adapter for managing various entities
 * like accounts, memories, actors, goals, and rooms.
 */
declare abstract class DatabaseAdapter<DB = any> implements IDatabaseAdapter {
    /**
     * The database instance.
     */
    db: DB;
    /**
     * Optional initialization method for the database adapter.
     * @returns A Promise that resolves when initialization is complete.
     */
    abstract init(): Promise<void>;
    /**
     * Optional close method for the database adapter.
     * @returns A Promise that resolves when closing is complete.
     */
    abstract close(): Promise<void>;
    /**
     * Retrieves an account by its ID.
     * @param userId The UUID of the user account to retrieve.
     * @returns A Promise that resolves to the Account object or null if not found.
     */
    abstract getAccountById(userId: UUID): Promise<Account | null>;
    /**
     * Creates a new account in the database.
     * @param account The account object to create.
     * @returns A Promise that resolves when the account creation is complete.
     */
    abstract createAccount(account: Account): Promise<boolean>;
    /**
     * Retrieves memories based on the specified parameters.
     * @param params An object containing parameters for the memory retrieval.
     * @returns A Promise that resolves to an array of Memory objects.
     */
    abstract getMemories(params: {
        agentId: UUID;
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
    }): Promise<Memory[]>;
    abstract getMemoriesByRoomIds(params: {
        agentId: UUID;
        roomIds: UUID[];
        tableName: string;
    }): Promise<Memory[]>;
    abstract getMemoryById(id: UUID): Promise<Memory | null>;
    /**
     * Retrieves cached embeddings based on the specified query parameters.
     * @param params An object containing parameters for the embedding retrieval.
     * @returns A Promise that resolves to an array of objects containing embeddings and levenshtein scores.
     */
    abstract getCachedEmbeddings({ query_table_name, query_threshold, query_input, query_field_name, query_field_sub_name, query_match_count, }: {
        query_table_name: string;
        query_threshold: number;
        query_input: string;
        query_field_name: string;
        query_field_sub_name: string;
        query_match_count: number;
    }): Promise<{
        embedding: number[];
        levenshtein_score: number;
    }[]>;
    /**
     * Logs an event or action with the specified details.
     * @param params An object containing parameters for the log entry.
     * @returns A Promise that resolves when the log entry has been saved.
     */
    abstract log(params: {
        body: {
            [key: string]: unknown;
        };
        userId: UUID;
        roomId: UUID;
        type: string;
    }): Promise<void>;
    /**
     * Retrieves details of actors in a given room.
     * @param params An object containing the roomId to search for actors.
     * @returns A Promise that resolves to an array of Actor objects.
     */
    abstract getActorDetails(params: {
        roomId: UUID;
    }): Promise<Actor[]>;
    /**
     * Searches for memories based on embeddings and other specified parameters.
     * @param params An object containing parameters for the memory search.
     * @returns A Promise that resolves to an array of Memory objects.
     */
    abstract searchMemories(params: {
        tableName: string;
        agentId: UUID;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        match_count: number;
        unique: boolean;
    }): Promise<Memory[]>;
    /**
     * Updates the status of a specific goal.
     * @param params An object containing the goalId and the new status.
     * @returns A Promise that resolves when the goal status has been updated.
     */
    abstract updateGoalStatus(params: {
        goalId: UUID;
        status: GoalStatus;
    }): Promise<void>;
    /**
     * Searches for memories by embedding and other specified parameters.
     * @param embedding The embedding vector to search with.
     * @param params Additional parameters for the search.
     * @returns A Promise that resolves to an array of Memory objects.
     */
    abstract searchMemoriesByEmbedding(embedding: number[], params: {
        match_threshold?: number;
        count?: number;
        roomId?: UUID;
        agentId?: UUID;
        unique?: boolean;
        tableName: string;
    }): Promise<Memory[]>;
    /**
     * Creates a new memory in the database.
     * @param memory The memory object to create.
     * @param tableName The table where the memory should be stored.
     * @param unique Indicates if the memory should be unique.
     * @returns A Promise that resolves when the memory has been created.
     */
    abstract createMemory(memory: Memory, tableName: string, unique?: boolean): Promise<void>;
    /**
     * Removes a specific memory from the database.
     * @param memoryId The UUID of the memory to remove.
     * @param tableName The table from which the memory should be removed.
     * @returns A Promise that resolves when the memory has been removed.
     */
    abstract removeMemory(memoryId: UUID, tableName: string): Promise<void>;
    /**
     * Removes all memories associated with a specific room.
     * @param roomId The UUID of the room whose memories should be removed.
     * @param tableName The table from which the memories should be removed.
     * @returns A Promise that resolves when all memories have been removed.
     */
    abstract removeAllMemories(roomId: UUID, tableName: string): Promise<void>;
    /**
     * Counts the number of memories in a specific room.
     * @param roomId The UUID of the room for which to count memories.
     * @param unique Specifies whether to count only unique memories.
     * @param tableName Optional table name to count memories from.
     * @returns A Promise that resolves to the number of memories.
     */
    abstract countMemories(roomId: UUID, unique?: boolean, tableName?: string): Promise<number>;
    /**
     * Retrieves goals based on specified parameters.
     * @param params An object containing parameters for goal retrieval.
     * @returns A Promise that resolves to an array of Goal objects.
     */
    abstract getGoals(params: {
        agentId: UUID;
        roomId: UUID;
        userId?: UUID | null;
        onlyInProgress?: boolean;
        count?: number;
    }): Promise<Goal[]>;
    /**
     * Updates a specific goal in the database.
     * @param goal The goal object with updated properties.
     * @returns A Promise that resolves when the goal has been updated.
     */
    abstract updateGoal(goal: Goal): Promise<void>;
    /**
     * Creates a new goal in the database.
     * @param goal The goal object to create.
     * @returns A Promise that resolves when the goal has been created.
     */
    abstract createGoal(goal: Goal): Promise<void>;
    /**
     * Removes a specific goal from the database.
     * @param goalId The UUID of the goal to remove.
     * @returns A Promise that resolves when the goal has been removed.
     */
    abstract removeGoal(goalId: UUID): Promise<void>;
    /**
     * Removes all goals associated with a specific room.
     * @param roomId The UUID of the room whose goals should be removed.
     * @returns A Promise that resolves when all goals have been removed.
     */
    abstract removeAllGoals(roomId: UUID): Promise<void>;
    /**
     * Retrieves the room ID for a given room, if it exists.
     * @param roomId The UUID of the room to retrieve.
     * @returns A Promise that resolves to the room ID or null if not found.
     */
    abstract getRoom(roomId: UUID): Promise<UUID | null>;
    /**
     * Creates a new room with an optional specified ID.
     * @param roomId Optional UUID to assign to the new room.
     * @returns A Promise that resolves to the UUID of the created room.
     */
    abstract createRoom(roomId?: UUID): Promise<UUID>;
    /**
     * Removes a specific room from the database.
     * @param roomId The UUID of the room to remove.
     * @returns A Promise that resolves when the room has been removed.
     */
    abstract removeRoom(roomId: UUID): Promise<void>;
    /**
     * Retrieves room IDs for which a specific user is a participant.
     * @param userId The UUID of the user.
     * @returns A Promise that resolves to an array of room IDs.
     */
    abstract getRoomsForParticipant(userId: UUID): Promise<UUID[]>;
    /**
     * Retrieves room IDs for which specific users are participants.
     * @param userIds An array of UUIDs of the users.
     * @returns A Promise that resolves to an array of room IDs.
     */
    abstract getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;
    /**
     * Adds a user as a participant to a specific room.
     * @param userId The UUID of the user to add as a participant.
     * @param roomId The UUID of the room to which the user will be added.
     * @returns A Promise that resolves to a boolean indicating success or failure.
     */
    abstract addParticipant(userId: UUID, roomId: UUID): Promise<boolean>;
    /**
     * Removes a user as a participant from a specific room.
     * @param userId The UUID of the user to remove as a participant.
     * @param roomId The UUID of the room from which the user will be removed.
     * @returns A Promise that resolves to a boolean indicating success or failure.
     */
    abstract removeParticipant(userId: UUID, roomId: UUID): Promise<boolean>;
    /**
     * Retrieves participants associated with a specific account.
     * @param userId The UUID of the account.
     * @returns A Promise that resolves to an array of Participant objects.
     */
    abstract getParticipantsForAccount(userId: UUID): Promise<Participant[]>;
    /**
     * Retrieves participants associated with a specific account.
     * @param userId The UUID of the account.
     * @returns A Promise that resolves to an array of Participant objects.
     */
    abstract getParticipantsForAccount(userId: UUID): Promise<Participant[]>;
    /**
     * Retrieves participants for a specific room.
     * @param roomId The UUID of the room for which to retrieve participants.
     * @returns A Promise that resolves to an array of UUIDs representing the participants.
     */
    abstract getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;
    abstract getParticipantUserState(roomId: UUID, userId: UUID): Promise<"FOLLOWED" | "MUTED" | null>;
    abstract setParticipantUserState(roomId: UUID, userId: UUID, state: "FOLLOWED" | "MUTED" | null): Promise<void>;
    /**
     * Creates a new relationship between two users.
     * @param params An object containing the UUIDs of the two users (userA and userB).
     * @returns A Promise that resolves to a boolean indicating success or failure of the creation.
     */
    abstract createRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<boolean>;
    /**
     * Retrieves a relationship between two users if it exists.
     * @param params An object containing the UUIDs of the two users (userA and userB).
     * @returns A Promise that resolves to the Relationship object or null if not found.
     */
    abstract getRelationship(params: {
        userA: UUID;
        userB: UUID;
    }): Promise<Relationship | null>;
    /**
     * Retrieves all relationships for a specific user.
     * @param params An object containing the UUID of the user.
     * @returns A Promise that resolves to an array of Relationship objects.
     */
    abstract getRelationships(params: {
        userId: UUID;
    }): Promise<Relationship[]>;
}

declare const defaultCharacter: Character;

declare const getEmbeddingConfig: () => {
    dimensions: number;
    model: string;
    provider: string;
};
declare function getEmbeddingType(runtime: IAgentRuntime): "local" | "remote";
declare function getEmbeddingZeroVector(): number[];
/**
 * Gets embeddings from a remote API endpoint.  Falls back to local BGE/384
 *
 * @param {string} input - The text to generate embeddings for
 * @param {EmbeddingOptions} options - Configuration options including:
 *   - model: The model name to use
 *   - endpoint: Base API endpoint URL
 *   - apiKey: Optional API key for authentication
 *   - isOllama: Whether this is an Ollama endpoint
 *   - dimensions: Desired embedding dimensions
 * @param {IAgentRuntime} runtime - The agent runtime context
 * @returns {Promise<number[]>} Array of embedding values
 * @throws {Error} If the API request fails
 */
declare function embed(runtime: IAgentRuntime, input: string): Promise<number[]>;

/**
 * Template used for the evaluation generateText.
 */
declare const evaluationTemplate: string;
/**
 * Formats the names of evaluators into a comma-separated list, each enclosed in single quotes.
 * @param evaluators - An array of evaluator objects.
 * @returns A string that concatenates the names of all evaluators, each enclosed in single quotes and separated by commas.
 */
declare function formatEvaluatorNames(evaluators: Evaluator[]): string;
/**
 * Formats evaluator details into a string, including both the name and description of each evaluator.
 * @param evaluators - An array of evaluator objects.
 * @returns A string that concatenates the name and description of each evaluator, separated by a colon and a newline character.
 */
declare function formatEvaluators(evaluators: Evaluator[]): string;
/**
 * Formats evaluator examples into a readable string, replacing placeholders with generated names.
 * @param evaluators - An array of evaluator objects, each containing examples to format.
 * @returns A string that presents each evaluator example in a structured format, including context, messages, and outcomes, with placeholders replaced by generated names.
 */
declare function formatEvaluatorExamples(evaluators: Evaluator[]): string;
/**
 * Generates a string summarizing the descriptions of each evaluator example.
 * @param evaluators - An array of evaluator objects, each containing examples.
 * @returns A string that summarizes the descriptions for each evaluator example, formatted with the evaluator name, example number, and description.
 */
declare function formatEvaluatorExampleDescriptions(evaluators: Evaluator[]): string;

/**
 * Send a message to the model for a text generateText - receive a string back and parse how you'd like
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */
declare function generateText({ runtime, context, modelClass, stop, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
    stop?: string[];
}): Promise<string>;
/**
 * Truncate the context to the maximum length allowed by the model.
 * @param context The text to truncate
 * @param maxTokens Maximum number of tokens to keep
 * @param model The tokenizer model to use
 * @returns The truncated text
 */
declare function trimTokens(context: string, maxTokens: number, model: TiktokenModel): string;
/**
 * Sends a message to the model to determine if it should respond to the given context.
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to "RESPOND", "IGNORE", "STOP" or null
 */
declare function generateShouldRespond({ runtime, context, modelClass, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<"RESPOND" | "IGNORE" | "STOP" | null>;
/**
 * Splits content into chunks of specified size with optional overlapping bleed sections
 * @param content - The text content to split into chunks
 * @param chunkSize - The maximum size of each chunk in tokens
 * @param bleed - Number of characters to overlap between chunks (default: 100)
 * @returns Promise resolving to array of text chunks with bleed sections
 */
declare function splitChunks(content: string, chunkSize?: number, bleed?: number): Promise<string[]>;
/**
 * Sends a message to the model and parses the response as a boolean value
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for the boolean response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.token The API token for authentication
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to a boolean value parsed from the model's response
 */
declare function generateTrueOrFalse({ runtime, context, modelClass, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<boolean>;
/**
 * Send a message to the model and parse the response as a string array
 * @param opts - The options for the generateText request
 * @param opts.context The context/prompt to send to the model
 * @param opts.stop Array of strings that will stop the model's generation if encountered
 * @param opts.model The language model to use
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.token The API token for authentication
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to an array of strings parsed from the model's response
 */
declare function generateTextArray({ runtime, context, modelClass, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<string[]>;
declare function generateObject({ runtime, context, modelClass, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<any>;
declare function generateObjectArray({ runtime, context, modelClass, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<any[]>;
/**
 * Send a message to the model for generateText.
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */
declare function generateMessageResponse({ runtime, context, modelClass, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
}): Promise<Content>;
declare const generateImage: (data: {
    prompt: string;
    width: number;
    height: number;
    count?: number;
    negativePrompt?: string;
    numIterations?: number;
    guidanceScale?: number;
    seed?: number;
    modelId?: string;
    jobId?: string;
}, runtime: IAgentRuntime) => Promise<{
    success: boolean;
    data?: string[];
    error?: any;
}>;
declare const generateCaption: (data: {
    imageUrl: string;
}, runtime: IAgentRuntime) => Promise<{
    title: string;
    description: string;
}>;
declare const generateWebSearch: (query: string, runtime: IAgentRuntime) => Promise<SearchResponse>;
/**
 * Configuration options for generating objects with a model.
 */
interface GenerationOptions {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    stop?: string[];
    mode?: "auto" | "json" | "tool";
    experimental_providerMetadata?: Record<string, unknown>;
}
/**
 * Base settings for model generation.
 */
interface ModelSettings {
    prompt: string;
    temperature: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stop?: string[];
}
/**
 * Generates structured objects from a prompt using specified AI models and configuration options.
 *
 * @param {GenerationOptions} options - Configuration options for generating objects.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 * @throws {Error} - Throws an error if the provider is unsupported or if generation fails.
 */
declare const generateObjectV2: ({ runtime, context, modelClass, schema, schemaName, schemaDescription, stop, mode, }: GenerationOptions) => Promise<GenerateObjectResult<unknown>>;
/**
 * Interface for provider-specific generation options.
 */
interface ProviderOptions {
    runtime: IAgentRuntime;
    provider: ModelProviderName;
    model: any;
    apiKey: string;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    mode?: "auto" | "json" | "tool";
    experimental_providerMetadata?: Record<string, unknown>;
    modelOptions: ModelSettings;
    modelClass: string;
    context: string;
}
/**
 * Handles AI generation based on the specified provider.
 *
 * @param {ProviderOptions} options - Configuration options specific to the provider.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 */
declare function handleProvider(options: ProviderOptions): Promise<GenerateObjectResult<unknown>>;

declare const getGoals: ({ runtime, roomId, userId, onlyInProgress, count, }: {
    runtime: IAgentRuntime;
    roomId: UUID;
    userId?: UUID;
    onlyInProgress?: boolean;
    count?: number;
}) => Promise<Goal[]>;
declare const formatGoalsAsString: ({ goals }: {
    goals: Goal[];
}) => string;
declare const updateGoal: ({ runtime, goal, }: {
    runtime: IAgentRuntime;
    goal: Goal;
}) => Promise<void>;
declare const createGoal: ({ runtime, goal, }: {
    runtime: IAgentRuntime;
    goal: Goal;
}) => Promise<void>;

/**
 * Manage memories in the database.
 */
declare class MemoryManager implements IMemoryManager {
    /**
     * The AgentRuntime instance associated with this manager.
     */
    runtime: IAgentRuntime;
    /**
     * The name of the database table this manager operates on.
     */
    tableName: string;
    /**
     * Constructs a new MemoryManager instance.
     * @param opts Options for the manager.
     * @param opts.tableName The name of the table this manager will operate on.
     * @param opts.runtime The AgentRuntime instance associated with this manager.
     */
    constructor(opts: {
        tableName: string;
        runtime: IAgentRuntime;
    });
    /**
     * Adds an embedding vector to a memory object. If the memory already has an embedding, it is returned as is.
     * @param memory The memory object to add an embedding to.
     * @returns A Promise resolving to the memory object, potentially updated with an embedding vector.
     */
    /**
     * Adds an embedding vector to a memory object if one doesn't already exist.
     * The embedding is generated from the memory's text content using the runtime's
     * embedding model. If the memory has no text content, an error is thrown.
     *
     * @param memory The memory object to add an embedding to
     * @returns The memory object with an embedding vector added
     * @throws Error if the memory content is empty
     */
    addEmbeddingToMemory(memory: Memory): Promise<Memory>;
    /**
     * Retrieves a list of memories by user IDs, with optional deduplication.
     * @param opts Options including user IDs, count, and uniqueness.
     * @param opts.roomId The room ID to retrieve memories for.
     * @param opts.count The number of memories to retrieve.
     * @param opts.unique Whether to retrieve unique memories only.
     * @returns A Promise resolving to an array of Memory objects.
     */
    getMemories({ roomId, count, unique, start, end, }: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        start?: number;
        end?: number;
    }): Promise<Memory[]>;
    getCachedEmbeddings(content: string): Promise<{
        embedding: number[];
        levenshtein_score: number;
    }[]>;
    /**
     * Searches for memories similar to a given embedding vector.
     * @param embedding The embedding vector to search with.
     * @param opts Options including match threshold, count, user IDs, and uniqueness.
     * @param opts.match_threshold The similarity threshold for matching memories.
     * @param opts.count The maximum number of memories to retrieve.
     * @param opts.roomId The room ID to retrieve memories for.
     * @param opts.unique Whether to retrieve unique memories only.
     * @returns A Promise resolving to an array of Memory objects that match the embedding.
     */
    searchMemoriesByEmbedding(embedding: number[], opts: {
        match_threshold?: number;
        count?: number;
        roomId: UUID;
        unique?: boolean;
    }): Promise<Memory[]>;
    /**
     * Creates a new memory in the database, with an option to check for similarity before insertion.
     * @param memory The memory object to create.
     * @param unique Whether to check for similarity before insertion.
     * @returns A Promise that resolves when the operation completes.
     */
    createMemory(memory: Memory, unique?: boolean): Promise<void>;
    getMemoriesByRoomIds(params: {
        roomIds: UUID[];
    }): Promise<Memory[]>;
    getMemoryById(id: UUID): Promise<Memory | null>;
    /**
     * Removes a memory from the database by its ID.
     * @param memoryId The ID of the memory to remove.
     * @returns A Promise that resolves when the operation completes.
     */
    removeMemory(memoryId: UUID): Promise<void>;
    /**
     * Removes all memories associated with a set of user IDs.
     * @param roomId The room ID to remove memories for.
     * @returns A Promise that resolves when the operation completes.
     */
    removeAllMemories(roomId: UUID): Promise<void>;
    /**
     * Counts the number of memories associated with a set of user IDs, with an option for uniqueness.
     * @param roomId The room ID to count memories for.
     * @param unique Whether to count unique memories only.
     * @returns A Promise resolving to the count of memories.
     */
    countMemories(roomId: UUID, unique?: boolean): Promise<number>;
}

/**
 * Get details for a list of actors.
 */
declare function getActorDetails({ runtime, roomId, }: {
    runtime: IAgentRuntime;
    roomId: UUID;
}): Promise<Actor[]>;
/**
 * Format actors into a string
 * @param actors - list of actors
 * @returns string
 */
declare function formatActors({ actors }: {
    actors: Actor[];
}): string;
/**
 * Format messages into a string
 * @param messages - list of messages
 * @param actors - list of actors
 * @returns string
 */
declare const formatMessages: ({ messages, actors, }: {
    messages: Memory[];
    actors: Actor[];
}) => string;
declare const formatTimestamp: (messageDate: number) => string;

declare const models: Models;
declare function getModel(provider: ModelProviderName, type: ModelClass): string;
declare function getEndpoint(provider: ModelProviderName): string;

declare const formatPosts: ({ messages, actors, conversationHeader, }: {
    messages: Memory[];
    actors: Actor[];
    conversationHeader?: boolean;
}) => string;

/**
 * Formats provider outputs into a string which can be injected into the context.
 * @param runtime The AgentRuntime object.
 * @param message The incoming message object.
 * @param state The current state object.
 * @returns A string that concatenates the outputs of each provider.
 */
declare function getProviders(runtime: IAgentRuntime, message: Memory, state?: State): Promise<string>;

declare function createRelationship({ runtime, userA, userB, }: {
    runtime: IAgentRuntime;
    userA: UUID;
    userB: UUID;
}): Promise<boolean>;
declare function getRelationship({ runtime, userA, userB, }: {
    runtime: IAgentRuntime;
    userA: UUID;
    userB: UUID;
}): Promise<Relationship>;
declare function getRelationships({ runtime, userId, }: {
    runtime: IAgentRuntime;
    userId: UUID;
}): Promise<Relationship[]>;
declare function formatRelationships({ runtime, userId, }: {
    runtime: IAgentRuntime;
    userId: UUID;
}): Promise<`${string}-${string}-${string}-${string}-${string}`[]>;

/**
 * Represents the runtime environment for an agent, handling message processing,
 * action registration, and interaction with external services like OpenAI and Supabase.
 */
declare class AgentRuntime implements IAgentRuntime {
    #private;
    /**
     * The ID of the agent
     */
    agentId: UUID;
    /**
     * The base URL of the server where the agent's requests are processed.
     */
    serverUrl: string;
    /**
     * The database adapter used for interacting with the database.
     */
    databaseAdapter: IDatabaseAdapter;
    /**
     * Authentication token used for securing requests.
     */
    token: string | null;
    /**
     * Custom actions that the agent can perform.
     */
    actions: Action[];
    /**
     * Evaluators used to assess and guide the agent's responses.
     */
    evaluators: Evaluator[];
    /**
     * Context providers used to provide context for message generation.
     */
    providers: Provider[];
    plugins: Plugin[];
    /**
     * The model to use for generateText.
     */
    modelProvider: ModelProviderName;
    /**
     * The model to use for generateImage.
     */
    imageModelProvider: ModelProviderName;
    /**
     * Fetch function to use
     * Some environments may not have access to the global fetch function and need a custom fetch override.
     */
    fetch: typeof fetch;
    /**
     * The character to use for the agent
     */
    character: Character;
    /**
     * Store messages that are sent and received by the agent.
     */
    messageManager: IMemoryManager;
    /**
     * Store and recall descriptions of users based on conversations.
     */
    descriptionManager: IMemoryManager;
    /**
     * Manage the creation and recall of static information (documents, historical game lore, etc)
     */
    loreManager: IMemoryManager;
    /**
     * Hold large documents that can be referenced
     */
    documentsManager: IMemoryManager;
    /**
     * Searchable document fragments
     */
    knowledgeManager: IMemoryManager;
    services: Map<ServiceType, Service>;
    memoryManagers: Map<string, IMemoryManager>;
    cacheManager: ICacheManager;
    registerMemoryManager(manager: IMemoryManager): void;
    getMemoryManager(tableName: string): IMemoryManager | null;
    getService<T extends Service>(service: ServiceType): T | null;
    registerService(service: Service): Promise<void>;
    /**
     * Creates an instance of AgentRuntime.
     * @param opts - The options for configuring the AgentRuntime.
     * @param opts.conversationLength - The number of messages to hold in the recent message cache.
     * @param opts.token - The JWT token, can be a JWT token if outside worker, or an OpenAI token if inside worker.
     * @param opts.serverUrl - The URL of the worker.
     * @param opts.actions - Optional custom actions.
     * @param opts.evaluators - Optional custom evaluators.
     * @param opts.services - Optional custom services.
     * @param opts.memoryManagers - Optional custom memory managers.
     * @param opts.providers - Optional context providers.
     * @param opts.model - The model to use for generateText.
     * @param opts.embeddingModel - The model to use for embedding.
     * @param opts.agentId - Optional ID of the agent.
     * @param opts.databaseAdapter - The database adapter used for interacting with the database.
     * @param opts.fetch - Custom fetch function to use for making requests.
     */
    constructor(opts: {
        conversationLength?: number;
        agentId?: UUID;
        character?: Character;
        token: string;
        serverUrl?: string;
        actions?: Action[];
        evaluators?: Evaluator[];
        plugins?: Plugin[];
        providers?: Provider[];
        modelProvider: ModelProviderName;
        services?: Service[];
        managers?: IMemoryManager[];
        databaseAdapter: IDatabaseAdapter;
        fetch?: typeof fetch | unknown;
        speechModelPath?: string;
        cacheManager: ICacheManager;
        logging?: boolean;
    });
    initialize(): Promise<void>;
    /**
     * Processes character knowledge by creating document memories and fragment memories.
     * This function takes an array of knowledge items, creates a document memory for each item if it doesn't exist,
     * then chunks the content into fragments, embeds each fragment, and creates fragment memories.
     * @param knowledge An array of knowledge items containing id, path, and content.
     */
    private processCharacterKnowledge;
    getSetting(key: string): any;
    /**
     * Get the number of messages that are kept in the conversation buffer.
     * @returns The number of recent messages to be kept in memory.
     */
    getConversationLength(): number;
    /**
     * Register an action for the agent to perform.
     * @param action The action to register.
     */
    registerAction(action: Action): void;
    /**
     * Register an evaluator to assess and guide the agent's responses.
     * @param evaluator The evaluator to register.
     */
    registerEvaluator(evaluator: Evaluator): void;
    /**
     * Register a context provider to provide context for message generation.
     * @param provider The context provider to register.
     */
    registerContextProvider(provider: Provider): void;
    /**
     * Process the actions of a message.
     * @param message The message to process.
     * @param content The content of the message to process actions from.
     */
    processActions(message: Memory, responses: Memory[], state?: State, callback?: HandlerCallback): Promise<void>;
    /**
     * Evaluate the message and state using the registered evaluators.
     * @param message The message to evaluate.
     * @param state The state of the agent.
     * @param didRespond Whether the agent responded to the message.
     * @returns The results of the evaluation.
     */
    evaluate(message: Memory, state?: State, didRespond?: boolean): Promise<string[]>;
    /**
     * Ensure the existence of a participant in the room. If the participant does not exist, they are added to the room.
     * @param userId - The user ID to ensure the existence of.
     * @throws An error if the participant cannot be added.
     */
    ensureParticipantExists(userId: UUID, roomId: UUID): Promise<void>;
    /**
     * Ensure the existence of a user in the database. If the user does not exist, they are added to the database.
     * @param userId - The user ID to ensure the existence of.
     * @param userName - The user name to ensure the existence of.
     * @returns
     */
    ensureUserExists(userId: UUID, userName: string | null, name: string | null, email?: string | null, source?: string | null): Promise<void>;
    ensureParticipantInRoom(userId: UUID, roomId: UUID): Promise<void>;
    ensureConnection(userId: UUID, roomId: UUID, userName?: string, userScreenName?: string, source?: string): Promise<void>;
    /**
     * Ensure the existence of a room between the agent and a user. If no room exists, a new room is created and the user
     * and agent are added as participants. The room ID is returned.
     * @param userId - The user ID to create a room with.
     * @returns The room ID of the room between the agent and the user.
     * @throws An error if the room cannot be created.
     */
    ensureRoomExists(roomId: UUID): Promise<void>;
    /**
     * Compose the state of the agent into an object that can be passed or used for response generation.
     * @param message The message to compose the state from.
     * @returns The state of the agent.
     */
    composeState(message: Memory, additionalKeys?: {
        [key: string]: unknown;
    }): Promise<State>;
    updateRecentMessageState(state: State): Promise<State>;
}

interface Settings {
    [key: string]: string | undefined;
}
/**
 * Recursively searches for a .env file starting from the current directory
 * and moving up through parent directories (Node.js only)
 * @param {string} [startDir=process.cwd()] - Starting directory for the search
 * @returns {string|null} Path to the nearest .env file or null if not found
 */
declare function findNearestEnvFile(startDir?: string): string;
/**
 * Configures environment settings for browser usage
 * @param {Settings} settings - Object containing environment variables
 */
declare function configureSettings(settings: Settings): void;
/**
 * Loads environment variables from the nearest .env file in Node.js
 * or returns configured settings in browser
 * @returns {Settings} Environment variables object
 * @throws {Error} If no .env file is found in Node.js environment
 */
declare function loadEnvConfig(): Settings;
/**
 * Gets a specific environment variable
 * @param {string} key - The environment variable key
 * @param {string} [defaultValue] - Optional default value if key doesn't exist
 * @returns {string|undefined} The environment variable value or default value
 */
declare function getEnvVariable(key: string, defaultValue?: string): string | undefined;
/**
 * Checks if a specific environment variable exists
 * @param {string} key - The environment variable key
 * @returns {boolean} True if the environment variable exists
 */
declare function hasEnvVariable(key: string): boolean;
declare const settings: Settings;

declare class ElizaLogger {
    #private;
    constructor();
    private isNode;
    verbose: boolean;
    closeByNewLine: boolean;
    useIcons: boolean;
    logsTitle: string;
    warningsTitle: string;
    errorsTitle: string;
    informationsTitle: string;
    successesTitle: string;
    debugsTitle: string;
    assertsTitle: string;
    clear(): void;
    print(foregroundColor?: string, backgroundColor?: string, ...strings: any[]): void;
    log(...strings: any[]): void;
    warn(...strings: any[]): void;
    error(...strings: any[]): void;
    info(...strings: any[]): void;
    debug(...strings: any[]): void;
    success(...strings: any[]): void;
    assert(...strings: any[]): void;
    progress(message: string): void;
}
declare const elizaLogger: ElizaLogger;

declare const messageCompletionFooter = "\nResponse format should be formatted in a JSON block like this:\n```json\n{ \"user\": \"{{agentName}}\", \"text\": string, \"action\": \"string\" }\n```";
declare const shouldRespondFooter = "The available options are [RESPOND], [IGNORE], or [STOP]. Choose the most appropriate option.\nIf {{agentName}} is talking too much, you can choose [IGNORE]\n\nYour response must include one of the options.";
declare const parseShouldRespondFromText: (text: string) => "RESPOND" | "IGNORE" | "STOP" | null;
declare const booleanFooter = "Respond with a YES or a NO.";
declare const parseBooleanFromText: (text: string) => boolean;
declare const stringArrayFooter = "Respond with a JSON array containing the values in a JSON block formatted for markdown with this structure:\n```json\n[\n  'value',\n  'value'\n]\n```\n\nYour response must include the JSON block.";
/**
 * Parses a JSON array from a given text. The function looks for a JSON block wrapped in triple backticks
 * with `json` language identifier, and if not found, it searches for an array pattern within the text.
 * It then attempts to parse the JSON string into a JavaScript object. If parsing is successful and the result
 * is an array, it returns the array; otherwise, it returns null.
 *
 * @param text - The input text from which to extract and parse the JSON array.
 * @returns An array parsed from the JSON string if successful; otherwise, null.
 */
declare function parseJsonArrayFromText(text: string): any[];
/**
 * Parses a JSON object from a given text. The function looks for a JSON block wrapped in triple backticks
 * with `json` language identifier, and if not found, it searches for an object pattern within the text.
 * It then attempts to parse the JSON string into a JavaScript object. If parsing is successful and the result
 * is an object (but not an array), it returns the object; otherwise, it tries to parse an array if the result
 * is an array, or returns null if parsing is unsuccessful or the result is neither an object nor an array.
 *
 * @param text - The input text from which to extract and parse the JSON object.
 * @returns An object parsed from the JSON string if successful; otherwise, null or the result of parsing an array.
 */
declare function parseJSONObjectFromText(text: string): Record<string, any> | null;

declare function stringToUuid(target: string): UUID;

declare const envSchema: z.ZodObject<{
    OPENAI_API_KEY: z.ZodString;
    REDPILL_API_KEY: z.ZodString;
    GROK_API_KEY: z.ZodString;
    GROQ_API_KEY: z.ZodString;
    OPENROUTER_API_KEY: z.ZodString;
    GOOGLE_GENERATIVE_AI_API_KEY: z.ZodString;
    ELEVENLABS_XI_API_KEY: z.ZodString;
}, "strip", z.ZodTypeAny, {
    OPENAI_API_KEY?: string;
    REDPILL_API_KEY?: string;
    GROK_API_KEY?: string;
    GROQ_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    ELEVENLABS_XI_API_KEY?: string;
}, {
    OPENAI_API_KEY?: string;
    REDPILL_API_KEY?: string;
    GROK_API_KEY?: string;
    GROQ_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    GOOGLE_GENERATIVE_AI_API_KEY?: string;
    ELEVENLABS_XI_API_KEY?: string;
}>;
type EnvConfig = z.infer<typeof envSchema>;
declare function validateEnv(): EnvConfig;
declare const CharacterSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    system: z.ZodOptional<z.ZodString>;
    modelProvider: z.ZodNativeEnum<typeof ModelProviderName>;
    modelEndpointOverride: z.ZodOptional<z.ZodString>;
    templates: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    bio: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>;
    lore: z.ZodArray<z.ZodString, "many">;
    messageExamples: z.ZodArray<z.ZodArray<z.ZodObject<{
        user: z.ZodString;
        content: z.ZodIntersection<z.ZodObject<{
            text: z.ZodString;
            action: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
            inReplyTo: z.ZodOptional<z.ZodString>;
            attachments: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        }, "strip", z.ZodTypeAny, {
            text?: string;
            action?: string;
            source?: string;
            url?: string;
            inReplyTo?: string;
            attachments?: any[];
        }, {
            text?: string;
            action?: string;
            source?: string;
            url?: string;
            inReplyTo?: string;
            attachments?: any[];
        }>, z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        content?: {
            text?: string;
            action?: string;
            source?: string;
            url?: string;
            inReplyTo?: string;
            attachments?: any[];
        } & Record<string, unknown>;
        user?: string;
    }, {
        content?: {
            text?: string;
            action?: string;
            source?: string;
            url?: string;
            inReplyTo?: string;
            attachments?: any[];
        } & Record<string, unknown>;
        user?: string;
    }>, "many">, "many">;
    postExamples: z.ZodArray<z.ZodString, "many">;
    topics: z.ZodArray<z.ZodString, "many">;
    adjectives: z.ZodArray<z.ZodString, "many">;
    knowledge: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    clients: z.ZodArray<z.ZodNativeEnum<typeof Clients>, "many">;
    plugins: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        actions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        providers: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        evaluators: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        services: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        clients: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        actions?: any[];
        providers?: any[];
        description?: string;
        name?: string;
        evaluators?: any[];
        services?: any[];
        clients?: any[];
    }, {
        actions?: any[];
        providers?: any[];
        description?: string;
        name?: string;
        evaluators?: any[];
        services?: any[];
        clients?: any[];
    }>, "many">;
    settings: z.ZodOptional<z.ZodObject<{
        secrets: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        voice: z.ZodOptional<z.ZodObject<{
            model: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            url?: string;
            model?: string;
        }, {
            url?: string;
            model?: string;
        }>>;
        model: z.ZodOptional<z.ZodString>;
        embeddingModel: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        model?: string;
        secrets?: Record<string, string>;
        voice?: {
            url?: string;
            model?: string;
        };
        embeddingModel?: string;
    }, {
        model?: string;
        secrets?: Record<string, string>;
        voice?: {
            url?: string;
            model?: string;
        };
        embeddingModel?: string;
    }>>;
    clientConfig: z.ZodOptional<z.ZodObject<{
        discord: z.ZodOptional<z.ZodObject<{
            shouldIgnoreBotMessages: z.ZodOptional<z.ZodBoolean>;
            shouldIgnoreDirectMessages: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        }, {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        }>>;
        telegram: z.ZodOptional<z.ZodObject<{
            shouldIgnoreBotMessages: z.ZodOptional<z.ZodBoolean>;
            shouldIgnoreDirectMessages: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        }, {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        }>>;
    }, "strip", z.ZodTypeAny, {
        discord?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
        telegram?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
    }, {
        discord?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
        telegram?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
    }>>;
    style: z.ZodObject<{
        all: z.ZodArray<z.ZodString, "many">;
        chat: z.ZodArray<z.ZodString, "many">;
        post: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        all?: string[];
        chat?: string[];
        post?: string[];
    }, {
        all?: string[];
        chat?: string[];
        post?: string[];
    }>;
    twitterProfile: z.ZodOptional<z.ZodObject<{
        username: z.ZodString;
        screenName: z.ZodString;
        bio: z.ZodString;
        nicknames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        bio?: string;
        username?: string;
        screenName?: string;
        nicknames?: string[];
    }, {
        bio?: string;
        username?: string;
        screenName?: string;
        nicknames?: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    bio?: string | string[];
    lore?: string[];
    knowledge?: string[];
    system?: string;
    id?: string;
    name?: string;
    topics?: string[];
    clients?: Clients[];
    modelProvider?: ModelProviderName;
    modelEndpointOverride?: string;
    templates?: Record<string, string>;
    messageExamples?: {
        content?: {
            text?: string;
            action?: string;
            source?: string;
            url?: string;
            inReplyTo?: string;
            attachments?: any[];
        } & Record<string, unknown>;
        user?: string;
    }[][];
    postExamples?: string[];
    adjectives?: string[];
    plugins?: {
        actions?: any[];
        providers?: any[];
        description?: string;
        name?: string;
        evaluators?: any[];
        services?: any[];
        clients?: any[];
    }[];
    settings?: {
        model?: string;
        secrets?: Record<string, string>;
        voice?: {
            url?: string;
            model?: string;
        };
        embeddingModel?: string;
    };
    clientConfig?: {
        discord?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
        telegram?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
    };
    style?: {
        all?: string[];
        chat?: string[];
        post?: string[];
    };
    twitterProfile?: {
        bio?: string;
        username?: string;
        screenName?: string;
        nicknames?: string[];
    };
}, {
    bio?: string | string[];
    lore?: string[];
    knowledge?: string[];
    system?: string;
    id?: string;
    name?: string;
    topics?: string[];
    clients?: Clients[];
    modelProvider?: ModelProviderName;
    modelEndpointOverride?: string;
    templates?: Record<string, string>;
    messageExamples?: {
        content?: {
            text?: string;
            action?: string;
            source?: string;
            url?: string;
            inReplyTo?: string;
            attachments?: any[];
        } & Record<string, unknown>;
        user?: string;
    }[][];
    postExamples?: string[];
    adjectives?: string[];
    plugins?: {
        actions?: any[];
        providers?: any[];
        description?: string;
        name?: string;
        evaluators?: any[];
        services?: any[];
        clients?: any[];
    }[];
    settings?: {
        model?: string;
        secrets?: Record<string, string>;
        voice?: {
            url?: string;
            model?: string;
        };
        embeddingModel?: string;
    };
    clientConfig?: {
        discord?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
        telegram?: {
            shouldIgnoreBotMessages?: boolean;
            shouldIgnoreDirectMessages?: boolean;
        };
    };
    style?: {
        all?: string[];
        chat?: string[];
        post?: string[];
    };
    twitterProfile?: {
        bio?: string;
        username?: string;
        screenName?: string;
        nicknames?: string[];
    };
}>;
type CharacterConfig = z.infer<typeof CharacterSchema>;
declare function validateCharacterConfig(json: unknown): CharacterConfig;

interface ICacheAdapter {
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}
declare class MemoryCacheAdapter implements ICacheAdapter {
    data: Map<string, string>;
    constructor(initalData?: Map<string, string>);
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}
declare class FsCacheAdapter implements ICacheAdapter {
    private dataDir;
    constructor(dataDir: string);
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}
declare class DbCacheAdapter implements ICacheAdapter {
    private db;
    private agentId;
    constructor(db: IDatabaseCacheAdapter, agentId: UUID);
    get(key: string): Promise<string | undefined>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}
declare class CacheManager<CacheAdapter extends ICacheAdapter = ICacheAdapter> implements ICacheManager {
    adapter: CacheAdapter;
    constructor(adapter: CacheAdapter);
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, opts?: CacheOptions): Promise<void>;
    delete(key: string): Promise<void>;
}

declare function get(runtime: AgentRuntime, message: Memory): Promise<KnowledgeItem[]>;
declare function set(runtime: AgentRuntime, item: KnowledgeItem, chunkSize?: number, bleed?: number): Promise<void>;
declare function preprocess(content: string): string;
declare const _default: {
    get: typeof get;
    set: typeof set;
    preprocess: typeof preprocess;
};

export { type Account, type Action, type ActionExample, type Actor, AgentRuntime, CacheManager, type CacheOptions, type Character, type CharacterConfig, CharacterSchema, type Client, Clients, type Content, type ConversationExample, DatabaseAdapter, DbCacheAdapter, type EnvConfig, type EvaluationExample, type Evaluator, FsCacheAdapter, type GenerationOptions, type Goal, GoalStatus, type Handler, type HandlerCallback, type IAgentRuntime, type IBrowserService, type ICacheAdapter, type ICacheManager, type IDatabaseAdapter, type IDatabaseCacheAdapter, type IImageDescriptionService, type IMemoryManager, type IPdfService, type ISpeechService, type ITextGenerationService, type ITranscriptionService, type IVideoService, type KnowledgeItem, LoggingLevel, type Media, type Memory, MemoryCacheAdapter, MemoryManager, type MessageExample, type Model, ModelClass, ModelProviderName, type Models, type Objective, type Participant, type Plugin, type Provider, type Relationship, type Room, type SearchResponse, type SearchResult, Service, ServiceType, type State, type UUID, type Validator, addHeader, booleanFooter, composeActionExamples, composeContext, configureSettings, createGoal, createRelationship, defaultCharacter, elizaLogger, embed, envSchema, evaluationTemplate, findNearestEnvFile, formatActionNames, formatActions, formatActors, formatEvaluatorExampleDescriptions, formatEvaluatorExamples, formatEvaluatorNames, formatEvaluators, formatGoalsAsString, formatMessages, formatPosts, formatRelationships, formatTimestamp, generateCaption, generateImage, generateMessageResponse, generateObject, generateObjectArray, generateObjectV2, generateShouldRespond, generateText, generateTextArray, generateTrueOrFalse, generateWebSearch, getActorDetails, getEmbeddingConfig, getEmbeddingType, getEmbeddingZeroVector, getEndpoint, getEnvVariable, getGoals, getModel, getProviders, getRelationship, getRelationships, handleProvider, hasEnvVariable, _default as knowledge, loadEnvConfig, messageCompletionFooter, models, parseBooleanFromText, parseJSONObjectFromText, parseJsonArrayFromText, parseShouldRespondFromText, settings, shouldRespondFooter, splitChunks, stringArrayFooter, stringToUuid, trimTokens, updateGoal, validateCharacterConfig, validateEnv };
