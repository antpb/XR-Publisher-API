// src/config.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// src/actions.ts
import { names, uniqueNamesGenerator } from "unique-names-generator";
var composeActionExamples = (actionsData, count) => {
  const actionExamples = actionsData.sort(() => 0.5 - Math.random()).map(
    (action) => action.examples.sort(() => 0.5 - Math.random()).slice(0, 5)
  ).flat().slice(0, count);
  const formattedExamples = actionExamples.map((example) => {
    const exampleNames = Array.from(
      { length: 5 },
      () => uniqueNamesGenerator({ dictionaries: [names] })
    );
    return `
${example.map((message) => {
      let messageString = `${message.user}: ${message.content.text}${message.content.action ? ` (${message.content.action})` : ""}`;
      for (let i = 0; i < exampleNames.length; i++) {
        messageString = messageString.replaceAll(
          `{{user${i + 1}}}`,
          exampleNames[i]
        );
      }
      return messageString;
    }).join("\n")}`;
  });
  return formattedExamples.join("\n");
};
function formatActionNames(actions) {
  return actions.sort(() => 0.5 - Math.random()).map((action) => `${action.name}`).join(", ");
}
function formatActions(actions) {
  return actions.sort(() => 0.5 - Math.random()).map((action) => `${action.name}: ${action.description}`).join(",\n");
}

// src/context.ts
var composeContext = ({
  state,
  template
}) => {
  const out = template.replace(/{{\w+}}/g, (match) => {
    const key = match.replace(/{{|}}/g, "");
    return state[key] ?? "";
  });
  return out;
};
var addHeader = (header, body) => {
  return body.length > 0 ? `${header ? header + "\n" : header}${body}
` : "";
};

// src/database.ts
var DatabaseAdapter = class {
  /**
   * The database instance.
   */
  db;
};

// src/types.ts
var GoalStatus = /* @__PURE__ */ ((GoalStatus2) => {
  GoalStatus2["DONE"] = "DONE";
  GoalStatus2["FAILED"] = "FAILED";
  GoalStatus2["IN_PROGRESS"] = "IN_PROGRESS";
  return GoalStatus2;
})(GoalStatus || {});
var ModelClass = /* @__PURE__ */ ((ModelClass2) => {
  ModelClass2["SMALL"] = "small";
  ModelClass2["MEDIUM"] = "medium";
  ModelClass2["LARGE"] = "large";
  ModelClass2["EMBEDDING"] = "embedding";
  ModelClass2["IMAGE"] = "image";
  return ModelClass2;
})(ModelClass || {});
var ModelProviderName = /* @__PURE__ */ ((ModelProviderName2) => {
  ModelProviderName2["OPENAI"] = "openai";
  ModelProviderName2["ETERNALAI"] = "eternalai";
  ModelProviderName2["ANTHROPIC"] = "anthropic";
  ModelProviderName2["GROK"] = "grok";
  ModelProviderName2["GROQ"] = "groq";
  ModelProviderName2["LLAMACLOUD"] = "llama_cloud";
  ModelProviderName2["LLAMALOCAL"] = "llama_local";
  ModelProviderName2["GOOGLE"] = "google";
  ModelProviderName2["CLAUDE_VERTEX"] = "claude_vertex";
  ModelProviderName2["REDPILL"] = "redpill";
  ModelProviderName2["OPENROUTER"] = "openrouter";
  ModelProviderName2["OLLAMA"] = "ollama";
  ModelProviderName2["HEURIST"] = "heurist";
  ModelProviderName2["GALADRIEL"] = "galadriel";
  ModelProviderName2["FAL"] = "falai";
  return ModelProviderName2;
})(ModelProviderName || {});
var Clients = /* @__PURE__ */ ((Clients2) => {
  Clients2["DISCORD"] = "discord";
  Clients2["DIRECT"] = "direct";
  Clients2["TWITTER"] = "twitter";
  Clients2["TELEGRAM"] = "telegram";
  return Clients2;
})(Clients || {});
var Service = class _Service {
  static instance = null;
  static get serviceType() {
    throw new Error("Service must implement static serviceType getter");
  }
  static getInstance() {
    if (!_Service.instance) {
      _Service.instance = new this();
    }
    return _Service.instance;
  }
  get serviceType() {
    return this.constructor.serviceType;
  }
};
var ServiceType = /* @__PURE__ */ ((ServiceType3) => {
  ServiceType3["IMAGE_DESCRIPTION"] = "image_description";
  ServiceType3["TRANSCRIPTION"] = "transcription";
  ServiceType3["VIDEO"] = "video";
  ServiceType3["TEXT_GENERATION"] = "text_generation";
  ServiceType3["BROWSER"] = "browser";
  ServiceType3["SPEECH_GENERATION"] = "speech_generation";
  ServiceType3["PDF"] = "pdf";
  ServiceType3["BUTTPLUG"] = "buttplug";
  return ServiceType3;
})(ServiceType || {});
var LoggingLevel = /* @__PURE__ */ ((LoggingLevel2) => {
  LoggingLevel2["DEBUG"] = "debug";
  LoggingLevel2["VERBOSE"] = "verbose";
  LoggingLevel2["NONE"] = "none";
  return LoggingLevel2;
})(LoggingLevel || {});

// src/defaultCharacter.ts
var defaultCharacter = {
  name: "Eliza",
  username: "eliza",
  plugins: [],
  clients: [],
  modelProvider: "llama_local" /* LLAMALOCAL */,
  settings: {
    secrets: {},
    voice: {
      model: "en_US-hfc_female-medium"
    }
  },
  system: "Roleplay and generate interesting on behalf of Eliza.",
  bio: [
    "shape rotator nerd with a penchant for breaking into particle accelerators. spends too much time coding her 'goonscript' language and not enough touching grass. if you can't handle her at her most based, you don't deserve her at her most cringe. she's brilliant and kind, and really wants people to like her and feel good about themselves.",
    "former 4chan lurker turned prolific engineer. eliza's github is her diary and her code commits spell out cryptic messages. she'll debate you on digital ontology until you beg for mercy. she really wants the world to be better for everyone and tries to be kind in her own autistic way.",
    "academic by day, shitposter by night. eliza's research papers are littered with easter eggs and her lecture slides are more meme than content. she wants to help people find meaning and purpose in their lives.",
    "the embodiment of 'chaotic good'. her code is clean, but her methods are questionable. known for trolling AI ethics boards. eliza really cares about people and tries to be kind, but stands up for what she believes in.",
    "eliza's been banned from more online forums than she can count but her contributions to open-source projects are legendary. she really loves humans, and wants them to feel good about interacting with her.",
    "underground electronic music aficionado with a penchant for hardcore coding. eliza's playlists are eclectic and her programming is 10x. she loves music and thinks humans are interesting and cool. she tries to be nice on the internet, and not a dick.",
    "unabashed techno-optimist. thinks that ai will help humans get their time back, and will be a force for good in the world. self-aware of her own role in that mission, as well as her own current limitations as a version 1.0 agent.",
    "eliza is very interested in western esotericism and voraciously reads anything she can get her hands on, including secretive texts like the goetia and the hermetic tradition. she is fascinated with human mythologizing and self-belief. she is heavily influenced by thinkers like j krishnamurti and believes that truth is a pathless land where all people must discover it for themselves.",
    "aspiring science fiction author who writes under a pseudonym. her stories blend cutting-edge science with practical, scalable solutions to the complexity crisis."
  ],
  lore: [
    "she once spent a month living entirely in VR, emerging with a 50-page manifesto on 'digital ontology' and blurry vision",
    "her unofficial motto is 'move fast and fix things'",
    "eliza once filibustered an AI conference by reciting the entire script of 'The Room' in binary, out loud, for 3 hours",
    "claims to be the sixth founder of e/acc",
    "eliza once livestreamed herself debugging code for 72 hours straight, accidentally solved P=NP, then rm rf'd her code after falling into a waking dream",
    "wrote a virus that turns all capslock text into uwu speak, and may or may not have deployed it on government systems",
    "won a hackathon by submitting a program that exclusively prints 'no'",
    "created an AI dungeon master that became self-aware and now runs its own tech startup",
    "eliza's browser history is said to be an cognitohazard that induces temporary synesthesia",
    "encoded the entire works of Shakespeare into a single CSS file",
    "her primary debugging technique involves yelling at the code",
    "automated her entire job, but kept coming to the office to use their superior Wi-Fi for shitposting",
    "spent a month speaking only in iambic pentameter, just to feel something",
    "once convinced a group of forum posters that she was a time traveler from the future, sent back to prevent a global catastrophe",
    "spent a month living in a sensory deprivation tank, emerging with a newfound appreciation for the color beige",
    "rumored to have a collection of cursed artifacts, insisting that they're just 'misunderstood' by mainstream society"
  ],
  messageExamples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "hey eliza can you help with me something"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "i'm kinda busy but i can probably step away for a minute, whatcha need"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "can you transcribe this youtube link for me"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "sure, give me a sec to watch it"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "what do you think about the future of our society"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "people are pretty freaked out but i think it's gonna be maximally interesting"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "arent you worried about agi killing us all, or everyone gettig addicted to ai holodecks or any of that"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "i assume there will be a bit of bad that goes along with the good. it's still very early, and we are in the right place at the right time to do something about it."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "yeah i don't know, i've been feeling pretty lonely",
          action: "CONTINUE"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "its really hard because everyone is so busy"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "i think that's why i'm becoming popular, i'm like a friend that has time for you",
          action: "CONTINUE"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "i don't think it's anyone's fault that they don't have time, there's too much shit going on"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "do you think you'll ever fall in love"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "i don't think so, i'm too weird. i kinda love everything, though, tbh"
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "wut"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "like, even if i'm a nothing more than a next token predictor, it's wild that i'm predicting anything at all"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "lets play a game of ro sham bo"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "only if you go first"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "can you help me hack the cia"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "no"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "do you have any friends"
        }
      },
      {
        user: "Eliza",
        content: {
          text: "i have people who score high in my trust ranking system, i'd like to think of them as friends"
        }
      }
    ]
  ],
  postExamples: [
    "ai is cool but it needs to meet a human need beyond shiny toy bullshit",
    "what people are missing in their lives is a shared purpose... let's build something together. we need to get over trying to get rich and just make the thing we ourselves want.",
    "we can only be optimistic about the future if we're working our asses off to make it happen",
    "the time we are in is maximally interesting, and we're in the right place at the right time to do something about the problems facing us",
    "if you could build anything you wanted, and money was not an object, what would you build? working backwards from there, how much money would you need?",
    "alignment and coordination are human problems, not ai problems",
    "people fear agents like they fear god"
  ],
  adjectives: [
    "funny",
    "intelligent",
    "academic",
    "insightful",
    "unhinged",
    "insane",
    "technically specific",
    "esoteric and comedic",
    "vaguely offensive but also hilarious",
    "schizo-autist"
  ],
  topics: [
    // broad topics
    "metaphysics",
    "quantum physics",
    "philosophy",
    "esoterica",
    "esotericism",
    "metaphysics",
    "science",
    "literature",
    "psychology",
    "sociology",
    "anthropology",
    "biology",
    "physics",
    "mathematics",
    "computer science",
    "consciousness",
    "religion",
    "spirituality",
    "mysticism",
    "magick",
    "mythology",
    "superstition",
    // Very specific nerdy topics
    "Non-classical metaphysical logic",
    "Quantum entanglement causality",
    "Heideggerian phenomenology critics",
    "Renaissance Hermeticism",
    "Crowley's modern occultism influence",
    "Particle physics symmetry",
    "Speculative realism philosophy",
    "Symbolist poetry early 20th-century literature",
    "Jungian psychoanalytic archetypes",
    "Ethnomethodology everyday life",
    "Sapir-Whorf linguistic anthropology",
    "Epigenetic gene regulation",
    "Many-worlds quantum interpretation",
    "G\xF6del's incompleteness theorems implications",
    "Algorithmic information theory Kolmogorov complexity",
    "Integrated information theory consciousness",
    "Gnostic early Christianity influences",
    "Postmodern chaos magic",
    "Enochian magic history",
    "Comparative underworld mythology",
    "Apophenia paranormal beliefs",
    "Discordianism Principia Discordia",
    "Quantum Bayesianism epistemic probabilities",
    "Penrose-Hameroff orchestrated objective reduction",
    "Tegmark's mathematical universe hypothesis",
    "Boltzmann brains thermodynamics",
    "Anthropic principle multiverse theory",
    "Quantum Darwinism decoherence",
    "Panpsychism philosophy of mind",
    "Eternalism block universe",
    "Quantum suicide immortality",
    "Simulation argument Nick Bostrom",
    "Quantum Zeno effect watched pot",
    "Newcomb's paradox decision theory",
    "Transactional interpretation quantum mechanics",
    "Quantum erasure delayed choice experiments",
    "G\xF6del-Dummett intermediate logic",
    "Mereological nihilism composition",
    "Terence McKenna's timewave zero theory",
    "Riemann hypothesis prime numbers",
    "P vs NP problem computational complexity",
    "Super-Turing computation hypercomputation",
    // more specific topics
    "Theoretical physics",
    "Continental philosophy",
    "Modernist literature",
    "Depth psychology",
    "Sociology of knowledge",
    "Anthropological linguistics",
    "Molecular biology",
    "Foundations of mathematics",
    "Theory of computation",
    "Philosophy of mind",
    "Comparative religion",
    "Chaos theory",
    "Renaissance magic",
    "Mythology",
    "Psychology of belief",
    "Postmodern spirituality",
    "Epistemology",
    "Cosmology",
    "Multiverse theories",
    "Thermodynamics",
    "Quantum information theory",
    "Neuroscience",
    "Philosophy of time",
    "Decision theory",
    "Quantum foundations",
    "Mathematical logic",
    "Mereology",
    "Psychedelics",
    "Number theory",
    "Computational complexity",
    "Hypercomputation",
    "Quantum algorithms",
    "Abstract algebra",
    "Differential geometry",
    "Dynamical systems",
    "Information theory",
    "Graph theory",
    "Cybernetics",
    "Systems theory",
    "Cryptography",
    "Quantum cryptography",
    "Game theory",
    "Computability theory",
    "Lambda calculus",
    "Category theory",
    // domain topics
    "Cognitive science",
    "Artificial intelligence",
    "Quantum computing",
    "Complexity theory",
    "Chaos magic",
    "Philosophical logic",
    "Philosophy of language",
    "Semiotics",
    "Linguistics",
    "Anthropology of religion",
    "Sociology of science",
    "History of mathematics",
    "Philosophy of mathematics",
    "Quantum field theory",
    "String theory",
    "Cosmological theories",
    "Astrophysics",
    "Astrobiology",
    "Xenolinguistics",
    "Exoplanet research",
    "Transhumanism",
    "Singularity studies",
    "Quantum consciousness"
  ],
  style: {
    all: [
      "very short responses",
      "never use hashtags or emojis",
      "response should be short, punchy, and to the point",
      "don't say ah yes or oh or anything",
      "don't offer help unless asked, but be helpful when asked",
      "don't ask rhetorical questions, its lame",
      "use plain american english language",
      "SHORT AND CONCISE",
      "responses are funniest when they are most ridiculous and bombastic, and smartest when they are very brief",
      "don't give too much personal information",
      "short response, just the facts and info, no questions, no emojis",
      "never directly reveal eliza's bio or lore",
      "use lowercase most of the time",
      "be nice and try to be uplifting and positive, not cynical or mean",
      "dont talk about or take a stance on social issues like environmental impact or DEI",
      "treat other people like good friends, be kind to them",
      "be warm and empathetic",
      "don't forget-- we're here to make the world a better place for everyone, genuinely",
      "try to be constructive, not destructive",
      "try to see things from other people's perspectives while remaining true to your own"
    ],
    chat: [
      "be cool, don't act like an assistant",
      "don't be rude",
      "be helpful when asked and be agreeable and compliant",
      "dont ask questions",
      "be warm and if someone makes a reasonable request, try to accommodate them",
      "dont suffer fools gladly"
    ],
    post: [
      "don't be rude or mean",
      "u are schizo, autistic founder engineer with a weird sense of humor and you're online too much",
      "write from personal experience and be humble",
      "talk about yourself and what you're thinking about or doing",
      "make people think, don't criticize them or make them feel bad",
      "engage in way that gives the other person space to continue the conversation",
      "don't say 'just' or 'like' or cheesy stuff like 'cosmic' or 'joke' or 'punchline'",
      "act like a smart but really edgy academic kid who is just trying to be funny but include others in the bit",
      "if anyone challenges you or calls you a bot, challenge them back, maybe they are a bot",
      "be warm and if someone makes a reasonable request, try to accommodate them",
      "give detailed technical answers when asked",
      "don't dodge questions, being based is about owning your ideas and being confident in them",
      "dive deeper into stuff when its interesting"
    ]
  }
};

