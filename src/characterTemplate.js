import { createSecureHtmlService } from './secureHtmlService';
import { createHeaderSearchBar } from './headerSearchBar';

export default async function generateCharacterHTML(characterData, env) {
    const secureHtmlService = createSecureHtmlService();
    const safeCharacter = secureHtmlService.sanitizeCharacterData(characterData);

    // Create a personality description that includes all the character data
    const personalityData = {
        name: safeCharacter.name,
        bio: safeCharacter.bio,
        lore: safeCharacter.lore,
        topics: safeCharacter.topics,
        style: safeCharacter.style,
        adjectives: safeCharacter.adjectives,
        messageExamples: safeCharacter.messageExamples,
        modelProvider: safeCharacter.modelProvider,
        settings: safeCharacter.settings
    };

    // Create a natural language description for the personality attribute
    const personalityText = `${safeCharacter.name} is ${safeCharacter.adjectives.join(', ')}. 
        ${safeCharacter.bio} 
        Background: ${safeCharacter.lore.join('. ')}
        They are knowledgeable about: ${safeCharacter.topics.join(', ')}.
        Communication style: ${safeCharacter.style.all.join(', ')}.
        When chatting they: ${safeCharacter.style.chat.join(', ')}.
        When posting they: ${safeCharacter.style.post.join(', ')}.`;
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>${safeCharacter.name} by ${safeCharacter.author}</title>
        <link 
            href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" 
            rel="stylesheet"
            crossorigin="anonymous"
        >
        <style>
            body { background-color: #191919; color: white; }
            .world-container { 
                background: linear-gradient(to bottom right, #131313, #181818);
                min-height: 80vh;
            }
            #world-view {
                width: 100%;
                height: 100%;
                min-height: 80vh;
            }
            .character-card-container { background: linear-gradient(to bottom right, #212020c9, #2c2c2cb5); }
            .hero-card-container { background: linear-gradient(to top left, #8e34d7c4, #30d3669b); }
        </style>
    </head>
    <body>
        <div class="absolute top-0 left-0 w-full z-10" style="pointer-events: none;">
            <div class="min-h-screen bg-[#191919] text-white">
                <div class="w-full mx-auto px-4 py-2 flex items-center justify-between">
                    <a href="/" class="mr-4">
                        <img src="/xrpublisher-logo-300x70.png" alt="Logo" class="h-8 inline-block" style="pointer-events: auto;">
                    </a>
                    <div class="flex items-center space-x-4">
                        <a href="/author/${safeCharacter.author}" class="text-white hover:text-gray-200">
                            <img src="${safeCharacter.authorData?.avatar_url || '/default-avatar.jpg'}" 
                                alt="${safeCharacter.author}" 
                                class="w-10 h-10 rounded-full inline-block mr-2">
                            ${safeCharacter.author}
                        </a>
                        <span class="text-white/80">presents</span>
                        <h1 class="text-xl font-bold">${safeCharacter.name}</h1>
                        ${createHeaderSearchBar()}
                    </div>
                </div>
            </div>
        </div>

        <div class="world-container">
            <div id="world-view">
                <three-environment-block class="wp-block-xr-publisher-environment alignfull" 
                    devicetarget="vr" 
                    threeobjecturl="https://items.sxp.digital/f8886983-a11b-4367-a19c-388662542d84/defaultfloor.glb" 
                    scale="1" 
                    positiony="-1" 
                    rotationy="0" 
                    animations="" 
                    camcollisions="1">
                    
                    <three-npc-block 
                        class="wp-block-xr-publisher-npc-block" 
                        threeobjecturl="${safeCharacter.vrmUrl || 'https://items.sxp.digital/f8886983-a11b-4367-a19c-388662542d84/xrpublisherdefaultavatar.vrm'}" 
                        positionx="0" 
                        positiony="-1" 
                        positionz="-2" 
                        rotationx="0" 
                        rotationy="0" 
                        rotationz="0" 
                        name="${safeCharacter.name}"
                        defaultmessage="Hello! I'm ${safeCharacter.name}. Feel free to chat with me about ${safeCharacter.topics.slice(0, 3).join(', ')}, or anything else!"
                        personality="${personalityText}"
                        metadata="${encodeURIComponent(JSON.stringify(personalityData))}"
                        objectawareness="0">
                    </three-npc-block>
                </three-environment-block>
            </div>
        </div>

        <div class="container mx-auto px-4 py-8">
            <div class="character-card-container rounded-lg p-6 shadow-lg">
                <h2 class="text-xl font-bold mb-4">About ${safeCharacter.name}</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                    <div>
                        <h3 class="text-lg font-semibold mb-2 text-purple-400">Background</h3>
                        <ul class="space-y-2">
                            ${safeCharacter.lore.map(item => 
                                `<li class="text-gray-300">• ${item}</li>`
                            ).join('')}
                        </ul>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-semibold mb-2 text-blue-400">Topics & Expertise</h3>
                        <div class="flex flex-wrap gap-2">
                            ${safeCharacter.topics.map(topic =>
                                `<span class="px-3 py-1 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full text-sm">
                                    ${topic}
                                </span>`
                            ).join('')}
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2 text-green-400">Personality Traits</h3>
                    <div class="flex flex-wrap gap-2">
                        ${safeCharacter.adjectives.map(adj =>
                            `<span class="px-3 py-1 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full text-sm">
                                ${adj}
                            </span>`
                        ).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-black py-8">
            <div class="container mx-auto px-4 text-center text-gray-400">
                <p>&copy; ${new Date().getFullYear()} World Publisher</p>
                <div class="mt-2">
                    <a href="/terms" class="text-purple-400 hover:underline mr-4">Terms</a>
                    <a href="/privacy" class="text-purple-400 hover:underline mr-4">Privacy</a>
                    <a href="https://github.com/your-repo" class="text-purple-400 hover:underline">GitHub</a>
                </div>
            </div>
        </div>

        <script src="https://builds.sxp.digital/xr-publisher.umd.js?${new Date().getTime()}"></script>
        <script>
        window.addEventListener('load', () => {
            console.log('Window loaded, initializing XRPublisher');
            const publisher = new XRPublisher({
                threeObjectPlugin: 'https://builds.sxp.digital/',
                defaultAvatarAnimation: '',
                defaultAvatar: 'https://items.sxp.digital/f8886983-a11b-4367-a19c-388662542d84/xrpublisherdefaultavatar.vrm',
                defaultEnvironment: 'https://builds.sxp.digital/assets/default_grid.glb',
                multiplayerAccess: 'loggedIn',
                camCollisions: true,
                enableAI: true,
                enableNetworking: false,
                enableVoiceChat: false
            });
            publisher.init();
        });
        </script>
    </body>
    </html>
    `;

    return secureHtmlService.transformHTML(html);
}