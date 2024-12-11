import { Readable } from 'stream';
import { GenerateObjectResult } from 'ai';
import { ZodSchema } from 'zod';

/**
 * Represents a UUID, which is a universally unique identifier conforming to the UUID standard.
 */
type UUID = `${string}-${string}-${string}-${string}-${string}`;
/**
 * Represents the content of a message, including its main text (`content`), any associated action (`action`), and the source of the content (`source`), if applicable.
 */
interface Content {
    text: string;
    action?: string;
    source?: string;
    url?: string;
    inReplyTo?: UUID;
    attachments?: Media[];
    [key: string]: unknown;
}
/**
 * Represents an example of content, typically used for demonstrating or testing purposes. Includes user, content, optional action, and optional source.
 */
interface ActionExample {
    user: string;
    content: Content;
}
/**
 * Represents an example of content, typically used for demonstrating or testing purposes. Includes user, content, optional action, and optional source.
 */
interface ConversationExample {
    userId: UUID;
    content: Content;
}
/**
 * Represents an actor in the conversation, which could be a user or the agent itself, including their name, details (such as tagline, summary, and quote), and a unique identifier.
 */
interface Actor {
    name: string;
    username: string;
    details: {
        tagline: string;
        summary: string;
        quote: string;
    };
    id: UUID;
}
/**
 * Represents an objective within a goal, detailing what needs to be achieved and whether it has been completed.
 */
interface Objective {
    id?: string;
    description: string;
    completed: boolean;
}
declare enum GoalStatus {
    DONE = "DONE",
    FAILED = "FAILED",
    IN_PROGRESS = "IN_PROGRESS"
}
/**
 * Represents a goal, which is a higher-level aim composed of one or more objectives. Goals are tracked to measure progress or achievements within the conversation or system.
 */
interface Goal {
    id?: UUID;
    roomId: UUID;
    userId: UUID;
    name: string;
    status: GoalStatus;
    objectives: Objective[];
}
declare enum ModelClass {
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
    EMBEDDING = "embedding",
    IMAGE = "image"
}
type Model = {
    endpoint?: string;
    settings: {
        maxInputTokens: number;
        maxOutputTokens: number;
        frequency_penalty?: number;
        presence_penalty?: number;
        repetition_penalty?: number;
        stop: string[];
        temperature: number;
    };
    imageSettings?: {
        steps?: number;
    };
    model: {
        [ModelClass.SMALL]: string;
        [ModelClass.MEDIUM]: string;
        [ModelClass.LARGE]: string;
        [ModelClass.EMBEDDING]?: string;
        [ModelClass.IMAGE]?: string;
    };
};
type Models = {
    [ModelProviderName.OPENAI]: Model;
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
};
declare enum ModelProviderName {
    OPENAI = "openai",
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
    HEURIST = "heurist"
}
/**
 * Represents the state of the conversation or context in which the agent is operating, including information about users, messages, goals, and other relevant data.
 */
interface State {
    userId?: UUID;
    agentId?: UUID;
    bio: string;
    lore: string;
    messageDirections: string;
    postDirections: string;
    roomId: UUID;
    agentName?: string;
    senderName?: string;
    actors: string;
    actorsData?: Actor[];
    goals?: string;
    goalsData?: Goal[];
    recentMessages: string;
    recentMessagesData: Memory[];
    actionNames?: string;
    actions?: string;
    actionsData?: Action[];
    actionExamples?: string;
    providers?: string;
    responseData?: Content;
    recentInteractionsData?: Memory[];
    recentInteractions?: string;
    formattedConversation?: string;
    [key: string]: unknown;
}
/**
 * Represents a memory record, which could be a message or any other piece of information remembered by the system, including its content, associated user IDs, and optionally, its embedding vector for similarity comparisons.
 */
