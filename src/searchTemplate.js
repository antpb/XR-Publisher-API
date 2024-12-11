import { createSearchBar } from './searchBar';
import { createHeaderSearchBar } from './headerSearchBar';
import { createSecureHtmlService } from './secureHtmlService';

export default async function generateSearchHTML(results, query = '', tags = [], offset = 0, limit = 20, env, request) {
    const secureHtmlService = createSecureHtmlService();
    const safeResults = results.map(world => ({
        ...world,
        preview_image: world.preview_image || '/images/default-preview.jpg',
        visit_count: world.visit_count || 0,
        active_users: world.active_users || 0
    }));
    
    const totalResults = results.length;
    const hasMore = totalResults === limit;
    const currentPage = Math.floor(offset / limit) + 1;

    const paginationSection = `
        <div class="mt-8 flex justify-between items-center">
            <div class="text-gray-400">
                Showing ${offset + 1}-${offset + safeResults.length} results
            </div>
            <div class="flex gap-2">
                ${offset > 0 ? `
                    <a href="/directory/search?q=${encodeURIComponent(query)}&offset=${offset - limit}&limit=${limit}${tags.map(tag => `&tag=${encodeURIComponent(tag)}`).join('')}"
                       class="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                        Previous
                    </a>
                ` : ''}
                ${hasMore ? `
                    <a href="/directory/search?q=${encodeURIComponent(query)}&offset=${offset + limit}&limit=${limit}${tags.map(tag => `&tag=${encodeURIComponent(tag)}`).join('')}"
                       class="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700">
                        Next
                    </a>
                ` : ''}
            </div>
        </div>
    `;

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Search Results ${query ? `for "${query}"` : ''} - World Directory</title>
            <link 
                href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" 
                rel="stylesheet"
                crossorigin="anonymous"
            >
            <script
                src="https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js"
                crossorigin="anonymous"
            ></script>
            <style>
                body { background-color: #191919; color: white; }
                .asset-card-container-home { background: linear-gradient(to bottom right, #212020c9, #2c2c2cb5); }
                .hero-card-container { background: linear-gradient(to top left, #8e34d7c4, #30d3669b); }
                .worlds-list-container { background: linear-gradient(to bottom right, #131313e8, #181818b5); }
                .preview-image { height: 200px; object-fit: cover; width: 100%; }
            </style>
        </head>
        <body>
            <div class="min-h-screen bg-[#191919] text-white">
                ${createHeaderSearchBar()}
                
                <!-- Hero section with search -->
                <div class="bg-gradient-to-r from-purple-500 to-blue-500 py-16">
                    <div class="container mx-auto px-4">
                        <h1 class="text-4xl font-bold text-center mb-8">
                            ${query
                                ? `Search Results for "${secureHtmlService.sanitizeText(query)}"`
                                : 'Explore Virtual Worlds'}
                        </h1>
                        <div class="max-w-3xl mx-auto">
                            <form action="/directory/search" method="GET" class="flex gap-2">
                                <input 
                                    type="text" 
                                    name="q" 
                                    value="${query}"
                                    placeholder="Search worlds..." 
                                    class="flex-1 px-6 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                                >
                                <button 
                                    type="submit"
                                    class="block text-center bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg px-5 py-2.5"
                                >
                                    Search
                                </button>
                            </form>
                        </div>
                        ${tags.length > 0 ? `
                            <div class="mt-4 flex flex-wrap justify-center gap-2">
                                ${tags.map(tag => `
                                    <span class="px-3 py-1 bg-purple-600 rounded-full text-sm">
                                        #${secureHtmlService.sanitizeText(tag)}
                                    </span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Results section -->
                <div class="container mx-auto px-4 py-8">
                    <div class="worlds-list-container rounded-3xl shadow-3xl p-8">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            ${safeResults.length > 0 ? safeResults.map(world => `
                                <div class="bg-gradient-to-br asset-card-container-home rounded-xl shadow-2xl transform flex flex-col overflow-hidden">
                                    <!-- Preview image -->
                                    <div class="w-full h-48 relative">
                                        <img src="${world.preview_image}" 
                                             alt="${world.name}" 
                                             class="w-full h-full object-cover"
                                             onerror="this.src='/images/default-preview.jpg'">
                                        <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                                            <h3 class="text-xl font-bold">${world.name}</h3>
                                            <p class="text-sm text-gray-300">by ${world.author}</p>
                                        </div>
                                    </div>
                                    
                                    <!-- Content section -->
                                    <div class="p-6 flex flex-col flex-grow">
                                        <p class="text-gray-200 mb-4 flex-grow">${world.short_description}</p>
                                        
                                        <div class="mt-auto">
                                            <div class="flex justify-between items-center mb-4">
                                                <div class="flex items-center gap-2">
                                                    <i data-feather="users" class="w-4 h-4 text-purple-400"></i>
                                                    <span class="text-sm">${world.active_users} active</span>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <i data-feather="eye" class="w-4 h-4 text-green-400"></i>
                                                    <span class="text-sm">${world.visit_count} visits</span>
                                                </div>
                                            </div>
                                            
                                            <div class="flex justify-between text-sm text-gray-400 mb-4">
                                                <span>Version ${world.version}</span>
                                                <span>Capacity: ${world.capacity}</span>
                                            </div>
                                            
                                            <a href="/directory/${world.author}/${world.slug}" 
                                               class="w-full bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center block">
                                                Enter World
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : `
                                <div class="col-span-3 text-center py-16">
                                    <h3 class="text-2xl font-bold text-gray-400">No worlds found</h3>
                                    <p class="text-gray-500 mt-2">Try adjusting your search terms</p>
                                </div>
                            `}
                        </div>
                        <!-- Pagination -->
                        ${paginationSection}
                    </div>
                </div>
            </div>
            <script>
                feather.replace();
            </script>
        </body>
        </html>
    `;

    return secureHtmlService.transformHTML(html);
}