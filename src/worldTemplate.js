import { createSecureHtmlService } from './secureHtmlService';
import { createHeaderSearchBar } from './headerSearchBar';

export default async function generateWorldHTML(worldData, env) {
    const secureHtmlService = createSecureHtmlService();
    
    const visitsKey = `visits:${worldData.author}:${worldData.slug}`;
    const visitCount = parseInt(await env.VISIT_COUNTS.get(visitsKey)) || 0;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>${worldData.name} by ${worldData.author}</title>
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
            .xr-publisher-load-world-button {
                background-color: #8000ab !important;
            }
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
                        <a href="/author/${worldData.author}" class="text-white hover:text-gray-200">
                            <img src="${worldData.authorData?.avatar_url || '/default-avatar.jpg'}" 
                                alt="${worldData.author}" 
                                class="w-10 h-10 rounded-full inline-block mr-2">
                            ${worldData.author}
                        </a>
                        <span class="text-white/80">presents</span>
                        <h1 class="text-xl font-bold">${worldData.name}</h1>
                        ${createHeaderSearchBar()}
                        <div class="flex items-center space-x-4 text-sm">
                            <span>👥 ${worldData.active_users || 0} Active</span>
                            <span>👁️ ${visitCount.toLocaleString()} Visits</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="world-container">
            <div id="world-view">
                ${worldData.html_content}
            </div>
        </div>

        <div class="container mx-auto px-4 py-8">
            <div class="bg-[#242424] rounded-lg p-6 shadow-lg">
                <h2 class="text-xl font-bold mb-4">About this World</h2>
                <p class="text-gray-300 mb-4">${worldData.short_description || ''}</p>
                
                ${worldData.long_description ? `
                    <div class="text-gray-300 mb-4">
                        ${worldData.long_description}
                    </div>
                ` : ''}
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
                    <div>
                        <span class="block font-medium">Version</span>
                        ${worldData.version}
                    </div>
                    <div>
                        <span class="block font-medium">Capacity</span>
                        ${worldData.capacity} users
                    </div>
                    <div>
                        <span class="block font-medium">Rating</span>
                        ${worldData.content_rating}
                    </div>
                    <div>
                        <span class="block font-medium">Created</span>
                        ${new Date(worldData.created_at).toLocaleDateString()}
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
                enableAI: false,
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