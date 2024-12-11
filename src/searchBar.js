
const mainLogo = 'https://xrpublisher.com/wp-content/uploads/2024/10/xrpublisher-logo-300x70.png';
const logoMarkup = `<a href="/" class="mr-4"><img src="${mainLogo}" alt="Logo" class="max-h-8"></a>`;

export function createSearchBar(currentQuery = '', tags = [], request) {
	console.log("REQ", request);
	const safeQuery = currentQuery.replace(/[&<>"']/g, (match) => {
		const escape = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		};
		return escape[match];
	});

	const mainLogo = 'https://xrpublisher.com/wp-content/uploads/2024/10/xrpublisher-logo-300x70.png';
	const logoMarkup = `<a href="/" class="mr-4"><img src="${mainLogo}" alt="Logo" class="h-14"></a>`;

	return `
		  <div class="w-full mx-auto px-4 py-2">
			  <div class="w-full max-w-6xl mx-auto px-2 py-4 flex items-center">
				<form action="/directory/search" method="GET" class="relative flex-grow" autocomplete="off">
				<input 
					type="search" 
					name="q" 
					value="${safeQuery}"
					placeholder="Search worlds..."
					class="w-full px-4 py-2 rounded-lg bg-gray-800 text-md text-white border border-gray-700 focus:outline-none focus:border-purple-500"
				>
				<button 
					type="submit"
					class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">

					</svg>
				</button>
				</form>
				</div>
		  </div>
		`;
}