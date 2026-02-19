const API_URL = `${window.location.protocol}//${window.location.hostname}:3000`;

// ==========================================
// Create animated particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random size between 20px and 100px
        const size = Math.random() * 80 + 20;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        // Random animation delay and duration
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${Math.random() * 10 + 15}s`;

        // Random colors
        const colors = [
            'rgba(102, 126, 234, 0.4)',
            'rgba(118, 75, 162, 0.4)',
            'rgba(240, 147, 251, 0.4)',
            'rgba(79, 172, 254, 0.4)'
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;

        particlesContainer.appendChild(particle);
    }
}

// Initialize particles on load
createParticles();



async function checkServerHealth() {
    return;
    // Old code removed
}
/*
    try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) throw new Error('Health check failed');

        // Success: Hide Loader immediately
        console.log('✅ Server is connected');
        if (loader) {
            clearTimeout(loaderTimeout); // Clear the timeout since we are hiding now
            loader.classList.add('hidden');
            setTimeout(() => { loader.style.display = 'none'; }, 600);
        }
        hideStatus();

    } catch (e) {
        // Fail: Just log it, the timeout above will handle hiding the loader
        console.error('Connection pending...');
        if (loaderStatus) loaderStatus.textContent = "Connecting...";

        // Retry silently in background
    }
}
*/

// Get DOM elements
const videoInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const statusMessage = document.getElementById('statusMessage');
const videoPreview = document.getElementById('videoPreview');
const closePreview = document.getElementById('closePreview');
const previewContent = document.getElementById('previewContent');

// Notes elements

// Show/hide clear button
videoInput.addEventListener('input', () => {
    clearBtn.style.display = videoInput.value ? 'flex' : 'none';
});

// Handle Enter key for video download
videoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleDownload();
    }
});

// Clear input
clearBtn.addEventListener('click', () => {
    videoInput.value = '';
    clearBtn.style.display = 'none';
    hideStatus();
    hidePreview();
    videoInput.focus();
});

// Close preview
closePreview.addEventListener('click', hidePreview);

// Supported platforms and their patterns
const supportedPlatforms = {
    youtube: {
        name: 'YouTube',
        patterns: [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ],
        color: '#ff0000'
    },
    instagram: {
        name: 'Instagram',
        patterns: [
            /instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/,
            /instagram\.com\/stories\/([a-zA-Z0-9_.-]+)\/([0-9]+)/
        ],
        color: '#e4405f'
    },
    facebook: {
        name: 'Facebook',
        patterns: [
            /facebook\.com\/.*\/videos\/([0-9]+)/,
            /fb\.watch\/([a-zA-Z0-9_-]+)/,
            /facebook\.com\/watch\/\?v=([0-9]+)/,
            /facebook\.com\/share\/v\/([a-zA-Z0-9]+)/,
            /facebook\.com\/share\/([a-zA-Z0-9]+)/
        ],
        color: '#1877f2'
    },
    tiktok: {
        name: 'TikTok',
        patterns: [
            /tiktok\.com\/@([^\/]+)\/video\/([0-9]+)/,
            /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
            /vt\.tiktok\.com\/([a-zA-Z0-9]+)/
        ],
        color: '#000000'
    },
    twitter: {
        name: 'Twitter/X',
        patterns: [
            /twitter\.com\/.*\/status\/([0-9]+)/,
            /x\.com\/.*\/status\/([0-9]+)/
        ],
        color: '#1da1f2'
    },
    vimeo: {
        name: 'Vimeo',
        patterns: [
            /vimeo\.com\/([0-9]+)/,
            /player\.vimeo\.com\/video\/([0-9]+)/
        ],
        color: '#1ab7ea'
    },
    dailymotion: {
        name: 'Dailymotion',
        patterns: [
            /dailymotion\.com\/video\/([a-zA-Z0-9]+)/
        ],
        color: '#0066dc'
    },
    reddit: {
        name: 'Reddit',
        patterns: [
            /reddit\.com\/r\/.*\/comments\/([a-zA-Z0-9]+)/,
            /v\.redd\.it\/([a-zA-Z0-9]+)/
        ],
        color: '#ff4500'
    }
};

// Detect platform from URL
function detectPlatform(url) {
    for (const [platform, data] of Object.entries(supportedPlatforms)) {
        for (const pattern of data.patterns) {
            if (pattern.test(url)) {
                return { platform, ...data };
            }
        }
    }
    return null;
}

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
}

// Hide status message
function hideStatus() {
    statusMessage.style.display = 'none';
}

// Show preview
function showPreview(platform, url) {
    const html = `
        <div style="text-align: center;">
            <div style="display: inline-block; padding: 20px 40px; background: ${platform.color}20; border-radius: 16px; margin-bottom: 20px;">
                <h4 style="color: ${platform.color}; font-size: 18px; margin: 0;">
                    ${platform.name} Video Detected
                </h4>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 30px; word-break: break-all;">
                ${url}
            </p>
            <div style="background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="font-size: 16px; color: var(--text-secondary); margin-bottom: 20px;">
                    ⚠️ यह एक demo app है। असली video download करने के लिए, आपको backend API की जरूरत होगी।
                </p>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                    <strong>सुझाव:</strong> आप निम्नलिखित services का उपयोग कर सकते हैं:<br>
                    • <a href="https://github.com/yt-dlp/yt-dlp" target="_blank" style="color: #667eea;">yt-dlp</a> (YouTube और अन्य platforms के लिए)<br>
                    • <a href="https://rapidapi.com/" target="_blank" style="color: #667eea;">RapidAPI</a> (Social media downloaders)<br>
                    • अपना खुद का backend बनाएं Node.js/Python के साथ
                </p>
            </div>
        </div>
    `;

    previewContent.innerHTML = html;
    videoPreview.style.display = 'block';
}

// Hide preview
function hidePreview() {
    videoPreview.style.display = 'none';
}

// (Removed duplicate isValidUrl and API_URL)

// Language Toggle Logic
const langBtn = document.getElementById('langToggle');

if (langBtn) {
    // Check initial state from cookie
    if (document.cookie.includes('googtrans=/hi/en')) {
        langBtn.textContent = 'English';
    } else {
        langBtn.textContent = 'Hindi';
    }

    langBtn.addEventListener('click', () => {
        const currentLang = langBtn.textContent;

        // Clear previous cookies to avoid conflicts
        document.cookie = 'googtrans=; path=/; domain=' + document.domain + '; expires=' + new Date(0).toUTCString();
        document.cookie = 'googtrans=; path=/; expires=' + new Date(0).toUTCString();

        if (currentLang === 'English') {
            // User wants Hindi (Original)
            document.cookie = "googtrans=/hi/hi; path=/";
            langBtn.textContent = 'Hindi';
        } else {
            // User wants English (Translated)
            document.cookie = "googtrans=/hi/en; path=/";
            langBtn.textContent = 'English';
        }
        window.location.reload(); // Reload to apply translation
    });
}

// Note: Tab switching removed as HTML only has static tabs for visual symmetry

// Generate Notes
const generateNotesBtn = document.getElementById('generateNotesBtn');
const notesUrlInput = document.getElementById('notesUrl');
const notesResult = document.getElementById('notesResult');
const notesText = document.getElementById('notesText');

if (generateNotesBtn) {
    // Clear old notes when returning to main page
    sessionStorage.removeItem('generatedNotes');

    generateNotesBtn.addEventListener('click', async (e) => {
        if (e) e.preventDefault();
        // Auto-fill from main input if empty
        if (!notesUrlInput.value.trim() && videoInput.value.trim()) {
            notesUrlInput.value = videoInput.value.trim();
        }

        const url = notesUrlInput.value.trim();

        if (!url) {
            showStatus('Please paste a video URL', 'error');
            return;
        }

        generateNotesBtn.disabled = true;
        generateNotesBtn.innerHTML = '<span>⏳ Generating Notes...</span>';

        // Clear previous notes to prevent cache issues
        notesText.innerHTML = '';
        notesResult.style.display = 'none';
        window.notesEn = null;
        window.notesHi = null;

        try {
            // Handle URL
            const response = await fetch(`${API_URL}/api/generate-notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });


            const data = await response.json();

            if (data.success) {
                // Open notes in new window
                openNotesInNewWindow(data.notes, url);

                showStatus('Notes opened in new window!', 'success');
            } else {
                // Show detailed error if available
                const errorMsg = data.error || data.notes || 'Failed to generate notes.';
                showStatus(errorMsg, 'error');
            }
        } catch (error) {
            console.error('Frontend Notes Error:', error);

            // Check if it's a network error (server not running)
            if (error.message.includes('fetch') || error.name === 'TypeError') {
                showStatus('⚠️ Cannot connect to server. Is the application running?', 'error');
                if (generateNotesBtn) {
                    generateNotesBtn.innerHTML = '<span>⚠️ Server Offline</span>';
                    setTimeout(() => {
                        generateNotesBtn.innerHTML = '<span>✨ Generate Notes</span>';
                    }, 4000);
                }
            } else {
                showStatus(`Server error: ${error.message}`, 'error');
            }
        } finally {
            generateNotesBtn.disabled = false;
            generateNotesBtn.innerHTML = '<span>✨ Generate Notes</span>';
        }
    });
}