interface Memory {
    id?: UUID;
    userId: UUID;
    agentId: UUID;
    createdAt?: number;
    content: Content;
    embedding?: number[];
    roomId: UUID;
    unique?: boolean;
}
/**
 * Represents an example of a message, typically used for demonstrating or testing purposes, including optional content and action.
 */
interface MessageExample {
    user: string;
    content: Content;
}
/**
 * Represents the type of a handler function, which takes a runtime instance, a message, and an optional state, and returns a promise resolving to any type.
 */
type Handler = (runtime: IAgentRuntime, message: Memory, state?: State, options?: {
    [key: string]: unknown;
}, // additional options can be used for things like tests or state-passing on a chain
callback?: HandlerCallback) => Promise<unknown>;
type HandlerCallback = (response: Content, files?: any) => Promise<Memory[]>;
/**
 * Represents the type of a validator function, which takes a runtime instance, a message, and an optional state, and returns a promise resolving to a boolean indicating whether the validation passed.
 */
type Validator = (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
/**
 * Represents an action that the agent can perform, including conditions for its use, a description, examples, a handler function, and a validation function.
 */
interface Action {
    similes: string[];
    description: string;
    examples: ActionExample[][];
    handler: Handler;
    name: string;
    validate: Validator;
}
/**
 * Represents an example for evaluation, including the context, an array of message examples, and the expected outcome.
 */
interface EvaluationExample {
    context: string;
    messages: Array<ActionExample>;
    outcome: string;
}
/**
 * Represents an evaluator, which is used to assess and guide the agent's responses based on the current context and state.
 */
interface Evaluator {
    alwaysRun?: boolean;
    description: string;
    similes: string[];
    examples: EvaluationExample[];
    handler: Handler;
    name: string;
    validate: Validator;
}
/**
 * Represents a provider, which is used to retrieve information or perform actions on behalf of the agent, such as fetching data from an external API or service.
 */
interface Provider {
    get: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<any>;
}
/**
 * Represents a relationship between two users, including their IDs, the status of the relationship, and the room ID in which the relationship is established.
 */
interface Relationship {
    id: UUID;
    userA: UUID;
    userB: UUID;
    userId: UUID;
    roomId: UUID;
    status: string;
    createdAt?: string;
}
/**
 * Represents a user, including their name, details, and a unique identifier.
 */
interface Account {
    id: UUID;
    name: string;
    username: string;
    details?: {
        [key: string]: any;
    };
    email?: string;
    avatarUrl?: string;
}
/**
 * Represents a participant in a room, including their ID and account details.
 */
interface Participant {
    id: UUID;
    account: Account;
}
/**
 * Represents a room or conversation context, including its ID and a list of participants.
 */
interface Room {
    id: UUID;
    participants: Participant[];
}
type Media = {
    id: string;
    url: string;
    title: string;
    source: string;
    description: string;
    text: string;
};
type Client = {
    start: (runtime?: IAgentRuntime) => Promise<unknown>;
    stop: (runtime?: IAgentRuntime) => Promise<unknown>;
};
type Plugin = {
    name: string;
    description: string;
    actions?: Action[];
    providers?: Provider[];
    evaluators?: Evaluator[];
    services?: Service[];
    clients?: Client[];
};
declare enum Clients {
    DISCORD = "discord",
    DIRECT = "direct",
    TWITTER = "twitter",
    TELEGRAM = "telegram"
}
type Character = {
    id?: UUID;
    name: string;
    system?: string;
    modelProvider: ModelProviderName;
    modelEndpointOverride?: string;
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
        telegramMessageHandlerTemplate?: string;
        telegramShouldRespondTemplate?: string;
        discordVoiceHandlerTemplate?: string;
        discordShouldRespondTemplate?: string;
        discordMessageHandlerTemplate?: string;
    };
    bio: string | string[];
    lore: string[];
    messageExamples: MessageExample[][];
    postExamples: string[];
    people: string[];
    topics: string[];
    adjectives: string[];
    knowledge?: string[];
    clients: Clients[];
    plugins: Plugin[];
    settings?: {
        secrets?: {
            [key: string]: string;
        };
        voice?: {
            model?: string;
            url?: string;
        };
        model?: string;
        embeddingModel?: string;
        useSimpleTokenizer?: boolean;
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
    style: {
        all: string[];
        chat: string[];
        post: string[];
    };
    twitterProfile?: {
        username: string;
        screenName: string;
        bio: string;
        nicknames?: string[];
    };
};
interface IDatabaseAdapter {
    db: any;
    init?(): Promise<void>;
    getAccountById(userId: UUID): Promise<Account | null>;
    createAccount(account: Account): Promise<boolean>;
    getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
        agentId?: UUID;
        start?: number;
        end?: number;
    }): Promise<Memory[]>;
    getMemoryById(id: UUID): Promise<Memory | null>;
    getMemoriesByRoomIds(params: {
        agentId?: UUID;
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
        agentId?: UUID;
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
        agentId?: UUID;
    }): Promise<Memory[]>;
    searchMemoriesByEmbedding(embedding: number[], opts: {
        match_threshold?: number;
        count?: number;
        roomId: UUID;
        unique?: boolean;
        agentId?: UUID;
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
    character: Character;
    providers: Provider[];
    actions: Action[];
    evaluators: Evaluator[];
    messageManager: IMemoryManager;
    descriptionManager: IMemoryManager;
    loreManager: IMemoryManager;
    cacheManager: ICacheManager;
    services: Map<ServiceType, Service>;
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
    getInstance(): IImageDescriptionService;
    describeImage(imageUrl: string): Promise<{
        title: string;
        description: string;
    }>;
}
interface ITranscriptionService extends Service {
    getInstance(): ITranscriptionService;
    transcribeAttachment(audioBuffer: ArrayBuffer): Promise<string | null>;
    transcribeAttachmentLocally(audioBuffer: ArrayBuffer): Promise<string | null>;
    transcribe(audioBuffer: ArrayBuffer): Promise<string | null>;
    transcribeLocally(audioBuffer: ArrayBuffer): Promise<string | null>;
}
interface IVideoService extends Service {
    getInstance(): IVideoService;
    isVideoUrl(url: string): boolean;
    processVideo(url: string): Promise<Media>;
    fetchVideoInfo(url: string): Promise<Media>;
    downloadVideo(videoInfo: Media): Promise<string>;
}
interface ITextGenerationService extends Service {
    getInstance(): ITextGenerationService;
    initializeModel(): Promise<void>;
    queueMessageCompletion(context: string, temperature: number, stop: string[], frequency_penalty: number, presence_penalty: number, max_tokens: number): Promise<any>;
    queueTextCompletion(context: string, temperature: number, stop: string[], frequency_penalty: number, presence_penalty: number, max_tokens: number): Promise<string>;
    getEmbeddingResponse(input: string): Promise<number[] | undefined>;
}
interface IBrowserService extends Service {
    getInstance(): IBrowserService;
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
declare enum ServiceType {
    IMAGE_DESCRIPTION = "image_description",
    TRANSCRIPTION = "transcription",
    VIDEO = "video",
    TEXT_GENERATION = "text_generation",
    BROWSER = "browser",
    SPEECH_GENERATION = "speech_generation",
    PDF = "pdf"
}
declare enum LoggingLevel {
    DEBUG = "debug",
    VERBOSE = "verbose",
    NONE = "none"
}

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
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
    }): Promise<Memory[]>;
    abstract getMemoriesByRoomIds(params: {
        agentId?: UUID;
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

/**
 * Send a message to the OpenAI API for embedding.
 * @param input The input to be embedded.
 * @returns The embedding of the input.
 */
declare function embed(runtime: IAgentRuntime, input: string): Promise<number[]>;
declare function retrieveCachedEmbedding(runtime: IAgentRuntime, input: string): Promise<number[]>;

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
declare function generateText({ runtime, context, modelClass, stop, cloudflare, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
    stop?: string[];
    cloudflare?: {
        accountId: string;
        gatewayId: string;
    };
}): Promise<string>;
/**
 * Truncate the context to the maximum length allowed by the model.
 * @param model The model to use for generateText.
 * @param context The context of the message to be completed.
 * @param max_context_length The maximum length of the context to apply to the generateText.
 * @returns
 */
declare function trimTokens(context: string, maxTokens: number, model: string): string;
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
 * @param model - The model name to use for tokenization (default: runtime.model)
 * @returns Promise resolving to array of text chunks with bleed sections
 */
declare function splitChunks(content: string, chunkSize: number, bleed?: number): Promise<string[]>;
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
declare function generateMessageResponse({ runtime, context, modelClass, cloudflare, }: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: string;
    cloudflare?: {
        accountId: string;
        gatewayId: string;
    };
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

declare const embeddingDimension = 1536;
declare const embeddingZeroVector: any[];
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
    addEmbeddingToMemory(memory: Memory): Promise<Memory>;
    /**
     * Retrieves a list of memories by user IDs, with optional deduplication.
     * @param opts Options including user IDs, count, and uniqueness.
     * @param opts.roomId The room ID to retrieve memories for.
     * @param opts.count The number of memories to retrieve.
     * @param opts.unique Whether to retrieve unique memories only.
     * @returns A Promise resolving to an array of Memory objects.
     */
    getMemories({ roomId, count, unique, agentId, start, end, }: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        agentId?: UUID;
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
        agentId?: UUID;
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
        agentId?: UUID;
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
    /**
     * The model to use for generateText.
     */
    modelProvider: ModelProviderName;
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
    success(...strings: any[]): void;
    debug(...strings: any[]): void;
    assert(...strings: any[]): void;
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

export { type Account, type Action, type ActionExample, type Actor, AgentRuntime, CacheManager, type CacheOptions, type Character, type Client, Clients, type Content, type ConversationExample, DatabaseAdapter, DbCacheAdapter, type EvaluationExample, type Evaluator, FsCacheAdapter, type GenerationOptions, type Goal, GoalStatus, type Handler, type HandlerCallback, type IAgentRuntime, type IBrowserService, type ICacheAdapter, type ICacheManager, type IDatabaseAdapter, type IDatabaseCacheAdapter, type IImageDescriptionService, type IMemoryManager, type IPdfService, type ISpeechService, type ITextGenerationService, type ITranscriptionService, type IVideoService, LoggingLevel, type Media, type Memory, MemoryCacheAdapter, MemoryManager, type MessageExample, type Model, ModelClass, ModelProviderName, type Models, type Objective, type Participant, type Plugin, type Provider, type Relationship, type Room, Service, ServiceType, type State, type UUID, type Validator, addHeader, booleanFooter, composeActionExamples, composeContext, configureSettings, createGoal, createRelationship, defaultCharacter, elizaLogger, embed, embeddingDimension, embeddingZeroVector, evaluationTemplate, findNearestEnvFile, formatActionNames, formatActions, formatActors, formatEvaluatorExampleDescriptions, formatEvaluatorExamples, formatEvaluatorNames, formatEvaluators, formatGoalsAsString, formatMessages, formatPosts, formatRelationships, formatTimestamp, generateCaption, generateImage, generateMessageResponse, generateObject, generateObjectArray, generateObjectV2, generateShouldRespond, generateText, generateTextArray, generateTrueOrFalse, getActorDetails, getEndpoint, getEnvVariable, getGoals, getModel, getProviders, getRelationship, getRelationships, handleProvider, hasEnvVariable, loadEnvConfig, messageCompletionFooter, models, parseBooleanFromText, parseJSONObjectFromText, parseJsonArrayFromText, parseShouldRespondFromText, retrieveCachedEmbedding, settings, shouldRespondFooter, splitChunks, stringArrayFooter, stringToUuid, trimTokens, updateGoal };
