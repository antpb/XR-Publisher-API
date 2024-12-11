import { createHeaderSearchBar } from './headerSearchBar';

export default async function generateHomeHTML(authors, env) {
    const mainLogo = 'https://xrpublisher.com/wp-content/uploads/2024/10/xrpublisher-logo-300x70.png';
    
    // Ensure authors is an array and has data
    const validAuthors = Array.isArray(authors) ? authors : [];
    console.log('Processing authors for homepage:', {
        authorCount: validAuthors.length,
        sampleAuthor: validAuthors[0] ? {
            username: validAuthors[0].username,
            worldCount: validAuthors[0].world_count,
            totalVisits: validAuthors[0].total_visits
        } : null
    });

    // Sort authors by activity (world count and visits)
    const sortedAuthors = [...validAuthors].sort((a, b) => {
        const visitsA = Number(a.total_visits) || 0;
        const visitsB = Number(b.total_visits) || 0;
        const worldsA = Number(a.world_count) || 0;
        const worldsB = Number(b.world_count) || 0;
        
        // First sort by world count, then by visits
        if (worldsA !== worldsB) return worldsB - worldsA;
        return visitsB - visitsA;
    });

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <head>
        <title>World Publisher - Discover Amazing Virtual Worlds</title>
        <link 
            href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" 
            rel="stylesheet"
            crossorigin="anonymous"
        >
        <style>
            body { background-color: #191919; color: white; }
            .asset-card-container-home { background: linear-gradient(to bottom right, #212020c9, #2c2c2cb5); }
            .hero-card-container { background: linear-gradient(to top left, #8e34d7c4, #30d3669b); }
            .authors-list-container { background: linear-gradient(to bottom right, #131313e8, #181818b5); }
        </style>
    </head>
    <body>
        <div class="min-h-screen bg-[#191919] text-white">
            ${createHeaderSearchBar()}
            
            <!-- Hero section -->
            <div class="bg-gradient-to-r from-purple-500 to-blue-500 py-32">
                <div class="container mx-auto px-4 text-center">
                    <a href="/" class="mr-4 justify-center flex items-center">
                        <img src="${mainLogo}" alt="Logo" style="max-height: 150px; width: auto; margin-bottom: 20px;">
                    </a>
                    <p class="text-xl mb-8">Explore virtual worlds created by talented builders across the metaverse.</p>
                    <div class="max-w-3xl mx-auto">
                        <form action="/directory/search" method="GET" class="flex gap-2" autocomplete="off">
                            <input 
                                type="text" 
                                name="q" 
                                placeholder="Search worlds..." 
                                class="flex-1 px-6 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                            >
                            <button 
                                type="submit"
                                class="block text-center bg-purple-600 text-white font-medium rounded-lg px-5 py-2.5"
                            >
                                Search
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Featured Creators Section -->
            <div class="container mx-auto px-4 py-16">
                <div class="authors-list-container rounded-3xl shadow-3xl p-8">
                    <h2 class="text-2xl font-bold mb-8">Featured Creators</h2>
                    ${sortedAuthors.length > 0 ? `
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            ${sortedAuthors.map(author => `
                                <div class="bg-gradient-to-br asset-card-container-home rounded-xl shadow-2xl p-6">
                                    <div class="flex items-center mb-6">
                                        <img 
                                            src="${author.avatar_url || '/images/default-avatar.jpg'}" 
                                            alt="${author.username}" 
                                            class="w-28 h-28 rounded-full object-cover"
                                        >
                                        <div class="ml-4">
                                            <h3 class="text-xl font-bold">${author.username}</h3>
                                            <p class="text-sm text-gray-300">Creator since ${new Date(author.created_at || Date.now()).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <p class="text-gray-300 mb-4 line-clamp-3">${author.bio || ''}</p>
                                    <div class="flex gap-4 mb-4">
                                        ${author.github ? `
                                            <a href="https://github.com/${author.github}" target="_blank" rel="noopener" class="text-purple-400 hover:text-purple-300">
                                                GitHub
                                            </a>
                                        ` : ''}
                                        ${author.twitter ? `
                                            <a href="https://twitter.com/${author.twitter}" target="_blank" rel="noopener" class="text-purple-400 hover:text-purple-300">
                                                Twitter
                                            </a>
                                        ` : ''}
                                        ${author.website ? `
                                            <a href="${author.website}" target="_blank" rel="noopener" class="text-purple-400 hover:text-purple-300">
                                                Website
                                            </a>
                                        ` : ''}
                                    </div>
                                    <div class="flex justify-between text-sm text-gray-400 mb-4">
                                        <span>${author.world_count || 0} worlds created</span>
                                        <span>${author.total_visits || 0} total visits</span>
                                    </div>
                                    <a href="/author/${author.username}" class="mt-4 block text-center bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl text-white font-medium rounded-lg px-5 py-2.5">
                                        View Worlds
                                    </a>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="text-center py-12">
                            <p class="text-xl text-gray-400">No creators found. Be the first to create a world!</p>
                            <a href="/register" class="mt-4 inline-block text-center bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl text-white font-medium rounded-lg px-5 py-2.5">
                                Get Started
                            </a>
                        </div>
                    `}
                </div>
            </div>

            <!-- Footer -->
            <div class="bg-black py-8">
                <div class="container mx-auto px-4 text-center text-gray-200">
                    <p>&copy; ${new Date().getFullYear()} World Publisher</p>
                    <p>
                        <a href="/terms" class="text-purple-400 hover:underline">Terms</a> | 
                        <a href="/privacy" class="text-purple-400 hover:underline">Privacy</a> |
                        <a href="https://github.com/your-repo" class="text-purple-400 hover:underline">
                            Source
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600'
        },
    });
}