// Handle Enter Key in Notes Input
if (notesUrlInput) {
    notesUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (generateNotesBtn) generateNotesBtn.click();
        }
    });
}

// Open Notes in New Page
function openNotesInNewWindow(notes, videoUrl) {
    // Store notes in sessionStorage
    sessionStorage.setItem('generatedNotes', notes);
    sessionStorage.setItem('videoUrl', videoUrl);

    // Navigate to notes page
    window.location.href = '/html/notes.html';
}

// Helper: Advanced Markdown to HTML Parser
function markdownToHtml(text) {
    if (!text) return "";

    // CRITICAL FIX: Convert escaped newlines to actual newlines
    text = text.replace(/\\n/g, '\n');

    // Protect HTML
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 1. Horizontal Rules (---)
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 2px solid rgba(255,255,255,0.1); margin: 20px 0;">');

    // 2. Headers (# ## ### ####)
    html = html.replace(/^#### (.*?)$/gm, '<h4 style="color: #667eea; margin-top: 20px; margin-bottom: 10px; font-size: 16px;">$1</h4>');
    html = html.replace(/^### (.*?)$/gm, '<h3 style="color: #667eea; margin-top: 25px; margin-bottom: 12px; font-size: 18px;">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 style="color: #f093fb; margin-top: 30px; margin-bottom: 15px; font-size: 22px;">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 style="color: #f093fb; margin-top: 35px; margin-bottom: 18px; font-size: 26px; font-weight: 700;">$1</h1>');

    // 3. Bold (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff; font-weight: 600;">$1</strong>');

    // 4. Italic (*text*)
    html = html.replace(/\*([^*]+)\*/g, '<em style="color: #ddd;">$1</em>');

    // 5. Inline Code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(102, 126, 234, 0.2); padding: 2px 6px; border-radius: 4px; color: #4facfe; font-family: monospace; font-size: 14px;">$1</code>');

    // 6. Numbered Lists (1. Item)
    html = html.replace(/^(\d+)\. (.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px; color: #ddd;">$2</li>');

    // 7. Bullet Points (• or - or *)
    html = html.replace(/^[•\-\*] (.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 8px; color: #ddd; list-style-type: disc;">$1</li>');

    // 8. Blockquotes (> text)
    html = html.replace(/^&gt; (.*?)$/gm, '<blockquote style="border-left: 4px solid #667eea; padding-left: 15px; margin: 15px 0; color: #bbb; font-style: italic;">$1</blockquote>');

    // 9. Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #4facfe; text-decoration: underline;">$1</a>');

    // 10. Timestamps [00:00]
    html = html.replace(/\[(\d{2}:\d{2}(?::\d{2})?)\]/g, '<span style="background: rgba(240, 147, 251, 0.2); padding: 2px 8px; border-radius: 4px; color: #f093fb; font-weight: 600; font-size: 13px;">[$1]</span>');

    // 11. Newlines (double newline = paragraph, single = br)
    html = html.replace(/\n\n/g, '</p><p style="margin-bottom: 12px; line-height: 1.6; color: #ccc;">');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = '<p style="margin-bottom: 12px; line-height: 1.6; color: #ccc;">' + html + '</p>';

    return html;
}

// Copy Notes
document.getElementById('copyNotesBtn')?.addEventListener('click', () => {
    const text = notesText.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copyNotesBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        showStatus('Failed to copy text', 'error');
    });
});

// PDF Notes
document.getElementById('pdfNotesBtn')?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const text = notesText.textContent;
    const splitText = doc.splitTextToSize(text, 180); // Wrap text

    doc.text(splitText, 15, 15);
    doc.save('Video_Notes.pdf');

    showStatus('PDF Downloaded!', 'success');
});

// Handle download
// (Garbage code removed)

// (Moved to top)

// Helper: Show Status
function showStatus(message, type = 'info') {
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.style.display = 'block';
    }
}

// Helper: Hide Status
function hideStatus() {
    if (statusMessage) statusMessage.style.display = 'none';
}

// Helper: Reset Button
function resetDownloadButton() {
    if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
            <svg class="btn-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download Videos
        `;
    }
}

// Helper: Valid URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Helper: Detect Platform
function detectPlatform(url) {
    if (!supportedPlatforms) return { name: 'Unknown', color: '#667eea' };
    for (const [key, platform] of Object.entries(supportedPlatforms)) {
        for (const pattern of platform.patterns) {
            if (pattern.test(url)) {
                return platform;
            }
        }
    }
    return { name: 'Unknown', color: '#667eea' };
}

// Show video info in preview
function showVideoInfo(info, url) {
    const downloadLink = `${API_URL}/api/download?url=${encodeURIComponent(url)}`;

    const html = `
        <div style="text-align: center;">
            <div style="margin-bottom: 20px;">
                <img src="${info.thumbnail}" alt="Thumbnail" style="max-width: 100%; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            </div>
            <h3 style="font-size: 20px; margin-bottom: 10px; color: var(--text-primary);">
                ${info.title}
            </h3>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">
                By ${info.author || 'Unknown'} • ${info.duration ? Math.floor(info.duration / 60) + ':' + (info.duration % 60).toString().padStart(2, '0') : ''}
            </p>
            
            <a href="${downloadLink}" class="download-btn" style="display: inline-flex; text-decoration: none; justify-content: center; align-items: center; width: auto; padding: 12px 30px;">
                <svg class="btn-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <polyline points="7 10 12 15 17 10" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="12" y1="15" x2="12" y2="3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Download Video</span>
            </a>
        </div>
    `;

    previewContent.innerHTML = html;
    videoPreview.style.display = 'block';

    // Scroll to preview
    videoPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Show preview with backend info
function showPreviewWithBackendInfo(platform, url, data) {
    const html = `
        <div style="text-align: center;">
            <div style="display: inline-block; padding: 20px 40px; background: ${platform.color}20; border-radius: 16px; margin-bottom: 20px;">
                <h4 style="color: ${platform.color}; font-size: 18px; margin: 0;">
                    ${platform.name} Video Detected
                </h4>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 30px; word-break: break-all;">
                ${url}
            </p>
            <div style="background: rgba(255, 255, 255, 0.05); padding: 30px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="font-size: 16px; color: var(--text-secondary); margin-bottom: 20px;">
                    ${data.message || '⚠️ Backend server issue'}
                </p>
            </div>
        </div>
    `;

    previewContent.innerHTML = html;
    videoPreview.style.display = 'block';
}

// Handle Download
async function handleDownload() {
    const url = videoInput.value.trim();
    if (!url) {
        showStatus('Please paste a link first', 'error');
        return;
    }

    if (!isValidUrl(url)) {
        showStatus('Invalid URL', 'error');
        return;
    }

    // UI Loading State
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '⏳ Processing...';
    showStatus('Fetching video details...', 'info');

    try {
        // Verify video exists
        const response = await fetch(`${API_URL}/api/video-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch info');
        }

        // 1. Show Preview
        showVideoInfo(data.info, url);

        // 2. Show Pre-download Status
        showStatus('⬇️ Downloading video... Please wait.', 'info');

        // 3. Auto-Trigger Download
        const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(url)}`;

        setTimeout(() => {
            // Trigger download
            window.location.href = downloadUrl;

            // 1. Immediate confirmation
            showStatus('✅ Download Started!', 'success');

            // 2. Final confirmation after a few seconds
            setTimeout(() => {
                showStatus('✅ Download successful', 'success');
                resetDownloadButton();
            }, 5000);
        }, 1000);

    } catch (e) {
        console.error(e);

        if (e.message.includes('fetch') || e.name === 'TypeError' || e.message.includes('Failed to fetch')) {
            showStatus('⚠️ Cannot connect to server. Is the application running?', 'error');
            if (downloadBtn) {
                downloadBtn.innerHTML = '<span>⚠️ Server Offline</span>';
                setTimeout(() => resetDownloadButton(), 4000);
            }
        } else {
            showStatus(e.message || 'Error occurred', 'error');
        }
        resetDownloadButton();
    }
}

// Attach Listener
if (downloadBtn) {
    downloadBtn.onclick = handleDownload;
}

// Make globally available for HTML onclick
window.handleDownload = handleDownload;

console.log('✅ VideoGrabber Logic Completely Loaded');

// ==========================================
// Mobile Menu Toggle Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menuBtn');
    const nav = document.querySelector('.nav');
    const overlay = document.getElementById('navOverlay');
    const links = document.querySelectorAll('.nav-link');
    const closeBtn = document.querySelector('.internal-close-btn');

    if (menuBtn && nav) {
        // Toggle Menu function
        function toggleMenu() {
            const isActive = nav.classList.contains('active');

            if (isActive) {
                closeMenu();
            } else {
                openMenu();
            }
        }

        function openMenu() {
            nav.classList.add('active');
            if (overlay) overlay.style.display = 'block';

            // Icon handling
            const icon = menuBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            }
            // Optional: Hide external button if desired, but CSS handles opacity/pointer-events
        }

        function closeMenu() {
            nav.classList.remove('active');
            if (overlay) overlay.style.display = 'none';

            // Icon handling
            const icon = menuBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }

        // 1. Click on Hamburger
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        // 2. Click on Internal Close Button
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMenu();
            });
        }

        // 3. Click on Overlay (Close)
        if (overlay) {
            overlay.addEventListener('click', closeMenu);
        }

        // 4. Click on Any Link (Close)
        links.forEach(link => {
            link.addEventListener('click', closeMenu);
        });

        // 5. Click outside (Close)
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('active') && !nav.contains(e.target) && !menuBtn.contains(e.target)) {
                closeMenu();
            }
        });
    }
});



