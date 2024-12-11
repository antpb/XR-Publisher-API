// First step HTML - User enters username and current API key
export default async function generateRollKeyHTML() {
	const mainLogo = 'https://assets.pluginpublisher.com/main-logo.png';

	const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Roll API Key - Plugin Publisher</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link 
            href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" 
            rel="stylesheet"
            crossorigin="anonymous"
        >
        <style>
            body { background-color: #191919; color: white; }
            .roll-key-card { background: linear-gradient(to bottom right, #212020c9, #2c2c2cb5); }
            .lime-button { background: linear-gradient(to right, #a2ff00, #b3ef4a); color: black }
            .verification-steps { display: none; }
            .verification-steps.active { display: block; }
        </style>
        <script>
            let verificationToken = '';
            
		async function handleInitialSubmit(event) {
			event.preventDefault();
			
			const form = event.target;
			const submitButton = form.querySelector('button[type="submit"]');
			const errorDiv = document.getElementById('error-message');
			const successDiv = document.getElementById('success-message');
			const initialStep = document.getElementById('initial-step');
			const verificationStep = document.getElementById('verification-step');
			
			submitButton.disabled = true;
			errorDiv.textContent = '';
			successDiv.textContent = '';
			
			try {
				const response = await fetch('/initiate-key-roll', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						username: form.username.value,
						email: form.email.value
					})
				});
				
				const data = await response.json();
				
				if (!response.ok) {
					throw new Error(data.error || 'Failed to initiate key roll');
				}
				
				// Store verification token for later
				verificationToken = data.verificationToken;
				
				// Update verification instructions
				document.getElementById('verification-file-content').textContent = data.verificationContent;
				document.getElementById('verification-filename').textContent = data.verificationFilename;
				
				// Show verification step
				initialStep.classList.remove('active');
				verificationStep.classList.add('active');
				
			} catch (error) {
				errorDiv.textContent = error.message;
			} finally {
				submitButton.disabled = false;
			}
		}

            async function handleVerificationSubmit(event) {
                event.preventDefault();
                
                const form = event.target;
                const submitButton = form.querySelector('button[type="submit"]');
                const errorDiv = document.getElementById('error-message');
                const successDiv = document.getElementById('success-message');
                
                submitButton.disabled = true;
                errorDiv.textContent = '';
                successDiv.textContent = '';
                
                try {
                    const response = await fetch('/verify-key-roll', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            gistUrl: form.gist_url.value,
                            verificationToken: verificationToken
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to verify key roll');
                    }
                    
                    // Create config file content
                    const configContent = \`API_KEY=\${data.apiKey}
PLUGIN_API_URL=https://pluginpublisher.com
BUCKET_URL=https://assets.pluginpublisher.com\`;
                    
                    // Create and download config file
                    const blob = new Blob([configContent], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'plugin-publisher-config.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    successDiv.textContent = data.message;
                    form.reset();
                    
                } catch (error) {
                    errorDiv.textContent = error.message;
                } finally {
                    submitButton.disabled = false;
                }
            }
        </script>
    </head>
    <body>
        <div class="min-h-screen bg-gradient-to-r from-purple-500 to-purple-900 py-32 text-white">
            <div class="container mx-auto px-4">
                <div class="max-w-md mx-auto">
                    <div class="text-center mb-8">
                        <a href="/" class="inline-block">
                            <img src="${mainLogo}" alt="Logo" class="max-h-32 w-auto">
                        </a>
                    </div>
                    
                    <div class="roll-key-card rounded-lg shadow-xl p-8">
                        <h1 class="text-2xl font-bold mb-6 text-center">Roll API Key</h1>
                        <div class="mt-4 text-sm text-gray-400">
							<p>Note: You will need to have your GitHub username set in your account settings to use this feature. Contact an administrator if you need to update your GitHub username.</p>
						</div>
                        <!-- Initial Step -->
						<div id="initial-step" class="verification-steps active">
							<form onsubmit="handleInitialSubmit(event)" class="space-y-6" autocomplete="off">
								<div>
									<label for="username" class="block text-sm font-medium mb-2">Username</label>
									<input
										type="text"
										id="username"
										name="username"
										required
										class="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
										placeholder="Enter your username"
									>
								</div>
								
								<div>
									<label for="email" class="block text-sm font-medium mb-2">Email Address</label>
									<input
										type="email"
										id="email"
										name="email"
										required
										class="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
										placeholder="Enter your email address"
									>
								</div>
								
								<button
									type="submit"
									class="w-full lime-button font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
								>
									Start Key Roll Process
								</button>
							</form>
						</div>
                        <!-- Verification Step -->
                        <div id="verification-step" class="verification-steps">
                            <div class="mb-6">
                                <h2 class="text-lg font-semibold mb-4">Verify Your Identity</h2>
                                <ol class="list-decimal list-inside space-y-4">
                                    <li>Create a new public GitHub gist</li>
                                    <li>Name the file: <code id="verification-filename" class="bg-gray-800 px-2 py-1 rounded"></code></li>
                                    <li>Add this content:
                                        <pre id="verification-file-content" class="mt-2 bg-gray-800 p-3 rounded overflow-x-auto"></pre>
                                    </li>
                                    <li>Copy the gist URL and paste it below</li>
                                </ol>
                            </div>

                            <form onsubmit="handleVerificationSubmit(event)" class="space-y-6" autocomplete="off">
                                <div>
                                    <label for="gist_url" class="block text-sm font-medium mb-2">Gist URL</label>
                                    <input
                                        type="url"
                                        id="gist_url"
                                        name="gist_url"
                                        required
                                        class="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                                        placeholder="https://gist.github.com/yourusername/..."
                                    >
                                </div>
                                
                                <button
                                    type="submit"
                                    class="w-full lime-button font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                                >
                                    Verify and Generate New Key
                                </button>
                            </form>
                        </div>
                        
                        <div id="error-message" class="text-red-500 text-sm min-h-[20px] mt-4"></div>
                        <div id="success-message" class="text-green-500 text-sm min-h-[20px] mt-4"></div>
                    </div>
                    
                    <div class="text-center mt-6">
                        <a href="/" class="text-purple-400 hover:text-purple-300">Back to Home</a>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html',
		},
	});
}