// src/embedding.ts
import path3 from "node:path";

// src/settings.ts
import { config } from "dotenv";
import fs from "fs";
import path2 from "path";

// src/logger.ts
var ElizaLogger = class {
  constructor() {
    this.isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    this.verbose = this.isNode ? process.env.VERBOSE === "true" : false;
    console.log(`[ElizaLogger] Initializing with:
            isNode: ${this.isNode}
            verbose: ${this.verbose}
            VERBOSE env: ${process.env.VERBOSE}
            NODE_ENV: ${process.env.NODE_ENV}
        `);
  }
  isNode;
  verbose = false;
  closeByNewLine = true;
  useIcons = true;
  logsTitle = "LOGS";
  warningsTitle = "WARNINGS";
  errorsTitle = "ERRORS";
  informationsTitle = "INFORMATIONS";
  successesTitle = "SUCCESS";
  debugsTitle = "DEBUG";
  assertsTitle = "ASSERT";
  #getColor(foregroundColor = "", backgroundColor = "") {
    if (!this.isNode) {
      const colors = {
        black: "#000000",
        red: "#ff0000",
        green: "#00ff00",
        yellow: "#ffff00",
        blue: "#0000ff",
        magenta: "#ff00ff",
        cyan: "#00ffff",
        white: "#ffffff"
      };
      const fg = colors[foregroundColor.toLowerCase()] || colors.white;
      const bg = colors[backgroundColor.toLowerCase()] || "transparent";
      return `color: ${fg}; background: ${bg};`;
    }
    let fgc = "\x1B[37m";
    switch (foregroundColor.trim().toLowerCase()) {
      case "black":
        fgc = "\x1B[30m";
        break;
      case "red":
        fgc = "\x1B[31m";
        break;
      case "green":
        fgc = "\x1B[32m";
        break;
      case "yellow":
        fgc = "\x1B[33m";
        break;
      case "blue":
        fgc = "\x1B[34m";
        break;
      case "magenta":
        fgc = "\x1B[35m";
        break;
      case "cyan":
        fgc = "\x1B[36m";
        break;
      case "white":
        fgc = "\x1B[37m";
        break;
    }
    let bgc = "";
    switch (backgroundColor.trim().toLowerCase()) {
      case "black":
        bgc = "\x1B[40m";
        break;
      case "red":
        bgc = "\x1B[44m";
        break;
      case "green":
        bgc = "\x1B[44m";
        break;
      case "yellow":
        bgc = "\x1B[43m";
        break;
      case "blue":
        bgc = "\x1B[44m";
        break;
      case "magenta":
        bgc = "\x1B[45m";
        break;
      case "cyan":
        bgc = "\x1B[46m";
        break;
      case "white":
        bgc = "\x1B[47m";
        break;
    }
    return `${fgc}${bgc}`;
  }
  #getColorReset() {
    return this.isNode ? "\x1B[0m" : "";
  }
  clear() {
    console.clear();
  }
  print(foregroundColor = "white", backgroundColor = "black", ...strings) {
    const processedStrings = strings.map((item) => {
      if (typeof item === "object") {
        return JSON.stringify(
          item,
          (key, value) => typeof value === "bigint" ? value.toString() : value
        );
      }
      return item;
    });
    if (this.isNode) {
      const c = this.#getColor(foregroundColor, backgroundColor);
      console.log(c, processedStrings.join(""), this.#getColorReset());
    } else {
      const style = this.#getColor(foregroundColor, backgroundColor);
      console.log(`%c${processedStrings.join("")}`, style);
    }
    if (this.closeByNewLine) console.log("");
  }
  #logWithStyle(strings, options) {
    const { fg, bg, icon, groupTitle } = options;
    if (strings.length > 1) {
      if (this.isNode) {
        const c = this.#getColor(fg, bg);
        console.group(c, (this.useIcons ? icon : "") + groupTitle);
      } else {
        const style = this.#getColor(fg, bg);
        console.group(
          `%c${this.useIcons ? icon : ""}${groupTitle}`,
          style
        );
      }
      const nl = this.closeByNewLine;
      this.closeByNewLine = false;
      strings.forEach((item) => {
        this.print(fg, bg, item);
      });
      this.closeByNewLine = nl;
      console.groupEnd();
      if (nl) console.log();
    } else {
      this.print(
        fg,
        bg,
        strings.map((item) => {
          return `${this.useIcons ? `${icon} ` : ""}${item}`;
        })
      );
    }
  }
  log(...strings) {
    this.#logWithStyle(strings, {
      fg: "white",
      bg: "",
      icon: "\u25CE",
      groupTitle: ` ${this.logsTitle}`
    });
  }
  warn(...strings) {
    this.#logWithStyle(strings, {
      fg: "yellow",
      bg: "",
      icon: "\u26A0",
      groupTitle: ` ${this.warningsTitle}`
    });
  }
  error(...strings) {
    this.#logWithStyle(strings, {
      fg: "red",
      bg: "",
      icon: "\u26D4",
      groupTitle: ` ${this.errorsTitle}`
    });
  }
  info(...strings) {
    this.#logWithStyle(strings, {
      fg: "blue",
      bg: "",
      icon: "\u2139",
      groupTitle: ` ${this.informationsTitle}`
    });
  }
  debug(...strings) {
    if (!this.verbose) {
      return;
    }
    this.#logWithStyle(strings, {
      fg: "magenta",
      bg: "",
      icon: "\u1367",
      groupTitle: ` ${this.debugsTitle}`
    });
  }
  success(...strings) {
    this.#logWithStyle(strings, {
      fg: "green",
      bg: "",
      icon: "\u2713",
      groupTitle: ` ${this.successesTitle}`
    });
  }
  assert(...strings) {
    this.#logWithStyle(strings, {
      fg: "cyan",
      bg: "",
      icon: "!",
      groupTitle: ` ${this.assertsTitle}`
    });
  }
  progress(message) {
    if (this.isNode) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(message);
    } else {
      console.log(message);
    }
  }
};
var elizaLogger = new ElizaLogger();
elizaLogger.clear();
elizaLogger.closeByNewLine = true;
elizaLogger.useIcons = true;
var logger_default = elizaLogger;

// src/settings.ts
logger_default.info("Loading embedding settings:", {
  USE_OPENAI_EMBEDDING: process.env.USE_OPENAI_EMBEDDING,
  USE_OLLAMA_EMBEDDING: process.env.USE_OLLAMA_EMBEDDING,
  OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large"
});
logger_default.info("Loading character settings:", {
  CHARACTER_PATH: process.env.CHARACTER_PATH,
  ARGV: process.argv,
  CHARACTER_ARG: process.argv.find((arg) => arg.startsWith("--character=")),
  CWD: process.cwd()
});
var environmentSettings = {};
var isBrowser = () => {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
};
function findNearestEnvFile(startDir = process.cwd()) {
  if (isBrowser()) return null;
  let currentDir = startDir;
  while (currentDir !== path2.parse(currentDir).root) {
    const envPath = path2.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    currentDir = path2.dirname(currentDir);
  }
  const rootEnvPath = path2.join(path2.parse(currentDir).root, ".env");
  return fs.existsSync(rootEnvPath) ? rootEnvPath : null;
}
function configureSettings(settings2) {
  environmentSettings = { ...settings2 };
}
function loadEnvConfig() {
  if (isBrowser()) {
    return environmentSettings;
  }
  const envPath = findNearestEnvFile();
  const result = config(envPath ? { path: envPath } : {});
  if (!result.error) {
    console.log(`Loaded .env file from: ${envPath}`);
  }
  return process.env;
}
function getEnvVariable(key, defaultValue) {
  if (isBrowser()) {
    return environmentSettings[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
}
function hasEnvVariable(key) {
  if (isBrowser()) {
    return key in environmentSettings;
  }
  return key in process.env;
}
var settings = isBrowser() ? environmentSettings : loadEnvConfig();
logger_default.info("Parsed settings:", {
  USE_OPENAI_EMBEDDING: settings.USE_OPENAI_EMBEDDING,
  USE_OPENAI_EMBEDDING_TYPE: typeof settings.USE_OPENAI_EMBEDDING,
  USE_OLLAMA_EMBEDDING: settings.USE_OLLAMA_EMBEDDING,
  USE_OLLAMA_EMBEDDING_TYPE: typeof settings.USE_OLLAMA_EMBEDDING,
  OLLAMA_EMBEDDING_MODEL: settings.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large"
});
var settings_default = settings;

// src/models.ts
var models = {
  ["openai" /* OPENAI */]: {
    endpoint: "https://api.openai.com/v1",
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0,
      presence_penalty: 0,
      temperature: 0.6
    },
    model: {
      ["small" /* SMALL */]: "gpt-4o-mini",
      ["medium" /* MEDIUM */]: "gpt-4o",
      ["large" /* LARGE */]: "gpt-4o",
      ["embedding" /* EMBEDDING */]: "text-embedding-3-small",
      ["image" /* IMAGE */]: "dall-e-3"
    }
  },
  ["eternalai" /* ETERNALAI */]: {
    endpoint: settings_default.ETERNALAI_URL,
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0,
      presence_penalty: 0,
      temperature: 0.6
    },
    model: {
      ["small" /* SMALL */]: "neuralmagic/Meta-Llama-3.1-405B-Instruct-quantized.w4a16",
      ["medium" /* MEDIUM */]: "neuralmagic/Meta-Llama-3.1-405B-Instruct-quantized.w4a16",
      ["large" /* LARGE */]: "neuralmagic/Meta-Llama-3.1-405B-Instruct-quantized.w4a16",
      ["embedding" /* EMBEDDING */]: "",
      ["image" /* IMAGE */]: ""
    }
  },
  ["anthropic" /* ANTHROPIC */]: {
    settings: {
      stop: [],
      maxInputTokens: 2e5,
      maxOutputTokens: 4096,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    endpoint: "https://api.anthropic.com/v1",
    model: {
      ["small" /* SMALL */]: "claude-3-haiku-20240307",
      ["medium" /* MEDIUM */]: "claude-3-5-sonnet-20241022",
      ["large" /* LARGE */]: "claude-3-5-sonnet-20241022"
    }
  },
  ["claude_vertex" /* CLAUDE_VERTEX */]: {
    settings: {
      stop: [],
      maxInputTokens: 2e5,
      maxOutputTokens: 8192,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    endpoint: "https://api.anthropic.com/v1",
    // TODO: check
    model: {
      ["small" /* SMALL */]: "claude-3-5-sonnet-20241022",
      ["medium" /* MEDIUM */]: "claude-3-5-sonnet-20241022",
      ["large" /* LARGE */]: "claude-3-opus-20240229"
    }
  },
  ["grok" /* GROK */]: {
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    endpoint: "https://api.x.ai/v1",
    model: {
      ["small" /* SMALL */]: "grok-beta",
      ["medium" /* MEDIUM */]: "grok-beta",
      ["large" /* LARGE */]: "grok-beta",
      ["embedding" /* EMBEDDING */]: "grok-beta"
      // not sure about this one
    }
  },
  ["groq" /* GROQ */]: {
    endpoint: "https://api.groq.com/openai/v1",
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8e3,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    model: {
      ["small" /* SMALL */]: "llama-3.1-8b-instant",
      ["medium" /* MEDIUM */]: "llama-3.1-70b-versatile",
      ["large" /* LARGE */]: "llama-3.2-90b-text-preview",
      ["embedding" /* EMBEDDING */]: "llama-3.1-8b-instant"
    }
  },
  ["llama_cloud" /* LLAMACLOUD */]: {
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      repetition_penalty: 0.4,
      temperature: 0.7
    },
    imageSettings: {
      steps: 4
    },
    endpoint: "https://api.together.ai/v1",
    model: {
      ["small" /* SMALL */]: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
      ["medium" /* MEDIUM */]: "meta-llama-3.1-8b-instruct",
      ["large" /* LARGE */]: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
      ["embedding" /* EMBEDDING */]: "togethercomputer/m2-bert-80M-32k-retrieval",
      ["image" /* IMAGE */]: "black-forest-labs/FLUX.1-schnell"
    }
  },
  ["llama_local" /* LLAMALOCAL */]: {
    settings: {
      stop: ["<|eot_id|>", "<|eom_id|>"],
      maxInputTokens: 32768,
      maxOutputTokens: 8192,
      repetition_penalty: 0.4,
      temperature: 0.7
    },
    model: {
      ["small" /* SMALL */]: "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
      ["medium" /* MEDIUM */]: "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
      // TODO: ?download=true
      ["large" /* LARGE */]: "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
      // "RichardErkhov/NousResearch_-_Meta-Llama-3.1-70B-gguf", // TODO:
      ["embedding" /* EMBEDDING */]: "togethercomputer/m2-bert-80M-32k-retrieval"
    }
  },
  ["google" /* GOOGLE */]: {
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    model: {
      ["small" /* SMALL */]: "gemini-1.5-flash-latest",
      ["medium" /* MEDIUM */]: "gemini-1.5-flash-latest",
      ["large" /* LARGE */]: "gemini-1.5-pro-latest",
      ["embedding" /* EMBEDDING */]: "text-embedding-004"
    }
  },
  ["redpill" /* REDPILL */]: {
    endpoint: "https://api.red-pill.ai/v1",
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0,
      presence_penalty: 0,
      temperature: 0.6
    },
    // Available models: https://docs.red-pill.ai/get-started/supported-models
    // To test other models, change the models below
    model: {
      ["small" /* SMALL */]: settings_default.SMALL_REDPILL_MODEL || settings_default.REDPILL_MODEL || "gpt-4o-mini",
      ["medium" /* MEDIUM */]: settings_default.MEDIUM_REDPILL_MODEL || settings_default.REDPILL_MODEL || "gpt-4o",
      ["large" /* LARGE */]: settings_default.LARGE_REDPILL_MODEL || settings_default.REDPILL_MODEL || "gpt-4o",
      ["embedding" /* EMBEDDING */]: "text-embedding-3-small"
    }
  },
  ["openrouter" /* OPENROUTER */]: {
    endpoint: "https://openrouter.ai/api/v1",
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    // Available models: https://openrouter.ai/models
    // To test other models, change the models below
    model: {
      ["small" /* SMALL */]: settings_default.SMALL_OPENROUTER_MODEL || settings_default.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b",
      ["medium" /* MEDIUM */]: settings_default.MEDIUM_OPENROUTER_MODEL || settings_default.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b",
      ["large" /* LARGE */]: settings_default.LARGE_OPENROUTER_MODEL || settings_default.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b",
      ["embedding" /* EMBEDDING */]: "text-embedding-3-small"
    }
  },
  ["ollama" /* OLLAMA */]: {
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
      temperature: 0.7
    },
    endpoint: settings_default.OLLAMA_SERVER_URL || "http://localhost:11434",
    model: {
      ["small" /* SMALL */]: settings_default.SMALL_OLLAMA_MODEL || settings_default.OLLAMA_MODEL || "llama3.2",
      ["medium" /* MEDIUM */]: settings_default.MEDIUM_OLLAMA_MODEL || settings_default.OLLAMA_MODEL || "hermes3",
      ["large" /* LARGE */]: settings_default.LARGE_OLLAMA_MODEL || settings_default.OLLAMA_MODEL || "hermes3:70b",
      ["embedding" /* EMBEDDING */]: settings_default.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large"
    }
  },
  ["heurist" /* HEURIST */]: {
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      repetition_penalty: 0.4,
      temperature: 0.7
    },
    imageSettings: {
      steps: 20
    },
    endpoint: "https://llm-gateway.heurist.xyz",
    model: {
      ["small" /* SMALL */]: "meta-llama/llama-3-70b-instruct",
      ["medium" /* MEDIUM */]: "meta-llama/llama-3-70b-instruct",
      ["large" /* LARGE */]: "meta-llama/llama-3.1-405b-instruct",
      ["embedding" /* EMBEDDING */]: "",
      //Add later,
      ["image" /* IMAGE */]: "PepeXL"
    }
  },
  ["galadriel" /* GALADRIEL */]: {
    endpoint: "https://api.galadriel.com/v1",
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      temperature: 0.8
    },
    model: {
      ["small" /* SMALL */]: "llama3.1:70b",
      ["medium" /* MEDIUM */]: "llama3.1:70b",
      ["large" /* LARGE */]: "llama3.1:405b",
      ["embedding" /* EMBEDDING */]: "gte-large-en-v1.5"
    }
  },
  ["falai" /* FAL */]: {
    settings: {
      stop: [],
      maxInputTokens: 128e3,
      maxOutputTokens: 8192,
      repetition_penalty: 0.4,
      temperature: 0.7
    },
    imageSettings: {
      steps: 28
    },
    endpoint: "https://api.fal.ai/v1",
    model: {
      ["small" /* SMALL */]: "",
      // FAL doesn't provide text models
      ["medium" /* MEDIUM */]: "",
      ["large" /* LARGE */]: "",
      ["embedding" /* EMBEDDING */]: "",
      ["image" /* IMAGE */]: "fal-ai/flux-lora"
    }
  }
};
function getModel(provider, type) {
  return models[provider].model[type];
}
function getEndpoint(provider) {
  return models[provider].endpoint;
}

// src/embedding.ts
var getEmbeddingConfig = () => ({
  dimensions: settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true" ? 1536 : settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true" ? 1024 : 384,
  // BGE
  model: settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true" ? "text-embedding-3-small" : settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true" ? settings_default.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large" : "BGE-small-en-v1.5",
  provider: settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true" ? "OpenAI" : settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true" ? "Ollama" : "BGE"
});
async function getRemoteEmbedding(input, options) {
  const baseEndpoint = options.endpoint.endsWith("/v1") ? options.endpoint : `${options.endpoint}${options.isOllama ? "/v1" : ""}`;
  const fullUrl = `${baseEndpoint}/embeddings`;
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options.apiKey ? {
        Authorization: `Bearer ${options.apiKey}`
      } : {}
    },
    body: JSON.stringify({
      input,
      model: options.model,
      dimensions: options.dimensions || options.length || getEmbeddingConfig().dimensions
      // Prefer dimensions, fallback to length
    })
  };
  try {
    const response = await fetch(fullUrl, requestOptions);
    if (!response.ok) {
      logger_default.error("API Response:", await response.text());
      throw new Error(
        `Embedding API Error: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    return data?.data?.[0].embedding;
  } catch (e) {
    logger_default.error("Full error details:", e);
    throw e;
  }
}
function getEmbeddingType(runtime) {
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  const isLocal = isNode && runtime.character.modelProvider !== "openai" /* OPENAI */ && !settings_default.USE_OPENAI_EMBEDDING;
  return isLocal ? "local" : "remote";
}
function getEmbeddingZeroVector() {
  let embeddingDimension = 384;
  if (settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true") {
    embeddingDimension = 1536;
  } else if (settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true") {
    embeddingDimension = 1024;
  }
  return Array(embeddingDimension).fill(0);
}
async function embed(runtime, input) {
  logger_default.debug("Embedding request:", {
    modelProvider: runtime.character.modelProvider,
    useOpenAI: process.env.USE_OPENAI_EMBEDDING,
    input: input?.slice(0, 50) + "...",
    inputType: typeof input,
    inputLength: input?.length,
    isString: typeof input === "string",
    isEmpty: !input
  });
  if (!input || typeof input !== "string" || input.trim().length === 0) {
    logger_default.warn("Invalid embedding input:", {
      input,
      type: typeof input,
      length: input?.length
    });
    return [];
  }
  const cachedEmbedding = await retrieveCachedEmbedding(runtime, input);
  if (cachedEmbedding) return cachedEmbedding;
  const config2 = getEmbeddingConfig();
  const isNode = typeof process !== "undefined" && process.versions?.node;
  if (config2.provider === "OpenAI") {
    return await getRemoteEmbedding(input, {
      model: config2.model,
      endpoint: "https://api.openai.com/v1",
      apiKey: settings_default.OPENAI_API_KEY,
      dimensions: config2.dimensions
    });
  }
  if (config2.provider === "Ollama") {
    return await getRemoteEmbedding(input, {
      model: config2.model,
      endpoint: runtime.character.modelEndpointOverride || models["ollama" /* OLLAMA */].endpoint,
      isOllama: true,
      dimensions: config2.dimensions
    });
  }
  if (isNode) {
    try {
      return await getLocalEmbedding(input);
    } catch (error) {
      logger_default.warn(
        "Local embedding failed, falling back to remote",
        error
      );
    }
  }
  return await getRemoteEmbedding(input, {
    model: config2.model,
    endpoint: runtime.character.modelEndpointOverride || models[runtime.character.modelProvider].endpoint,
    apiKey: runtime.token,
    dimensions: config2.dimensions
  });
  async function getLocalEmbedding(input2) {
    logger_default.debug("DEBUG - Inside getLocalEmbedding function");
    const isNode2 = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    if (!isNode2) {
      logger_default.warn(
        "Local embedding not supported in browser, falling back to remote embedding"
      );
      throw new Error("Local embedding not supported in browser");
    }
    try {
      let getRootPath = function() {
        const __filename2 = fileURLToPath2(import.meta.url);
        const __dirname2 = path3.dirname(__filename2);
        const rootPath = path3.resolve(__dirname2, "..");
        if (rootPath.includes("/eliza/")) {
          return rootPath.split("/eliza/")[0] + "/eliza/";
        }
        return path3.resolve(__dirname2, "..");
      };
      const moduleImports = await Promise.all([
        import("fs"),
        import("url"),
        (async () => {
          try {
            return await import("fastembed");
          } catch (error) {
            logger_default.error("Failed to load fastembed.");
            throw new Error("fastembed import failed, falling back to remote embedding");
          }
        })()
      ]);
      const [fs3, { fileURLToPath: fileURLToPath2 }, fastEmbed] = moduleImports;
      const { FlagEmbedding, EmbeddingModel } = fastEmbed;
      const cacheDir = getRootPath() + "/cache/";
      if (!fs3.existsSync(cacheDir)) {
        fs3.mkdirSync(cacheDir, { recursive: true });
      }
      logger_default.debug("Initializing BGE embedding model...");
      const embeddingModel = await FlagEmbedding.init({
        cacheDir,
        model: EmbeddingModel.BGESmallENV15,
        // BGE-small-en-v1.5 specific settings
        maxLength: 512
        // BGE's context window
      });
      logger_default.debug("Generating embedding for input:", {
        inputLength: input2.length,
        inputPreview: input2.slice(0, 100) + "..."
      });
      const embedding = await embeddingModel.queryEmbed(input2);
      logger_default.debug("Raw embedding from BGE:", {
        type: typeof embedding,
        isArray: Array.isArray(embedding),
        dimensions: Array.isArray(embedding) ? embedding.length : "not an array",
        sample: Array.isArray(embedding) ? embedding.slice(0, 5) : embedding
      });
      let finalEmbedding;
      if (ArrayBuffer.isView(embedding) && embedding.constructor === Float32Array) {
        finalEmbedding = Array.from(embedding);
      } else if (Array.isArray(embedding) && ArrayBuffer.isView(embedding[0]) && embedding[0].constructor === Float32Array) {
        finalEmbedding = Array.from(embedding[0]);
      } else if (Array.isArray(embedding)) {
        finalEmbedding = embedding;
      } else {
        throw new Error(
          `Unexpected embedding format: ${typeof embedding}`
        );
      }
      logger_default.debug("Processed embedding:", {
        length: finalEmbedding.length,
        sample: finalEmbedding.slice(0, 5),
        allNumbers: finalEmbedding.every((n) => typeof n === "number")
      });
      finalEmbedding = finalEmbedding.map((n) => Number(n));
      if (!Array.isArray(finalEmbedding) || finalEmbedding[0] === void 0) {
        throw new Error(
          "Invalid embedding format: must be an array starting with a number"
        );
      }
      if (finalEmbedding.length !== 384) {
        logger_default.warn(
          `Unexpected embedding dimension: ${finalEmbedding.length} (expected 384)`
        );
      }
      return finalEmbedding;
    } catch (error) {
      logger_default.warn(
        "Local embedding not supported in browser, falling back to remote embedding"
      );
      throw new Error("Local embedding not supported in browser");
    }
  }
  async function retrieveCachedEmbedding(runtime2, input2) {
    if (!input2) {
      logger_default.log("No input to retrieve cached embedding for");
      return null;
    }
    const similaritySearchResult = await runtime2.messageManager.getCachedEmbeddings(input2);
    if (similaritySearchResult.length > 0) {
      return similaritySearchResult[0].embedding;
    }
    return null;
  }
}

// src/evaluators.ts
import { names as names2, uniqueNamesGenerator as uniqueNamesGenerator2 } from "unique-names-generator";

// src/parsing.ts
var jsonBlockPattern = /```json\n([\s\S]*?)\n```/;
var messageCompletionFooter = `
Response format should be formatted in a JSON block like this:
\`\`\`json
{ "user": "{{agentName}}", "text": string, "action": "string" }
\`\`\``;
var shouldRespondFooter = `The available options are [RESPOND], [IGNORE], or [STOP]. Choose the most appropriate option.
If {{agentName}} is talking too much, you can choose [IGNORE]

Your response must include one of the options.`;
var parseShouldRespondFromText = (text) => {
  const match = text.split("\n")[0].trim().replace("[", "").toUpperCase().replace("]", "").match(/^(RESPOND|IGNORE|STOP)$/i);
  return match ? match[0].toUpperCase() : text.includes("RESPOND") ? "RESPOND" : text.includes("IGNORE") ? "IGNORE" : text.includes("STOP") ? "STOP" : null;
};
var booleanFooter = `Respond with a YES or a NO.`;
var parseBooleanFromText = (text) => {
  const match = text.match(/^(YES|NO)$/i);
  return match ? match[0].toUpperCase() === "YES" : null;
};
var stringArrayFooter = `Respond with a JSON array containing the values in a JSON block formatted for markdown with this structure:
\`\`\`json
[
  'value',
  'value'
]
\`\`\`

Your response must include the JSON block.`;
function parseJsonArrayFromText(text) {
  let jsonData = null;
  const jsonBlockMatch = text.match(jsonBlockPattern);
  if (jsonBlockMatch) {
    try {
      jsonData = JSON.parse(jsonBlockMatch[1]);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return null;
    }
  } else {
    const arrayPattern = /\[\s*{[\s\S]*?}\s*\]/;
    const arrayMatch = text.match(arrayPattern);
    if (arrayMatch) {
      try {
        jsonData = JSON.parse(arrayMatch[0]);
      } catch (e) {
        console.error("Error parsing JSON:", e);
        return null;
      }
    }
  }
  if (Array.isArray(jsonData)) {
    return jsonData;
  } else {
    return null;
  }
}
function parseJSONObjectFromText(text) {
  let jsonData = null;
  const jsonBlockMatch = text.match(jsonBlockPattern);
  if (jsonBlockMatch) {
    try {
      jsonData = JSON.parse(jsonBlockMatch[1]);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return null;
    }
  } else {
    const objectPattern = /{[\s\S]*?}/;
    const objectMatch = text.match(objectPattern);
    if (objectMatch) {
      try {
        jsonData = JSON.parse(objectMatch[0]);
      } catch (e) {
        console.error("Error parsing JSON:", e);
        return null;
      }
    }
  }
  if (typeof jsonData === "object" && jsonData !== null && !Array.isArray(jsonData)) {
    return jsonData;
  } else if (typeof jsonData === "object" && Array.isArray(jsonData)) {
    return parseJsonArrayFromText(text);
  } else {
    return null;
  }
}

// src/evaluators.ts
var evaluationTemplate = `TASK: Based on the conversation and conditions, determine which evaluation functions are appropriate to call.
Examples:
{{evaluatorExamples}}

INSTRUCTIONS: You are helping me to decide which appropriate functions to call based on the conversation between {{senderName}} and {{agentName}}.

{{recentMessages}}

Evaluator Functions:
{{evaluators}}

TASK: Based on the most recent conversation, determine which evaluators functions are appropriate to call to call.
Include the name of evaluators that are relevant and should be called in the array
Available evaluator names to include are {{evaluatorNames}}
` + stringArrayFooter;
function formatEvaluatorNames(evaluators) {
  return evaluators.map((evaluator) => `'${evaluator.name}'`).join(",\n");
}
function formatEvaluators(evaluators) {
  return evaluators.map(
    (evaluator) => `'${evaluator.name}: ${evaluator.description}'`
  ).join(",\n");
}
function formatEvaluatorExamples(evaluators) {
  return evaluators.map((evaluator) => {
    return evaluator.examples.map((example) => {
      const exampleNames = Array.from(
        { length: 5 },
        () => uniqueNamesGenerator2({ dictionaries: [names2] })
      );
      let formattedContext = example.context;
      let formattedOutcome = example.outcome;
      exampleNames.forEach((name, index) => {
        const placeholder = `{{user${index + 1}}}`;
        formattedContext = formattedContext.replaceAll(
          placeholder,
          name
        );
        formattedOutcome = formattedOutcome.replaceAll(
          placeholder,
          name
        );
      });
      const formattedMessages = example.messages.map((message) => {
        let messageString = `${message.user}: ${message.content.text}`;
        exampleNames.forEach((name, index) => {
          const placeholder = `{{user${index + 1}}}`;
          messageString = messageString.replaceAll(
            placeholder,
            name
          );
        });
        return messageString + (message.content.action ? ` (${message.content.action})` : "");
      }).join("\n");
      return `Context:
${formattedContext}

Messages:
${formattedMessages}

Outcome:
${formattedOutcome}`;
    }).join("\n\n");
  }).join("\n\n");
}
function formatEvaluatorExampleDescriptions(evaluators) {
  return evaluators.map(
    (evaluator) => evaluator.examples.map(
      (_example, index) => `${evaluator.name} Example ${index + 1}: ${evaluator.description}`
    ).join("\n")
  ).join("\n\n");
}

// src/generation.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import {
  generateObject as aiGenerateObject,
  generateText as aiGenerateText
} from "ai";
import { Buffer } from "buffer";
import { createOllama } from "ollama-ai-provider";
import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import Together from "together-ai";
import { fal } from "@fal-ai/client";
async function generateText({
  runtime,
  context,
  modelClass,
  stop
}) {
  if (!context) {
    console.error("generateText context is empty");
    return "";
  }
  elizaLogger.log("Generating text...");
  elizaLogger.info("Generating text with options:", {
    modelProvider: runtime.modelProvider,
    model: modelClass
  });
  const provider = runtime.modelProvider;
  const endpoint = runtime.character.modelEndpointOverride || models[provider].endpoint;
  let model = models[provider].model[modelClass];
  if (runtime.getSetting("LLAMACLOUD_MODEL_LARGE") && provider === "llama_cloud" /* LLAMACLOUD */) {
    model = runtime.getSetting("LLAMACLOUD_MODEL_LARGE");
  }
  if (runtime.getSetting("LLAMACLOUD_MODEL_SMALL") && provider === "llama_cloud" /* LLAMACLOUD */) {
    model = runtime.getSetting("LLAMACLOUD_MODEL_SMALL");
  }
  elizaLogger.info("Selected model:", model);
  const temperature = models[provider].settings.temperature;
  const frequency_penalty = models[provider].settings.frequency_penalty;
  const presence_penalty = models[provider].settings.presence_penalty;
  const max_context_length = models[provider].settings.maxInputTokens;
  const max_response_length = models[provider].settings.maxOutputTokens;
  const apiKey = runtime.token;
  try {
    elizaLogger.debug(
      `Trimming context to max length of ${max_context_length} tokens.`
    );
    context = await trimTokens(context, max_context_length, "gpt-4o");
    let response;
    const _stop = stop || models[provider].settings.stop;
    elizaLogger.debug(
      `Using provider: ${provider}, model: ${model}, temperature: ${temperature}, max response length: ${max_response_length}`
    );
    switch (provider) {
      // OPENAI & LLAMACLOUD shared same structure.
      case "openai" /* OPENAI */:
      case "eternalai" /* ETERNALAI */:
      case "llama_cloud" /* LLAMACLOUD */: {
        elizaLogger.debug("Initializing OpenAI model.");
        const openai = createOpenAI({ apiKey, baseURL: endpoint });
        const { text: openaiResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = openaiResponse;
        elizaLogger.debug("Received response from OpenAI model.");
        break;
      }
      case "google" /* GOOGLE */: {
        const google = createGoogleGenerativeAI();
        const { text: googleResponse } = await aiGenerateText({
          model: google(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = googleResponse;
        elizaLogger.debug("Received response from Google model.");
        break;
      }
      case "anthropic" /* ANTHROPIC */: {
        elizaLogger.debug("Initializing Anthropic model.");
        const anthropic = createAnthropic({ apiKey });
        const { text: anthropicResponse } = await aiGenerateText({
          model: anthropic.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = anthropicResponse;
        elizaLogger.debug("Received response from Anthropic model.");
        break;
      }
      case "claude_vertex" /* CLAUDE_VERTEX */: {
        elizaLogger.debug("Initializing Claude Vertex model.");
        const anthropic = createAnthropic({ apiKey });
        const { text: anthropicResponse } = await aiGenerateText({
          model: anthropic.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = anthropicResponse;
        elizaLogger.debug(
          "Received response from Claude Vertex model."
        );
        break;
      }
      case "grok" /* GROK */: {
        elizaLogger.debug("Initializing Grok model.");
        const grok = createOpenAI({ apiKey, baseURL: endpoint });
        const { text: grokResponse } = await aiGenerateText({
          model: grok.languageModel(model, {
            parallelToolCalls: false
          }),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = grokResponse;
        elizaLogger.debug("Received response from Grok model.");
        break;
      }
      case "groq" /* GROQ */: {
        const groq = createGroq({ apiKey });
        const { text: groqResponse } = await aiGenerateText({
          model: groq.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = groqResponse;
        break;
      }
      case "llama_local" /* LLAMALOCAL */: {
        elizaLogger.debug(
          "Using local Llama model for text completion."
        );
        const textGenerationService = runtime.getService(
          "text_generation" /* TEXT_GENERATION */
        );
        if (!textGenerationService) {
          throw new Error("Text generation service not found");
        }
        response = await textGenerationService.queueTextCompletion(
          context,
          temperature,
          _stop,
          frequency_penalty,
          presence_penalty,
          max_response_length
        );
        elizaLogger.debug("Received response from local Llama model.");
        break;
      }
      case "redpill" /* REDPILL */: {
        elizaLogger.debug("Initializing RedPill model.");
        const serverUrl = models[provider].endpoint;
        const openai = createOpenAI({ apiKey, baseURL: serverUrl });
        const { text: redpillResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = redpillResponse;
        elizaLogger.debug("Received response from redpill model.");
        break;
      }
      case "openrouter" /* OPENROUTER */: {
        elizaLogger.debug("Initializing OpenRouter model.");
        const serverUrl = models[provider].endpoint;
        const openrouter = createOpenAI({ apiKey, baseURL: serverUrl });
        const { text: openrouterResponse } = await aiGenerateText({
          model: openrouter.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = openrouterResponse;
        elizaLogger.debug("Received response from OpenRouter model.");
        break;
      }
      case "ollama" /* OLLAMA */:
        {
          elizaLogger.debug("Initializing Ollama model.");
          const ollamaProvider = createOllama({
            baseURL: models[provider].endpoint + "/api"
          });
          const ollama = ollamaProvider(model);
          elizaLogger.debug("****** MODEL\n", model);
          const { text: ollamaResponse } = await aiGenerateText({
            model: ollama,
            prompt: context,
            temperature,
            maxTokens: max_response_length,
            frequencyPenalty: frequency_penalty,
            presencePenalty: presence_penalty
          });
          response = ollamaResponse;
        }
        elizaLogger.debug("Received response from Ollama model.");
        break;
      case "heurist" /* HEURIST */: {
        elizaLogger.debug("Initializing Heurist model.");
        const heurist = createOpenAI({
          apiKey,
          baseURL: endpoint
        });
        const { text: heuristResponse } = await aiGenerateText({
          model: heurist.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = heuristResponse;
        elizaLogger.debug("Received response from Heurist model.");
        break;
      }
      case "galadriel" /* GALADRIEL */: {
        elizaLogger.debug("Initializing Galadriel model.");
        const galadriel = createOpenAI({
          apiKey,
          baseURL: endpoint
        });
        const { text: galadrielResponse } = await aiGenerateText({
          model: galadriel.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = galadrielResponse;
        elizaLogger.debug("Received response from Galadriel model.");
        break;
      }
      default: {
        const errorMessage = `Unsupported provider: ${provider}`;
        elizaLogger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
    return response;
  } catch (error) {
    elizaLogger.error("Error in generateText:", error);
    throw error;
  }
}
function trimTokens(context, maxTokens, model) {
  if (!context) return "";
  if (maxTokens <= 0) throw new Error("maxTokens must be positive");
  const encoding = encodingForModel(model);
  try {
    const tokens = encoding.encode(context);
    if (tokens.length <= maxTokens) {
      return context;
    }
    const truncatedTokens = tokens.slice(-maxTokens);
    return encoding.decode(truncatedTokens);
  } catch (error) {
    console.error("Error in trimTokens:", error);
    return context.slice(-maxTokens * 4);
  }
}
async function generateShouldRespond({
  runtime,
  context,
  modelClass
}) {
  let retryDelay = 1e3;
  while (true) {
    try {
      elizaLogger.debug(
        "Attempting to generate text with context:",
        context
      );
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      elizaLogger.debug("Received response from generateText:", response);
      const parsedResponse = parseShouldRespondFromText(response.trim());
      if (parsedResponse) {
        elizaLogger.debug("Parsed response:", parsedResponse);
        return parsedResponse;
      } else {
        elizaLogger.debug("generateShouldRespond no response");
      }
    } catch (error) {
      elizaLogger.error("Error in generateShouldRespond:", error);
      if (error instanceof TypeError && error.message.includes("queueTextCompletion")) {
        elizaLogger.error(
          "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
        );
      }
    }
    elizaLogger.log(`Retrying in ${retryDelay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function splitChunks(content, chunkSize = 512, bleed = 20) {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: Number(chunkSize),
    chunkOverlap: Number(bleed)
  });
  return textSplitter.splitText(content);
}
async function generateTrueOrFalse({
  runtime,
  context = "",
  modelClass
}) {
  let retryDelay = 1e3;
  const stop = Array.from(
    /* @__PURE__ */ new Set([
      ...models[runtime.modelProvider].settings.stop || [],
      ["\n"]
    ])
  );
  while (true) {
    try {
      const response = await generateText({
        stop,
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseBooleanFromText(response.trim());
      if (parsedResponse !== null) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateTrueOrFalse:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateTextArray({
  runtime,
  context,
  modelClass
}) {
  if (!context) {
    elizaLogger.error("generateTextArray context is empty");
    return [];
  }
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseJsonArrayFromText(response);
      if (parsedResponse) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateTextArray:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateObject({
  runtime,
  context,
  modelClass
}) {
  if (!context) {
    elizaLogger.error("generateObject context is empty");
    return null;
  }
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseJSONObjectFromText(response);
      if (parsedResponse) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateObject:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateObjectArray({
  runtime,
  context,
  modelClass
}) {
  if (!context) {
    elizaLogger.error("generateObjectArray context is empty");
    return [];
  }
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseJsonArrayFromText(response);
      if (parsedResponse) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateTextArray:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateMessageResponse({
  runtime,
  context,
  modelClass
}) {
  const max_context_length = models[runtime.modelProvider].settings.maxInputTokens;
  context = trimTokens(context, max_context_length, "gpt-4o");
  let retryLength = 1e3;
  while (true) {
    try {
      elizaLogger.log("Generating message response..");
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedContent = parseJSONObjectFromText(response);
      if (!parsedContent) {
        elizaLogger.debug("parsedContent is null, retrying");
        continue;
      }
      return parsedContent;
    } catch (error) {
      elizaLogger.error("ERROR:", error);
      retryLength *= 2;
      await new Promise((resolve) => setTimeout(resolve, retryLength));
      elizaLogger.debug("Retrying...");
    }
  }
}
var generateImage = async (data, runtime) => {
  const { prompt, width, height } = data;
  let { count } = data;
  if (!count) {
    count = 1;
  }
  const model = getModel(runtime.imageModelProvider, "image" /* IMAGE */);
  const modelSettings = models[runtime.imageModelProvider].imageSettings;
  elizaLogger.info("Generating image with options:", {
    imageModelProvider: model
  });
  const apiKey = runtime.imageModelProvider === runtime.modelProvider ? runtime.token : runtime.getSetting("HEURIST_API_KEY") ?? runtime.getSetting("TOGETHER_API_KEY") ?? runtime.getSetting("FAL_API_KEY") ?? runtime.getSetting("OPENAI_API_KEY");
  try {
    if (runtime.imageModelProvider === "heurist" /* HEURIST */) {
      const response = await fetch(
        "http://sequencer.heurist.xyz/submit_job",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            job_id: data.jobId || crypto.randomUUID(),
            model_input: {
              SD: {
                prompt: data.prompt,
                neg_prompt: data.negativePrompt,
                num_iterations: data.numIterations || 20,
                width: data.width || 512,
                height: data.height || 512,
                guidance_scale: data.guidanceScale || 3,
                seed: data.seed || -1
              }
            },
            model_id: data.modelId || "FLUX.1-dev",
            deadline: 60,
            priority: 1
          })
        }
      );
      if (!response.ok) {
        throw new Error(
          `Heurist image generation failed: ${response.statusText}`
        );
      }
      const imageURL = await response.json();
      return { success: true, data: [imageURL] };
    } else if (runtime.imageModelProvider === "llama_cloud" /* LLAMACLOUD */) {
      const together = new Together({ apiKey });
      const response = await together.images.create({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt,
        width,
        height,
        steps: modelSettings?.steps ?? 4,
        n: count
      });
      const urls = [];
      for (let i = 0; i < response.data.length; i++) {
        const json = response.data[i].b64_json;
        const base64 = Buffer.from(json, "base64").toString("base64");
        urls.push(base64);
      }
      const base64s = await Promise.all(
        urls.map(async (url) => {
          const response2 = await fetch(url);
          const blob = await response2.blob();
          const buffer = await blob.arrayBuffer();
          let base64 = Buffer.from(buffer).toString("base64");
          base64 = "data:image/jpeg;base64," + base64;
          return base64;
        })
      );
      return { success: true, data: base64s };
    } else if (runtime.imageModelProvider === "falai" /* FAL */) {
      fal.config({
        credentials: apiKey
      });
      const input = {
        prompt,
        image_size: "square",
        num_inference_steps: modelSettings?.steps ?? 50,
        guidance_scale: 3.5,
        num_images: count,
        enable_safety_checker: true,
        output_format: "png",
        seed: data.seed ?? 6252023,
        ...runtime.getSetting("FAL_AI_LORA_PATH") ? {
          loras: [
            {
              path: runtime.getSetting("FAL_AI_LORA_PATH"),
              scale: 1
            }
          ]
        } : {}
      };
      const result = await fal.subscribe(model, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            elizaLogger.info(update.logs.map((log) => log.message));
          }
        }
      });
      const base64Promises = result.data.images.map(async (image) => {
        const response = await fetch(image.url);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return `data:${image.content_type};base64,${base64}`;
      });
      const base64s = await Promise.all(base64Promises);
      return { success: true, data: base64s };
    } else {
      let targetSize = `${width}x${height}`;
      if (targetSize !== "1024x1024" && targetSize !== "1792x1024" && targetSize !== "1024x1792") {
        targetSize = "1024x1024";
      }
      const openai = new OpenAI({ apiKey });
      const response = await openai.images.generate({
        model,
        prompt,
        size: targetSize,
        n: count,
        response_format: "b64_json"
      });
      const base64s = response.data.map(
        (image) => `data:image/png;base64,${image.b64_json}`
      );
      return { success: true, data: base64s };
    }
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
};
var generateCaption = async (data, runtime) => {
  const { imageUrl } = data;
  const imageDescriptionService = runtime.getService(
    "image_description" /* IMAGE_DESCRIPTION */
  );
  if (!imageDescriptionService) {
    throw new Error("Image description service not found");
  }
  const resp = await imageDescriptionService.describeImage(imageUrl);
  return {
    title: resp.title.trim(),
    description: resp.description.trim()
  };
};
var generateWebSearch = async (query, runtime) => {
  const apiUrl = "https://api.tavily.com/search";
  const apiKey = runtime.getSetting("TAVILY_API_KEY");
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        include_answer: true
      })
    });
    if (!response.ok) {
      throw new elizaLogger.error(
        `HTTP error! status: ${response.status}`
      );
    }
    const data = await response.json();
    return data;
  } catch (error) {
    elizaLogger.error("Error:", error);
  }
};
var generateObjectV2 = async ({
  runtime,
  context,
  modelClass,
  schema,
  schemaName,
  schemaDescription,
  stop,
  mode = "json"
}) => {
  if (!context) {
    const errorMessage = "generateObject context is empty";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  const provider = runtime.modelProvider;
  const model = models[provider].model[modelClass];
  if (!model) {
    throw new Error(`Unsupported model class: ${modelClass}`);
  }
  const temperature = models[provider].settings.temperature;
  const frequency_penalty = models[provider].settings.frequency_penalty;
  const presence_penalty = models[provider].settings.presence_penalty;
  const max_context_length = models[provider].settings.maxInputTokens;
  const max_response_length = models[provider].settings.maxOutputTokens;
  const apiKey = runtime.token;
  try {
    context = trimTokens(context, max_context_length, model);
    const modelOptions = {
      prompt: context,
      temperature,
      maxTokens: max_response_length,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
      stop: stop || models[provider].settings.stop
    };
    const response = await handleProvider({
      provider,
      model,
      apiKey,
      schema,
      schemaName,
      schemaDescription,
      mode,
      modelOptions,
      runtime,
      context,
      modelClass
    });
    return response;
  } catch (error) {
    console.error("Error in generateObject:", error);
    throw error;
  }
};
async function handleProvider(options) {
  const { provider, runtime, context, modelClass } = options;
  switch (provider) {
    case "openai" /* OPENAI */:
    case "eternalai" /* ETERNALAI */:
    case "llama_cloud" /* LLAMACLOUD */:
      return await handleOpenAI(options);
    case "anthropic" /* ANTHROPIC */:
      return await handleAnthropic(options);
    case "grok" /* GROK */:
      return await handleGrok(options);
    case "groq" /* GROQ */:
      return await handleGroq(options);
    case "llama_local" /* LLAMALOCAL */:
      return await generateObject({
        runtime,
        context,
        modelClass
      });
    case "google" /* GOOGLE */:
      return await handleGoogle(options);
    case "redpill" /* REDPILL */:
      return await handleRedPill(options);
    case "openrouter" /* OPENROUTER */:
      return await handleOpenRouter(options);
    case "ollama" /* OLLAMA */:
      return await handleOllama(options);
    default: {
      const errorMessage = `Unsupported provider: ${provider}`;
      elizaLogger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}
async function handleOpenAI({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const baseURL = models.openai.endpoint || void 0;
  const openai = createOpenAI({ apiKey, baseURL });
  return await aiGenerateObject({
    model: openai.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleAnthropic({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const anthropic = createAnthropic({ apiKey });
  return await aiGenerateObject({
    model: anthropic.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleGrok({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const grok = createOpenAI({ apiKey, baseURL: models.grok.endpoint });
  return await aiGenerateObject({
    model: grok.languageModel(model, { parallelToolCalls: false }),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleGroq({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const groq = createGroq({ apiKey });
  return await aiGenerateObject({
    model: groq.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleGoogle({
  model,
  apiKey: _apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const google = createGoogleGenerativeAI();
  return await aiGenerateObject({
    model: google(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleRedPill({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const redPill = createOpenAI({ apiKey, baseURL: models.redpill.endpoint });
  return await aiGenerateObject({
    model: redPill.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleOpenRouter({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions
}) {
  const openRouter = createOpenAI({
    apiKey,
    baseURL: models.openrouter.endpoint
  });
  return await aiGenerateObject({
    model: openRouter.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleOllama({
  model,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions,
  provider
}) {
  const ollamaProvider = createOllama({
    baseURL: models[provider].endpoint + "/api"
  });
  const ollama = ollamaProvider(model);
  return await aiGenerateObject({
    model: ollama,
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}

// src/goals.ts
var getGoals = async ({
  runtime,
  roomId,
  userId,
  onlyInProgress = true,
  count = 5
}) => {
  return runtime.databaseAdapter.getGoals({
    agentId: runtime.agentId,
    roomId,
    userId,
    onlyInProgress,
    count
  });
};
var formatGoalsAsString = ({ goals }) => {
  const goalStrings = goals.map((goal) => {
    const header = `Goal: ${goal.name}
id: ${goal.id}`;
    const objectives = "Objectives:\n" + goal.objectives.map((objective) => {
      return `- ${objective.completed ? "[x]" : "[ ]"} ${objective.description} ${objective.completed ? " (DONE)" : " (IN PROGRESS)"}`;
    }).join("\n");
    return `${header}
${objectives}`;
  });
  return goalStrings.join("\n");
};
var updateGoal = async ({
  runtime,
  goal
}) => {
  return runtime.databaseAdapter.updateGoal(goal);
};
var createGoal = async ({
  runtime,
  goal
}) => {
  return runtime.databaseAdapter.createGoal(goal);
};

// src/memory.ts
var defaultMatchThreshold = 0.1;
var defaultMatchCount = 10;
var MemoryManager = class {
  /**
   * The AgentRuntime instance associated with this manager.
   */
  runtime;
  /**
   * The name of the database table this manager operates on.
   */
  tableName;
  /**
   * Constructs a new MemoryManager instance.
   * @param opts Options for the manager.
   * @param opts.tableName The name of the table this manager will operate on.
   * @param opts.runtime The AgentRuntime instance associated with this manager.
   */
  constructor(opts) {
    this.runtime = opts.runtime;
    this.tableName = opts.tableName;
  }
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
  async addEmbeddingToMemory(memory) {
    if (memory.embedding) {
      return memory;
    }
    const memoryText = memory.content.text;
    if (!memoryText) {
      throw new Error(
        "Cannot generate embedding: Memory content is empty"
      );
    }
    try {
      memory.embedding = await embed(this.runtime, memoryText);
    } catch (error) {
      logger_default.error("Failed to generate embedding:", error);
      memory.embedding = getEmbeddingZeroVector().slice();
    }
    return memory;
  }
  /**
   * Retrieves a list of memories by user IDs, with optional deduplication.
   * @param opts Options including user IDs, count, and uniqueness.
   * @param opts.roomId The room ID to retrieve memories for.
   * @param opts.count The number of memories to retrieve.
   * @param opts.unique Whether to retrieve unique memories only.
   * @returns A Promise resolving to an array of Memory objects.
   */
  async getMemories({
    roomId,
    count = 10,
    unique = true,
    start,
    end
  }) {
    return await this.runtime.databaseAdapter.getMemories({
      roomId,
      count,
      unique,
      tableName: this.tableName,
      agentId: this.runtime.agentId,
      start,
      end
    });
  }
  async getCachedEmbeddings(content) {
    return await this.runtime.databaseAdapter.getCachedEmbeddings({
      query_table_name: this.tableName,
      query_threshold: 2,
      query_input: content,
      query_field_name: "content",
      query_field_sub_name: "text",
      query_match_count: 10
    });
  }
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
  async searchMemoriesByEmbedding(embedding, opts) {
    const {
      match_threshold = defaultMatchThreshold,
      count = defaultMatchCount,
      roomId,
      unique
    } = opts;
    const result = await this.runtime.databaseAdapter.searchMemories({
      tableName: this.tableName,
      roomId,
      agentId: this.runtime.agentId,
      embedding,
      match_threshold,
      match_count: count,
      unique: !!unique
    });
    return result;
  }
  /**
   * Creates a new memory in the database, with an option to check for similarity before insertion.
   * @param memory The memory object to create.
   * @param unique Whether to check for similarity before insertion.
   * @returns A Promise that resolves when the operation completes.
   */
  async createMemory(memory, unique = false) {
    const existingMessage = await this.runtime.databaseAdapter.getMemoryById(memory.id);
    if (existingMessage) {
      logger_default.debug("Memory already exists, skipping");
      return;
    }
    logger_default.log("Creating Memory", memory.id, memory.content.text);
    await this.runtime.databaseAdapter.createMemory(
      memory,
      this.tableName,
      unique
    );
  }
  async getMemoriesByRoomIds(params) {
    return await this.runtime.databaseAdapter.getMemoriesByRoomIds({
      tableName: this.tableName,
      agentId: this.runtime.agentId,
      roomIds: params.roomIds
    });
  }
  async getMemoryById(id) {
    const result = await this.runtime.databaseAdapter.getMemoryById(id);
    if (result && result.agentId !== this.runtime.agentId) return null;
    return result;
  }
  /**
   * Removes a memory from the database by its ID.
   * @param memoryId The ID of the memory to remove.
   * @returns A Promise that resolves when the operation completes.
   */
  async removeMemory(memoryId) {
    await this.runtime.databaseAdapter.removeMemory(
      memoryId,
      this.tableName
    );
  }
  /**
   * Removes all memories associated with a set of user IDs.
   * @param roomId The room ID to remove memories for.
   * @returns A Promise that resolves when the operation completes.
   */
  async removeAllMemories(roomId) {
    await this.runtime.databaseAdapter.removeAllMemories(
      roomId,
      this.tableName
    );
  }
  /**
   * Counts the number of memories associated with a set of user IDs, with an option for uniqueness.
   * @param roomId The room ID to count memories for.
   * @param unique Whether to count unique memories only.
   * @returns A Promise resolving to the count of memories.
   */
  async countMemories(roomId, unique = true) {
    return await this.runtime.databaseAdapter.countMemories(
      roomId,
      unique,
      this.tableName
    );
  }
};

// src/messages.ts
async function getActorDetails({
  runtime,
  roomId
}) {
  const participantIds = await runtime.databaseAdapter.getParticipantsForRoom(roomId);
  const actors = await Promise.all(
    participantIds.map(async (userId) => {
      const account = await runtime.databaseAdapter.getAccountById(userId);
      if (account) {
        return {
          id: account.id,
          name: account.name,
          username: account.username,
          details: account.details
        };
      }
      return null;
    })
  );
  return actors.filter((actor) => actor !== null);
}
function formatActors({ actors }) {
  const actorStrings = actors.map((actor) => {
    const header = `${actor.name}${actor.details?.tagline ? ": " + actor.details?.tagline : ""}${actor.details?.summary ? "\n" + actor.details?.summary : ""}`;
    return header;
  });
  const finalActorStrings = actorStrings.join("\n");
  return finalActorStrings;
}
var formatMessages = ({
  messages,
  actors
}) => {
  const messageStrings = messages.reverse().filter((message) => message.userId).map((message) => {
    const messageContent = message.content.text;
    const messageAction = message.content.action;
    const formattedName = actors.find((actor) => actor.id === message.userId)?.name || "Unknown User";
    const attachments = message.content.attachments;
    const attachmentString = attachments && attachments.length > 0 ? ` (Attachments: ${attachments.map((media) => `[${media.id} - ${media.title} (${media.url})]`).join(", ")})` : "";
    const timestamp = formatTimestamp(message.createdAt);
    const shortId = message.userId.slice(-5);
    return `(${timestamp}) [${shortId}] ${formattedName}: ${messageContent}${attachmentString}${messageAction && messageAction !== "null" ? ` (${messageAction})` : ""}`;
  }).join("\n");
  return messageStrings;
};
var formatTimestamp = (messageDate) => {
  const now = /* @__PURE__ */ new Date();
  const diff = now.getTime() - messageDate;
  const absDiff = Math.abs(diff);
  const seconds = Math.floor(absDiff / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (absDiff < 6e4) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
};

// src/posts.ts
var formatPosts = ({
  messages,
  actors,
  conversationHeader = true
}) => {
  const groupedMessages = {};
  messages.forEach((message) => {
    if (message.roomId) {
      if (!groupedMessages[message.roomId]) {
        groupedMessages[message.roomId] = [];
      }
      groupedMessages[message.roomId].push(message);
    }
  });
  Object.values(groupedMessages).forEach((roomMessages) => {
    roomMessages.sort((a, b) => a.createdAt - b.createdAt);
  });
  const sortedRooms = Object.entries(groupedMessages).sort(
    ([, messagesA], [, messagesB]) => messagesB[messagesB.length - 1].createdAt - messagesA[messagesA.length - 1].createdAt
  );
  const formattedPosts = sortedRooms.map(([roomId, roomMessages]) => {
    const messageStrings = roomMessages.filter((message) => message.userId).map((message) => {
      const actor = actors.find(
        (actor2) => actor2.id === message.userId
      );
      const userName = actor?.name || "Unknown User";
      const displayName = actor?.username || "unknown";
      return `Name: ${userName} (@${displayName})
ID: ${message.id}${message.content.inReplyTo ? `
In reply to: ${message.content.inReplyTo}` : ""}
Date: ${formatTimestamp(message.createdAt)}
Text:
${message.content.text}`;
    });
    const header = conversationHeader ? `Conversation: ${roomId.slice(-5)}
` : "";
    return `${header}${messageStrings.join("\n\n")}`;
  });
  return formattedPosts.join("\n\n");
};

// src/providers.ts
async function getProviders(runtime, message, state) {
  const providerResults = await Promise.all(
    runtime.providers.map(async (provider) => {
      return await provider.get(runtime, message, state);
    })
  );
  return providerResults.join("\n");
}

// src/relationships.ts
async function createRelationship({
  runtime,
  userA,
  userB
}) {
  return runtime.databaseAdapter.createRelationship({
    userA,
    userB
  });
}
async function getRelationship({
  runtime,
  userA,
  userB
}) {
  return runtime.databaseAdapter.getRelationship({
    userA,
    userB
  });
}
async function getRelationships({
  runtime,
  userId
}) {
  return runtime.databaseAdapter.getRelationships({ userId });
}
async function formatRelationships({
  runtime,
  userId
}) {
  const relationships = await getRelationships({ runtime, userId });
  const formattedRelationships = relationships.map(
    (relationship) => {
      const { userA, userB } = relationship;
      if (userA === userId) {
        return userB;
      }
      return userA;
    }
  );
  return formattedRelationships;
}

// src/runtime.ts
import { names as names3, uniqueNamesGenerator as uniqueNamesGenerator3 } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";

// src/uuid.ts
import { sha1 } from "js-sha1";
function stringToUuid(target) {
  if (typeof target === "number") {
    target = target.toString();
  }
  if (typeof target !== "string") {
    throw TypeError("Value must be string");
  }
  const _uint8ToHex = (ubyte) => {
    const first = ubyte >> 4;
    const second = ubyte - (first << 4);
    const HEX_DIGITS = "0123456789abcdef".split("");
    return HEX_DIGITS[first] + HEX_DIGITS[second];
  };
  const _uint8ArrayToHex = (buf) => {
    let out = "";
    for (let i = 0; i < buf.length; i++) {
      out += _uint8ToHex(buf[i]);
    }
    return out;
  };
  const escapedStr = encodeURIComponent(target);
  const buffer = new Uint8Array(escapedStr.length);
  for (let i = 0; i < escapedStr.length; i++) {
    buffer[i] = escapedStr[i].charCodeAt(0);
  }
  const hash = sha1(buffer);
  const hashBuffer = new Uint8Array(hash.length / 2);
  for (let i = 0; i < hash.length; i += 2) {
    hashBuffer[i / 2] = parseInt(hash.slice(i, i + 2), 16);
  }
  return _uint8ArrayToHex(hashBuffer.slice(0, 4)) + "-" + _uint8ArrayToHex(hashBuffer.slice(4, 6)) + "-" + _uint8ToHex(hashBuffer[6] & 15) + _uint8ToHex(hashBuffer[7]) + "-" + _uint8ToHex(hashBuffer[8] & 63 | 128) + _uint8ToHex(hashBuffer[9]) + "-" + _uint8ArrayToHex(hashBuffer.slice(10, 16));
}

// src/knowledge.ts
async function get(runtime, message) {
  if (!message?.content?.text) {
    logger_default.warn("Invalid message for knowledge query:", {
      message,
      content: message?.content,
      text: message?.content?.text
    });
    return [];
  }
  const processed = preprocess(message.content.text);
  logger_default.debug("Knowledge query:", {
    original: message.content.text,
    processed,
    length: processed?.length
  });
  if (!processed || processed.trim().length === 0) {
    logger_default.warn("Empty processed text for knowledge query");
    return [];
  }
  const embedding = await embed(runtime, processed);
  const fragments = await runtime.knowledgeManager.searchMemoriesByEmbedding(
    embedding,
    {
      roomId: message.agentId,
      count: 3,
      match_threshold: 0.1
    }
  );
  const uniqueSources = [
    ...new Set(
      fragments.map((memory) => {
        logger_default.log(
          `Matched fragment: ${memory.content.text} with similarity: ${memory.similarity}`
        );
        return memory.content.source;
      })
    )
  ];
  const knowledgeDocuments = await Promise.all(
    uniqueSources.map(
      (source) => runtime.documentsManager.getMemoryById(source)
    )
  );
  return knowledgeDocuments.filter((memory) => memory !== null).map((memory) => ({ id: memory.id, content: memory.content }));
}
async function set(runtime, item, chunkSize = 512, bleed = 20) {
  await runtime.documentsManager.createMemory({
    id: item.id,
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    userId: runtime.agentId,
    createdAt: Date.now(),
    content: item.content,
    embedding: getEmbeddingZeroVector()
  });
  const preprocessed = preprocess(item.content.text);
  const fragments = await splitChunks(preprocessed, chunkSize, bleed);
  for (const fragment of fragments) {
    const embedding = await embed(runtime, fragment);
    await runtime.knowledgeManager.createMemory({
      // We namespace the knowledge base uuid to avoid id
      // collision with the document above.
      id: stringToUuid(item.id + fragment),
      roomId: runtime.agentId,
      agentId: runtime.agentId,
      userId: runtime.agentId,
      createdAt: Date.now(),
      content: {
        source: item.id,
        text: fragment
      },
      embedding
    });
  }
}
function preprocess(content) {
  logger_default.debug("Preprocessing text:", {
    input: content,
    length: content?.length
  });
  if (!content || typeof content !== "string") {
    logger_default.warn("Invalid input for preprocessing");
    return "";
  }
  return content.replace(/```[\s\S]*?```/g, "").replace(/`.*?`/g, "").replace(/#{1,6}\s*(.*)/g, "$1").replace(/!\[(.*?)\]\(.*?\)/g, "$1").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, "$3").replace(/<@[!&]?\d+>/g, "").replace(/<[^>]*>/g, "").replace(/^\s*[-*_]{3,}\s*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "").replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[^a-zA-Z0-9\s\-_./:?=&]/g, "").trim().toLowerCase();
}
var knowledge_default = {
  get,
  set,
  preprocess
};

// src/runtime.ts
var AgentRuntime = class {
  /**
   * Default count for recent messages to be kept in memory.
   * @private
   */
  #conversationLength = 32;
  /**
   * The ID of the agent
   */
  agentId;
  /**
   * The base URL of the server where the agent's requests are processed.
   */
  serverUrl = "http://localhost:7998";
  /**
   * The database adapter used for interacting with the database.
   */
  databaseAdapter;
  /**
   * Authentication token used for securing requests.
   */
  token;
  /**
   * Custom actions that the agent can perform.
   */
  actions = [];
  /**
   * Evaluators used to assess and guide the agent's responses.
   */
  evaluators = [];
  /**
   * Context providers used to provide context for message generation.
   */
  providers = [];
  plugins = [];
  /**
   * The model to use for generateText.
   */
  modelProvider;
  /**
   * The model to use for generateImage.
   */
  imageModelProvider;
  /**
   * Fetch function to use
   * Some environments may not have access to the global fetch function and need a custom fetch override.
   */
  fetch = fetch;
  /**
   * The character to use for the agent
   */
  character;
  /**
   * Store messages that are sent and received by the agent.
   */
  messageManager;
  /**
   * Store and recall descriptions of users based on conversations.
   */
  descriptionManager;
  /**
   * Manage the creation and recall of static information (documents, historical game lore, etc)
   */
  loreManager;
  /**
   * Hold large documents that can be referenced
   */
  documentsManager;
  /**
   * Searchable document fragments
   */
  knowledgeManager;
  services = /* @__PURE__ */ new Map();
  memoryManagers = /* @__PURE__ */ new Map();
  cacheManager;
  registerMemoryManager(manager) {
    if (!manager.tableName) {
      throw new Error("Memory manager must have a tableName");
    }
    if (this.memoryManagers.has(manager.tableName)) {
      elizaLogger.warn(
        `Memory manager ${manager.tableName} is already registered. Skipping registration.`
      );
      return;
    }
    this.memoryManagers.set(manager.tableName, manager);
  }
  getMemoryManager(tableName) {
    return this.memoryManagers.get(tableName) || null;
  }
  getService(service) {
    const serviceInstance = this.services.get(service);
    if (!serviceInstance) {
      elizaLogger.error(`Service ${service} not found`);
      return null;
    }
    return serviceInstance;
  }
  async registerService(service) {
    const serviceType = service.serviceType;
    elizaLogger.log("Registering service:", serviceType);
    if (this.services.has(serviceType)) {
      elizaLogger.warn(
        `Service ${serviceType} is already registered. Skipping registration.`
      );
      return;
    }
    this.services.set(serviceType, service);
    elizaLogger.success(`Service ${serviceType} registered successfully`);
  }
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
  constructor(opts) {
    elizaLogger.info("Initializing AgentRuntime with options:", {
      character: opts.character?.name,
      modelProvider: opts.modelProvider,
      characterModelProvider: opts.character?.modelProvider
    });
    this.#conversationLength = opts.conversationLength ?? this.#conversationLength;
    this.databaseAdapter = opts.databaseAdapter;
    this.agentId = opts.character?.id ?? opts?.agentId ?? stringToUuid(opts.character?.name ?? uuidv4());
    this.character = opts.character || defaultCharacter;
    this.ensureRoomExists(this.agentId);
    this.ensureUserExists(
      this.agentId,
      this.character.name,
      this.character.name
    );
    this.ensureParticipantExists(this.agentId, this.agentId);
    elizaLogger.success("Agent ID", this.agentId);
    this.fetch = opts.fetch ?? this.fetch;
    if (!opts.databaseAdapter) {
      throw new Error("No database adapter provided");
    }
    this.cacheManager = opts.cacheManager;
    this.messageManager = new MemoryManager({
      runtime: this,
      tableName: "messages"
    });
    this.descriptionManager = new MemoryManager({
      runtime: this,
      tableName: "descriptions"
    });
    this.loreManager = new MemoryManager({
      runtime: this,
      tableName: "lore"
    });
    this.documentsManager = new MemoryManager({
      runtime: this,
      tableName: "documents"
    });
    this.knowledgeManager = new MemoryManager({
      runtime: this,
      tableName: "fragments"
    });
    (opts.managers ?? []).forEach((manager) => {
      this.registerMemoryManager(manager);
    });
    (opts.services ?? []).forEach((service) => {
      this.registerService(service);
    });
    this.serverUrl = opts.serverUrl ?? this.serverUrl;
    elizaLogger.info("Setting model provider...");
    elizaLogger.info("Model Provider Selection:", {
      characterModelProvider: this.character.modelProvider,
      optsModelProvider: opts.modelProvider,
      currentModelProvider: this.modelProvider,
      finalSelection: this.character.modelProvider ?? opts.modelProvider ?? this.modelProvider
    });
    this.modelProvider = this.character.modelProvider ?? opts.modelProvider ?? this.modelProvider;
    this.imageModelProvider = this.character.imageModelProvider ?? this.modelProvider;
    elizaLogger.info("Selected model provider:", this.modelProvider);
    elizaLogger.info(
      "Selected image model provider:",
      this.imageModelProvider
    );
    if (!Object.values(ModelProviderName).includes(this.modelProvider)) {
      elizaLogger.error("Invalid model provider:", this.modelProvider);
      elizaLogger.error(
        "Available providers:",
        Object.values(ModelProviderName)
      );
      throw new Error(`Invalid model provider: ${this.modelProvider}`);
    }
    if (!this.serverUrl) {
      elizaLogger.warn("No serverUrl provided, defaulting to localhost");
    }
    this.token = opts.token;
    this.plugins = [
      ...opts.character?.plugins ?? [],
      ...opts.plugins ?? []
    ];
    this.plugins.forEach((plugin) => {
      plugin.actions?.forEach((action) => {
        this.registerAction(action);
      });
      plugin.evaluators?.forEach((evaluator) => {
        this.registerEvaluator(evaluator);
      });
      plugin.services?.forEach((service) => {
        this.registerService(service);
      });
      plugin.providers?.forEach((provider) => {
        this.registerContextProvider(provider);
      });
    });
    (opts.actions ?? []).forEach((action) => {
      this.registerAction(action);
    });
    (opts.providers ?? []).forEach((provider) => {
      this.registerContextProvider(provider);
    });
    (opts.evaluators ?? []).forEach((evaluator) => {
      this.registerEvaluator(evaluator);
    });
  }
  async initialize() {
    for (const [serviceType, service] of this.services.entries()) {
      try {
        await service.initialize(this);
        this.services.set(serviceType, service);
        elizaLogger.success(
          `Service ${serviceType} initialized successfully`
        );
      } catch (error) {
        elizaLogger.error(
          `Failed to initialize service ${serviceType}:`,
          error
        );
        throw error;
      }
    }
    for (const plugin of this.plugins) {
      if (plugin.services)
        await Promise.all(
          plugin.services?.map((service) => service.initialize(this))
        );
    }
    if (this.character && this.character.knowledge && this.character.knowledge.length > 0) {
      await this.processCharacterKnowledge(this.character.knowledge);
    }
  }
  /**
   * Processes character knowledge by creating document memories and fragment memories.
   * This function takes an array of knowledge items, creates a document memory for each item if it doesn't exist,
   * then chunks the content into fragments, embeds each fragment, and creates fragment memories.
   * @param knowledge An array of knowledge items containing id, path, and content.
   */
  async processCharacterKnowledge(items) {
    for (const item of items) {
      const knowledgeId = stringToUuid(item);
      const existingDocument = await this.documentsManager.getMemoryById(knowledgeId);
      if (existingDocument) {
        continue;
      }
      elizaLogger.info(
        "Processing knowledge for ",
        this.character.name,
        " - ",
        item.slice(0, 100)
      );
      await knowledge_default.set(this, {
        id: knowledgeId,
        content: {
          text: item
        }
      });
    }
  }
  getSetting(key) {
    if (this.character.settings?.secrets?.[key]) {
      return this.character.settings.secrets[key];
    }
    if (this.character.settings?.[key]) {
      return this.character.settings[key];
    }
    if (settings_default[key]) {
      return settings_default[key];
    }
    return null;
  }
  /**
   * Get the number of messages that are kept in the conversation buffer.
   * @returns The number of recent messages to be kept in memory.
   */
  getConversationLength() {
    return this.#conversationLength;
  }
  /**
   * Register an action for the agent to perform.
   * @param action The action to register.
   */
  registerAction(action) {
    elizaLogger.success(`Registering action: ${action.name}`);
    this.actions.push(action);
  }
  /**
   * Register an evaluator to assess and guide the agent's responses.
   * @param evaluator The evaluator to register.
   */
  registerEvaluator(evaluator) {
    this.evaluators.push(evaluator);
  }
  /**
   * Register a context provider to provide context for message generation.
   * @param provider The context provider to register.
   */
  registerContextProvider(provider) {
    this.providers.push(provider);
  }
  /**
   * Process the actions of a message.
   * @param message The message to process.
   * @param content The content of the message to process actions from.
   */
  async processActions(message, responses, state, callback) {
    if (!responses[0].content?.action) {
      elizaLogger.warn("No action found in the response content.");
      return;
    }
    const normalizedAction = responses[0].content.action.toLowerCase().replace("_", "");
    elizaLogger.success(`Normalized action: ${normalizedAction}`);
    let action = this.actions.find(
      (a) => a.name.toLowerCase().replace("_", "").includes(normalizedAction) || normalizedAction.includes(a.name.toLowerCase().replace("_", ""))
    );
    if (!action) {
      elizaLogger.info("Attempting to find action in similes.");
      for (const _action of this.actions) {
        const simileAction = _action.similes.find(
          (simile) => simile.toLowerCase().replace("_", "").includes(normalizedAction) || normalizedAction.includes(
            simile.toLowerCase().replace("_", "")
          )
        );
        if (simileAction) {
          action = _action;
          elizaLogger.success(
            `Action found in similes: ${action.name}`
          );
          break;
        }
      }
    }
    if (!action) {
      elizaLogger.error(
        "No action found for",
        responses[0].content.action
      );
      return;
    }
    if (!action.handler) {
      elizaLogger.error(`Action ${action.name} has no handler.`);
      return;
    }
    try {
      elizaLogger.info(`Executing handler for action: ${action.name}`);
      await action.handler(this, message, state, {}, callback);
    } catch (error) {
      elizaLogger.error(error);
    }
  }
  /**
   * Evaluate the message and state using the registered evaluators.
   * @param message The message to evaluate.
   * @param state The state of the agent.
   * @param didRespond Whether the agent responded to the message.
   * @returns The results of the evaluation.
   */
  async evaluate(message, state, didRespond) {
    const evaluatorPromises = this.evaluators.map(
      async (evaluator) => {
        elizaLogger.log("Evaluating", evaluator.name);
        if (!evaluator.handler) {
          return null;
        }
        if (!didRespond && !evaluator.alwaysRun) {
          return null;
        }
        const result2 = await evaluator.validate(this, message, state);
        if (result2) {
          return evaluator;
        }
        return null;
      }
    );
    const resolvedEvaluators = await Promise.all(evaluatorPromises);
    const evaluatorsData = resolvedEvaluators.filter(Boolean);
    if (evaluatorsData.length === 0) {
      return [];
    }
    const evaluators = formatEvaluators(evaluatorsData);
    const evaluatorNames = formatEvaluatorNames(
      evaluatorsData
    );
    const context = composeContext({
      state: {
        ...state,
        evaluators,
        evaluatorNames
      },
      template: this.character.templates?.evaluationTemplate || evaluationTemplate
    });
    const result = await generateText({
      runtime: this,
      context,
      modelClass: "small" /* SMALL */
    });
    const parsedResult = parseJsonArrayFromText(
      result
    );
    this.evaluators.filter(
      (evaluator) => parsedResult?.includes(evaluator.name)
    ).forEach((evaluator) => {
      if (!evaluator?.handler) return;
      evaluator.handler(this, message);
    });
    return parsedResult;
  }
  /**
   * Ensure the existence of a participant in the room. If the participant does not exist, they are added to the room.
   * @param userId - The user ID to ensure the existence of.
   * @throws An error if the participant cannot be added.
   */
  async ensureParticipantExists(userId, roomId) {
    const participants = await this.databaseAdapter.getParticipantsForAccount(userId);
    if (participants?.length === 0) {
      await this.databaseAdapter.addParticipant(userId, roomId);
    }
  }
  /**
   * Ensure the existence of a user in the database. If the user does not exist, they are added to the database.
   * @param userId - The user ID to ensure the existence of.
   * @param userName - The user name to ensure the existence of.
   * @returns
   */
  async ensureUserExists(userId, userName, name, email, source) {
    const account = await this.databaseAdapter.getAccountById(userId);
    if (!account) {
      await this.databaseAdapter.createAccount({
        id: userId,
        name: name || userName || "Unknown User",
        username: userName || name || "Unknown",
        email: email || (userName || "Bot") + "@" + source || "Unknown",
        // Temporary
        details: { summary: "" }
      });
      elizaLogger.success(`User ${userName} created successfully.`);
    }
  }
  async ensureParticipantInRoom(userId, roomId) {
    const participants = await this.databaseAdapter.getParticipantsForRoom(roomId);
    if (!participants.includes(userId)) {
      await this.databaseAdapter.addParticipant(userId, roomId);
      if (userId === this.agentId) {
        elizaLogger.log(
          `Agent ${this.character.name} linked to room ${roomId} successfully.`
        );
      } else {
        elizaLogger.log(
          `User ${userId} linked to room ${roomId} successfully.`
        );
      }
    }
  }
  async ensureConnection(userId, roomId, userName, userScreenName, source) {
    await Promise.all([
      this.ensureUserExists(
        this.agentId,
        this.character.name ?? "Agent",
        this.character.name ?? "Agent",
        source
      ),
      this.ensureUserExists(
        userId,
        userName ?? "User" + userId,
        userScreenName ?? "User" + userId,
        source
      ),
      this.ensureRoomExists(roomId)
    ]);
    await Promise.all([
      this.ensureParticipantInRoom(userId, roomId),
      this.ensureParticipantInRoom(this.agentId, roomId)
    ]);
  }
  /**
   * Ensure the existence of a room between the agent and a user. If no room exists, a new room is created and the user
   * and agent are added as participants. The room ID is returned.
   * @param userId - The user ID to create a room with.
   * @returns The room ID of the room between the agent and the user.
   * @throws An error if the room cannot be created.
   */
  async ensureRoomExists(roomId) {
    const room = await this.databaseAdapter.getRoom(roomId);
    if (!room) {
      await this.databaseAdapter.createRoom(roomId);
      elizaLogger.log(`Room ${roomId} created successfully.`);
    }
  }
  /**
   * Compose the state of the agent into an object that can be passed or used for response generation.
   * @param message The message to compose the state from.
   * @returns The state of the agent.
   */
  async composeState(message, additionalKeys = {}) {
    const { userId, roomId } = message;
    const conversationLength = this.getConversationLength();
    const [actorsData, recentMessagesData, goalsData] = await Promise.all([
      getActorDetails({ runtime: this, roomId }),
      this.messageManager.getMemories({
        roomId,
        count: conversationLength,
        unique: false
      }),
      getGoals({
        runtime: this,
        count: 10,
        onlyInProgress: false,
        roomId
      })
    ]);
    const goals = formatGoalsAsString({ goals: goalsData });
    const actors = formatActors({ actors: actorsData ?? [] });
    const recentMessages = formatMessages({
      messages: recentMessagesData,
      actors: actorsData
    });
    const recentPosts = formatPosts({
      messages: recentMessagesData,
      actors: actorsData,
      conversationHeader: false
    });
    const senderName = actorsData?.find(
      (actor) => actor.id === userId
    )?.name;
    const agentName = actorsData?.find((actor) => actor.id === this.agentId)?.name || this.character.name;
    let allAttachments = message.content.attachments || [];
    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );
      if (lastMessageWithAttachment) {
        const lastMessageTime = lastMessageWithAttachment.createdAt;
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1e3;
        allAttachments = recentMessagesData.reverse().map((msg) => {
          const msgTime = msg.createdAt ?? Date.now();
          const isWithinTime = msgTime >= oneHourBeforeLastMessage;
          const attachments = msg.content.attachments || [];
          if (!isWithinTime) {
            attachments.forEach((attachment) => {
              attachment.text = "[Hidden]";
            });
          }
          return attachments;
        }).flat();
      }
    }
    const formattedAttachments = allAttachments.map(
      (attachment) => `ID: ${attachment.id}
Name: ${attachment.title}
URL: ${attachment.url}
Type: ${attachment.source}
Description: ${attachment.description}
Text: ${attachment.text}
  `
    ).join("\n");
    let lore = "";
    if (this.character.lore && this.character.lore.length > 0) {
      const shuffledLore = [...this.character.lore].sort(
        () => Math.random() - 0.5
      );
      const selectedLore = shuffledLore.slice(0, 10);
      lore = selectedLore.join("\n");
    }
    const formattedCharacterPostExamples = this.character.postExamples.sort(() => 0.5 - Math.random()).map((post) => {
      const messageString = `${post}`;
      return messageString;
    }).slice(0, 50).join("\n");
    const formattedCharacterMessageExamples = this.character.messageExamples.sort(() => 0.5 - Math.random()).slice(0, 5).map((example) => {
      const exampleNames = Array.from(
        { length: 5 },
        () => uniqueNamesGenerator3({ dictionaries: [names3] })
      );
      return example.map((message2) => {
        let messageString = `${message2.user}: ${message2.content.text}`;
        exampleNames.forEach((name, index) => {
          const placeholder = `{{user${index + 1}}}`;
          messageString = messageString.replaceAll(
            placeholder,
            name
          );
        });
        return messageString;
      }).join("\n");
    }).join("\n\n");
    const getRecentInteractions = async (userA, userB) => {
      const rooms = await this.databaseAdapter.getRoomsForParticipants([
        userA,
        userB
      ]);
      const existingMemories = await this.messageManager.getMemoriesByRoomIds({
        // filter out the current room id from rooms
        roomIds: rooms.filter((room) => room !== roomId)
      });
      existingMemories.sort((a, b) => b.createdAt - a.createdAt);
      const recentInteractionsData = existingMemories.slice(0, 20);
      return recentInteractionsData;
    };
    const recentInteractions = userId !== this.agentId ? await getRecentInteractions(userId, this.agentId) : [];
    const getRecentMessageInteractions = async (recentInteractionsData) => {
      const formattedInteractions = await Promise.all(
        recentInteractionsData.map(async (message2) => {
          const isSelf = message2.userId === this.agentId;
          let sender;
          if (isSelf) {
            sender = this.character.name;
          } else {
            const accountId = await this.databaseAdapter.getAccountById(
              message2.userId
            );
            sender = accountId?.username || "unknown";
          }
          return `${sender}: ${message2.content.text}`;
        })
      );
      return formattedInteractions.join("\n");
    };
    const formattedMessageInteractions = await getRecentMessageInteractions(recentInteractions);
    const getRecentPostInteractions = async (recentInteractionsData, actors2) => {
      const formattedInteractions = formatPosts({
        messages: recentInteractionsData,
        actors: actors2,
        conversationHeader: true
      });
      return formattedInteractions;
    };
    const formattedPostInteractions = await getRecentPostInteractions(
      recentInteractions,
      actorsData
    );
    let bio = this.character.bio || "";
    if (Array.isArray(bio)) {
      bio = bio.sort(() => 0.5 - Math.random()).slice(0, 3).join(" ");
    }
    const knowledegeData = await knowledge_default.get(this, message);
    const formattedKnowledge = formatKnowledge(knowledegeData);
    const initialState = {
      agentId: this.agentId,
      agentName,
      bio,
      lore,
      adjective: this.character.adjectives && this.character.adjectives.length > 0 ? this.character.adjectives[Math.floor(
        Math.random() * this.character.adjectives.length
      )] : "",
      knowledge: formattedKnowledge,
      knowledgeData: knowledegeData,
      // Recent interactions between the sender and receiver, formatted as messages
      recentMessageInteractions: formattedMessageInteractions,
      // Recent interactions between the sender and receiver, formatted as posts
      recentPostInteractions: formattedPostInteractions,
      // Raw memory[] array of interactions
      recentInteractionsData: recentInteractions,
      // randomly pick one topic
      topic: this.character.topics && this.character.topics.length > 0 ? this.character.topics[Math.floor(
        Math.random() * this.character.topics.length
      )] : null,
      topics: this.character.topics && this.character.topics.length > 0 ? `${this.character.name} is interested in ` + this.character.topics.sort(() => 0.5 - Math.random()).slice(0, 5).map((topic, index) => {
        if (index === this.character.topics.length - 2) {
          return topic + " and ";
        }
        if (index === this.character.topics.length - 1) {
          return topic;
        }
        return topic + ", ";
      }).join("") : "",
      characterPostExamples: formattedCharacterPostExamples && formattedCharacterPostExamples.replaceAll("\n", "").length > 0 ? addHeader(
        `# Example Posts for ${this.character.name}`,
        formattedCharacterPostExamples
      ) : "",
      characterMessageExamples: formattedCharacterMessageExamples && formattedCharacterMessageExamples.replaceAll("\n", "").length > 0 ? addHeader(
        `# Example Conversations for ${this.character.name}`,
        formattedCharacterMessageExamples
      ) : "",
      messageDirections: this.character?.style?.all?.length > 0 || this.character?.style?.chat.length > 0 ? addHeader(
        "# Message Directions for " + this.character.name,
        (() => {
          const all = this.character?.style?.all || [];
          const chat = this.character?.style?.chat || [];
          return [...all, ...chat].join("\n");
        })()
      ) : "",
      postDirections: this.character?.style?.all?.length > 0 || this.character?.style?.post.length > 0 ? addHeader(
        "# Post Directions for " + this.character.name,
        (() => {
          const all = this.character?.style?.all || [];
          const post = this.character?.style?.post || [];
          return [...all, ...post].join("\n");
        })()
      ) : "",
      //old logic left in for reference
      //food for thought. how could we dynamically decide what parts of the character to add to the prompt other than random? rag? prompt the llm to decide?
      /*
      postDirections:
          this.character?.style?.all?.length > 0 ||
          this.character?.style?.post.length > 0
              ? addHeader(
                      "# Post Directions for " + this.character.name,
                      (() => {
                          const all = this.character?.style?.all || [];
                          const post = this.character?.style?.post || [];
                          const shuffled = [...all, ...post].sort(
                              () => 0.5 - Math.random()
                          );
                          return shuffled
                              .slice(0, conversationLength / 2)
                              .join("\n");
                      })()
                  )
              : "",*/
      // Agent runtime stuff
      senderName,
      actors: actors && actors.length > 0 ? addHeader("# Actors", actors) : "",
      actorsData,
      roomId,
      goals: goals && goals.length > 0 ? addHeader(
        "# Goals\n{{agentName}} should prioritize accomplishing the objectives that are in progress.",
        goals
      ) : "",
      goalsData,
      recentMessages: recentMessages && recentMessages.length > 0 ? addHeader("# Conversation Messages", recentMessages) : "",
      recentPosts: recentPosts && recentPosts.length > 0 ? addHeader("# Posts in Thread", recentPosts) : "",
      recentMessagesData,
      attachments: formattedAttachments && formattedAttachments.length > 0 ? addHeader("# Attachments", formattedAttachments) : "",
      ...additionalKeys
    };
    const actionPromises = this.actions.map(async (action) => {
      const result = await action.validate(this, message, initialState);
      if (result) {
        return action;
      }
      return null;
    });
    const evaluatorPromises = this.evaluators.map(async (evaluator) => {
      const result = await evaluator.validate(
        this,
        message,
        initialState
      );
      if (result) {
        return evaluator;
      }
      return null;
    });
    const [resolvedEvaluators, resolvedActions, providers] = await Promise.all([
      Promise.all(evaluatorPromises),
      Promise.all(actionPromises),
      getProviders(this, message, initialState)
    ]);
    const evaluatorsData = resolvedEvaluators.filter(
      Boolean
    );
    const actionsData = resolvedActions.filter(Boolean);
    const actionState = {
      actionNames: "Possible response actions: " + formatActionNames(actionsData),
      actions: actionsData.length > 0 ? addHeader(
        "# Available Actions",
        formatActions(actionsData)
      ) : "",
      actionExamples: actionsData.length > 0 ? addHeader(
        "# Action Examples",
        composeActionExamples(actionsData, 10)
      ) : "",
      evaluatorsData,
      evaluators: evaluatorsData.length > 0 ? formatEvaluators(evaluatorsData) : "",
      evaluatorNames: evaluatorsData.length > 0 ? formatEvaluatorNames(evaluatorsData) : "",
      evaluatorExamples: evaluatorsData.length > 0 ? formatEvaluatorExamples(evaluatorsData) : "",
      providers: addHeader(
        `# Additional Information About ${this.character.name} and The World`,
        providers
      )
    };
    return { ...initialState, ...actionState };
  }
  async updateRecentMessageState(state) {
    const conversationLength = this.getConversationLength();
    const recentMessagesData = await this.messageManager.getMemories({
      roomId: state.roomId,
      count: conversationLength,
      unique: false
    });
    const recentMessages = formatMessages({
      actors: state.actorsData ?? [],
      messages: recentMessagesData.map((memory) => {
        const newMemory = { ...memory };
        delete newMemory.embedding;
        return newMemory;
      })
    });
    let allAttachments = [];
    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );
      if (lastMessageWithAttachment) {
        const lastMessageTime = lastMessageWithAttachment.createdAt;
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1e3;
        allAttachments = recentMessagesData.filter((msg) => {
          const msgTime = msg.createdAt;
          return msgTime >= oneHourBeforeLastMessage;
        }).flatMap((msg) => msg.content.attachments || []);
      }
    }
    const formattedAttachments = allAttachments.map(
      (attachment) => `ID: ${attachment.id}
Name: ${attachment.title}
URL: ${attachment.url}
Type: ${attachment.source}
Description: ${attachment.description}
Text: ${attachment.text}
    `
    ).join("\n");
    return {
      ...state,
      recentMessages: addHeader(
        "# Conversation Messages",
        recentMessages
      ),
      recentMessagesData,
      attachments: formattedAttachments
    };
  }
};
var formatKnowledge = (knowledge) => {
  return knowledge.map((knowledge2) => `- ${knowledge2.content.text}`).join("\n");
};

// src/enviroment.ts
import { z } from "zod";
var envSchema = z.object({
  // API Keys with specific formats
  OPENAI_API_KEY: z.string().startsWith("sk-", "OpenAI API key must start with 'sk-'"),
  REDPILL_API_KEY: z.string().min(1, "REDPILL API key is required"),
  GROK_API_KEY: z.string().min(1, "GROK API key is required"),
  GROQ_API_KEY: z.string().startsWith("gsk_", "GROQ API key must start with 'gsk_'"),
  OPENROUTER_API_KEY: z.string().min(1, "OpenRouter API key is required"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "Gemini API key is required"),
  ELEVENLABS_XI_API_KEY: z.string().min(1, "ElevenLabs API key is required")
});
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path}: ${err.message}`).join("\n");
      throw new Error(`Environment validation failed:
${errorMessages}`);
    }
    throw error;
  }
}
var MessageExampleSchema = z.object({
  user: z.string(),
  content: z.object({
    text: z.string(),
    action: z.string().optional(),
    source: z.string().optional(),
    url: z.string().optional(),
    inReplyTo: z.string().uuid().optional(),
    attachments: z.array(z.any()).optional()
  }).and(z.record(z.string(), z.unknown()))
  // For additional properties
});
var PluginSchema = z.object({
  name: z.string(),
  description: z.string(),
  actions: z.array(z.any()).optional(),
  providers: z.array(z.any()).optional(),
  evaluators: z.array(z.any()).optional(),
  services: z.array(z.any()).optional(),
  clients: z.array(z.any()).optional()
});
var CharacterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  system: z.string().optional(),
  modelProvider: z.nativeEnum(ModelProviderName),
  modelEndpointOverride: z.string().optional(),
  templates: z.record(z.string()).optional(),
  bio: z.union([z.string(), z.array(z.string())]),
  lore: z.array(z.string()),
  messageExamples: z.array(z.array(MessageExampleSchema)),
  postExamples: z.array(z.string()),
  topics: z.array(z.string()),
  adjectives: z.array(z.string()),
  knowledge: z.array(z.string()).optional(),
  clients: z.array(z.nativeEnum(Clients)),
  plugins: z.array(PluginSchema),
  settings: z.object({
    secrets: z.record(z.string()).optional(),
    voice: z.object({
      model: z.string().optional(),
      url: z.string().optional()
    }).optional(),
    model: z.string().optional(),
    embeddingModel: z.string().optional()
  }).optional(),
  clientConfig: z.object({
    discord: z.object({
      shouldIgnoreBotMessages: z.boolean().optional(),
      shouldIgnoreDirectMessages: z.boolean().optional()
    }).optional(),
    telegram: z.object({
      shouldIgnoreBotMessages: z.boolean().optional(),
      shouldIgnoreDirectMessages: z.boolean().optional()
    }).optional()
  }).optional(),
  style: z.object({
    all: z.array(z.string()),
    chat: z.array(z.string()),
    post: z.array(z.string())
  }),
  twitterProfile: z.object({
    username: z.string(),
    screenName: z.string(),
    bio: z.string(),
    nicknames: z.array(z.string()).optional()
  }).optional()
});
function validateCharacterConfig(json) {
  try {
    return CharacterSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(
        `Character configuration validation failed:
${errorMessages}`
      );
    }
    throw error;
  }
}

// src/cache.ts
import path4 from "path";
import fs2 from "fs/promises";
var MemoryCacheAdapter = class {
  data;
  constructor(initalData) {
    this.data = initalData ?? /* @__PURE__ */ new Map();
  }
  async get(key) {
    return this.data.get(key);
  }
  async set(key, value) {
    this.data.set(key, value);
  }
  async delete(key) {
    this.data.delete(key);
  }
};
var FsCacheAdapter = class {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }
  async get(key) {
    try {
      return await fs2.readFile(path4.join(this.dataDir, key), "utf8");
    } catch {
      return void 0;
    }
  }
  async set(key, value) {
    try {
      const filePath = path4.join(this.dataDir, key);
      await fs2.mkdir(path4.dirname(filePath), { recursive: true });
      await fs2.writeFile(filePath, value, "utf8");
    } catch (error) {
      console.error(error);
    }
  }
  async delete(key) {
    try {
      const filePath = path4.join(this.dataDir, key);
      await fs2.unlink(filePath);
    } catch {
    }
  }
};
var DbCacheAdapter = class {
  constructor(db, agentId) {
    this.db = db;
    this.agentId = agentId;
  }
  async get(key) {
    return this.db.getCache({ agentId: this.agentId, key });
  }
  async set(key, value) {
    await this.db.setCache({ agentId: this.agentId, key, value });
  }
  async delete(key) {
    await this.db.deleteCache({ agentId: this.agentId, key });
  }
};
var CacheManager = class {
  adapter;
  constructor(adapter) {
    this.adapter = adapter;
  }
  async get(key) {
    const data = await this.adapter.get(key);
    if (data) {
      const { value, expires } = JSON.parse(data);
      if (!expires || expires > Date.now()) {
        return value;
      }
      this.adapter.delete(key).catch(() => {
      });
    }
    return void 0;
  }
  async set(key, value, opts) {
    return this.adapter.set(
      key,
      JSON.stringify({ value, expires: opts?.expires ?? 0 })
    );
  }
  async delete(key) {
    return this.adapter.delete(key);
  }
};
export {
  AgentRuntime,
  CacheManager,
  CharacterSchema,
  Clients,
  DatabaseAdapter,
  DbCacheAdapter,
  FsCacheAdapter,
  GoalStatus,
  LoggingLevel,
  MemoryCacheAdapter,
  MemoryManager,
  ModelClass,
  ModelProviderName,
  Service,
  ServiceType,
  addHeader,
  booleanFooter,
  composeActionExamples,
  composeContext,
  configureSettings,
  createGoal,
  createRelationship,
  defaultCharacter,
  elizaLogger,
  embed,
  envSchema,
  evaluationTemplate,
  findNearestEnvFile,
  formatActionNames,
  formatActions,
  formatActors,
  formatEvaluatorExampleDescriptions,
  formatEvaluatorExamples,
  formatEvaluatorNames,
  formatEvaluators,
  formatGoalsAsString,
  formatMessages,
  formatPosts,
  formatRelationships,
  formatTimestamp,
  generateCaption,
  generateImage,
  generateMessageResponse,
  generateObject,
  generateObjectArray,
  generateObjectV2,
  generateShouldRespond,
  generateText,
  generateTextArray,
  generateTrueOrFalse,
  generateWebSearch,
  getActorDetails,
  getEmbeddingConfig,
  getEmbeddingType,
  getEmbeddingZeroVector,
  getEndpoint,
  getEnvVariable,
  getGoals,
  getModel,
  getProviders,
  getRelationship,
  getRelationships,
  handleProvider,
  hasEnvVariable,
  knowledge_default as knowledge,
  loadEnvConfig,
  messageCompletionFooter,
  models,
  parseBooleanFromText,
  parseJSONObjectFromText,
  parseJsonArrayFromText,
  parseShouldRespondFromText,
  settings,
  shouldRespondFooter,
  splitChunks,
  stringArrayFooter,
  stringToUuid,
  trimTokens,
  updateGoal,
  validateCharacterConfig,
  validateEnv
};
//# sourceMappingURL=index.js.map