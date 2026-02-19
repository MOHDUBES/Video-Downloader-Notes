const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../core/.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { google } = require('googleapis');
const os = require('os');
const { generateAIProfessionalNotes } = require('./ai-notes-generator');

const execPromise = promisify(exec);


// Path to yt-dlp executable
const localYtDlp = path.join(__dirname, '../core/yt-dlp.exe');
const ytDlpPath = fs.existsSync(localYtDlp) ? localYtDlp : 'yt-dlp';

// YouTube Data API v3 Setup
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY || 'AIzaSyBoL04UsTkKuxuT1YZq-XQCl5S8KrDU8nA'
});

// Google Gemini AI Setup (Moved to ai-notes-generator.js)
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '../')));

// Debug logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Temp Directory
const downloadsDir = path.join(os.tmpdir(), 'video-downloader-temp');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}
const filesDir = downloadsDir;

// Platform Detection
function detectPlatform(url) {
    const platforms = {
        youtube: /(?:youtube\.com|youtu\.be)/i,
        instagram: /instagram\.com/i,
        facebook: /facebook\.com|fb\.watch/i,
        tiktok: /tiktok\.com/i,
        twitter: /twitter\.com|x\.com/i,
        vimeo: /vimeo\.com/i,
        dailymotion: /dailymotion\.com/i,
        reddit: /reddit\.com|v\.redd\.it/i
    };

    for (const [platform, pattern] of Object.entries(platforms)) {
        if (pattern.test(url)) return platform;
    }
    return 'unknown';
}

// Download Handler
async function handleDownload(url, quality, res) {
    const platform = detectPlatform(url);
    const timestamp = Date.now();
    const outputTemplate = path.join(downloadsDir, `video_${timestamp}.%(ext)s`);

    let qualityFlag = '';
    if (quality === 'highest') {
        qualityFlag = '-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"';
    } else if (quality === 'audio') {
        qualityFlag = '-f bestaudio -x --audio-format mp3';
    } else {
        qualityFlag = `-f "bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best"`;
    }

    const command = `"${ytDlpPath}" ${qualityFlag} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -o "${outputTemplate}" "${url}"`;

    try {
        const { stdout, stderr } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });
        const files = fs.readdirSync(downloadsDir).filter(f => f.startsWith(`video_${timestamp}`));

        if (files.length === 0) {
            throw new Error('Download failed - no file created');
        }

        const downloadedFile = path.join(downloadsDir, files[0]);
        const stats = fs.statSync(downloadedFile);

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`);
        res.setHeader('Content-Length', stats.size);

        const fileStream = fs.createReadStream(downloadedFile);
        fileStream.pipe(res);

        fileStream.on('end', () => {
            setTimeout(() => {
                try {
                    if (fs.existsSync(downloadedFile)) {
                        fs.unlinkSync(downloadedFile);
                    }
                } catch (e) {
                    console.error('Cleanup error:', e);
                }
            }, 5000);
        });

    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

// API: Video Info
app.post('/api/video-info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.json({ success: false, error: 'URL required' });

        const command = `"${ytDlpPath}" --dump-json --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`;
        const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });
        const videoData = JSON.parse(stdout);

        res.json({
            success: true,
            info: {
                title: videoData.title,
                thumbnail: videoData.thumbnail,
                duration: videoData.duration,
                author: videoData.uploader || videoData.channel,
                platform: detectPlatform(url)
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// API: Download Video
app.post('/api/download', async (req, res) => {
    try {
        const { url, quality = '720' } = req.body;
        if (!url) return res.json({ success: false, error: 'URL required' });
        await handleDownload(url, quality, res);
    } catch (e) {
        if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/download', async (req, res) => {
    try {
        const { url, quality = '720' } = req.query;
        if (!url) return res.status(400).send('URL required');
        await handleDownload(url, quality, res);
    } catch (e) {
        if (!res.headersSent) res.status(500).send('Download failed: ' + e.message);
    }
});

// API: Generate Professional Notes with AI
app.post('/api/generate-notes', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.json({ error: 'URL is required' });

        console.log('🤖 AI-Powered Notes Generation for:', url);
        const tempId = Date.now();
        const outputTemplate = path.join(filesDir, `sub_${tempId}`);

        // Step 1: Fetch video metadata
        const titleCmd = `"${ytDlpPath}" --get-title --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`;
        const descCmd = `"${ytDlpPath}" --get-description --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`;

        const [titleRes, descRes] = await Promise.all([
            execPromise(titleCmd).catch(() => ({ stdout: 'Video' })),
            execPromise(descCmd).catch(() => ({ stdout: '' }))
        ]);

        const title = titleRes.stdout.trim();
        const description = descRes.stdout.trim();

        // Step 2: Try to fetch subtitles (Improved)
        // Try precise languages first, then fall back to auto
        const command = `"${ytDlpPath}" --write-auto-sub --write-sub --sub-lang "en,en-orig,en-US,hi,hi-Latn" --sub-format vtt --skip-download --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" --output "${outputTemplate}" "${url}"`;

        let subtitles = '';
        try {
            await execPromise(command);
            const files = fs.readdirSync(filesDir);
            // Relaxed filter to catch any subtitle file generated
            const relatedFiles = files.filter(f =>
                f.includes(tempId.toString()) &&
                (f.endsWith('.vtt') || f.endsWith('.ttml') || f.endsWith('.srv3') || f.endsWith('.xml'))
            );

            if (relatedFiles.length > 0) {
                relatedFiles.sort((a, b) => {
                    const statA = fs.statSync(path.join(filesDir, a));
                    const statB = fs.statSync(path.join(filesDir, b));
                    return statB.size - statA.size;
                });

                const bestFile = relatedFiles[0];
                console.log(`✅ Captions found: ${bestFile}`);
                subtitles = fs.readFileSync(path.join(filesDir, bestFile), 'utf-8');

                // Cleanup
                try { fs.unlinkSync(path.join(filesDir, bestFile)); } catch (e) { }
            }
        } catch (e) {
            console.log('⚠️ No captions available');
        }

        // Step 3: Generate AI-powered notes
        console.log('🤖 Generating professional notes with Gemini AI...');
        const notes = await generateAIProfessionalNotes(title, description, subtitles);

        return res.json({
            success: true,
            notes: notes,
            source: subtitles ? 'captions+AI' : 'description+AI'
        });

    } catch (error) {
        console.error('Notes Error:', error);
        res.json({ success: false, error: error.message });
    }
});

// AI-Powered Professional Notes Generator (DEPRECATED - Use imported module)
async function generateAIProfessionalNotes_OLD(title, description, subtitles) {
    try {
        const hasSubtitles = subtitles && subtitles.length > 100;

        // Clean subtitles if available
        let cleanedContent = '';
        if (hasSubtitles) {
            cleanedContent = subtitles
                .replace(/<[^>]*>/g, '')
                .replace(/WEBVTT|Kind:.*|Language:.*|\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            // Limit to first 15000 characters
            cleanedContent = cleanedContent.substring(0, 15000);
        }

        const prompt = hasSubtitles ? `
You are an expert educational content creator. Create comprehensive, professional study notes from this video content.

**Video Title:** ${title}

**Video Description:**
${description}

**Video Transcript:**
${cleanedContent}

**Instructions:**
Create detailed, well-structured notes following this format:

# Briefing Document: [Main Topic]

## Executive Summary
[Write 3-4 paragraphs covering main themes and purpose]

## 1. [First Major Topic]
### 1.1. [Subtopic]
[Detailed explanation with examples]

## 2. [Second Major Topic]
### 2.1. [Subtopic]
[Content]

## Key Takeaways
- [Important points]

## Practical Applications
[How to apply this knowledge]

Use markdown, include examples, create tables, add code blocks where needed.
` : `
You are an expert educational content creator. Create professional study notes from this video.

**Video Title:** ${title}

**Video Description:**
${description}

Create structured notes with:
# Briefing Document: [Topic]
## Executive Summary
## Content Overview
## Key Topics
## Learning Objectives

Make it professional and detailed.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const notes = response.text();

        console.log('✅ AI notes generated');
        return notes;

    } catch (error) {
        console.error('❌ AI failed:', error.message);
        console.log('📝 Using enhanced fallback notes...');
        return generateEnhancedFallbackNotes(title, description, subtitles);
    }
}

// Enhanced Fallback Notes Generator
function generateEnhancedFallbackNotes(title, description, subtitles) {
    const lines = [];

    lines.push(`# Briefing Document: ${title}`);
    lines.push('');
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`This document provides a comprehensive overview of the video "${title}". The content covers fundamental concepts and practical applications designed for learners at various levels.`);
    lines.push('');

    const topics = title.split('|').map(t => t.trim()).filter(t => t);
    if (topics.length > 1) {
        lines.push(`The video is structured around ${topics.length} main themes: ${topics.join(', ')}. Each section builds upon previous concepts to provide a complete learning experience.`);
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 1. Content Overview');
    lines.push('');
    lines.push(`**Title:** ${title}`);
    lines.push('');

    const descLines = description.split('\n').filter(l => l.trim());
    const timestamps = [];
    const links = [];
    let mainContent = [];

    descLines.forEach(line => {
        if (line.match(/\d{1,2}:\d{2}/)) {
            timestamps.push(line);
        } else if (line.match(/https?:\/\//)) {
            links.push(line);
        } else if (line.length > 20 && !line.includes('Coupon')) {
            mainContent.push(line);
        }
    });

    if (mainContent.length > 0) {
        lines.push('### 1.1. Description');
        lines.push('');
        mainContent.slice(0, 5).forEach(line => {
            lines.push(line);
            lines.push('');
        });
    }

    if (timestamps.length > 0) {
        lines.push('## 2. Video Structure');
        lines.push('');
        lines.push(`This comprehensive video is organized into **${timestamps.length} chapters**:`);
        lines.push('');

        timestamps.forEach((ts, idx) => {
            const match = ts.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)/);
            if (match) {
                lines.push(`${idx + 1}. **[${match[1]}]** — ${match[2]}`);
            } else {
                lines.push(`${idx + 1}. ${ts}`);
            }
        });
        lines.push('');
    }

    lines.push('## 3. Learning Path');
    lines.push('');
    lines.push('Based on the video structure, here are the key areas to focus on:');
    lines.push('');

    timestamps.slice(0, 8).forEach((ts, idx) => {
        const match = ts.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+)/);
        if (match) {
            lines.push(`### 3.${idx + 1}. ${match[2]}`);
            lines.push('');
            lines.push(`**Covered at timestamp:** ${match[1]}`);
            lines.push('');
        }
    });

    if (links.length > 0) {
        lines.push('## 4. Related Resources');
        lines.push('');
        links.forEach(link => {
            const cleanLink = link.replace(/^[-•*]\s*/, '').trim();
            lines.push(`- ${cleanLink}`);
        });
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## Key Takeaways');
    lines.push('');
    lines.push('- Comprehensive coverage of all fundamental topics');
    lines.push('- Structured learning path from basics to advanced concepts');
    lines.push(`- ${timestamps.length} organized chapters for easy navigation`);
    lines.push('- Practical examples and applications');
    lines.push('');
    lines.push('## About These Notes');
    lines.push('');
    lines.push('📌 **Source:** Video description and metadata');
    lines.push('');
    lines.push('✅ **Includes:**');
    lines.push(`- Video structure (${timestamps.length} chapters)`);
    lines.push('- Topic overview');
    lines.push(`- ${links.length} related resources`);
    lines.push('');
    lines.push('⚠️ **Note:** AI-powered detailed notes temporarily unavailable');
    lines.push('');
    lines.push('💡 **Tip:** For more detailed notes, use videos with captions');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Generated from video metadata*');

    return lines.join('\n');
}

// Multer for upload
const multer = require('multer');
const upload = multer({ dest: downloadsDir });

app.post('/api/generate-notes-upload', upload.single('video'), async (req, res) => {
    if (req.file) fs.unlinkSync(req.file.path);
    res.json({
        success: false,
        notes: `# ⚠️ File Upload Not Supported\n\n**Use video URL instead.**`
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../html/index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log('✅ NO AI DEPENDENCY - Pure text processing enabled\n');
});

// ==========================================
// INTELLIGENT TEXT PROCESSING (NO AI API)
// ==========================================

function generateIntelligentNotes(vttData) {
    try {
        // Step 1: Parse VTT and extract clean sentences
        const sentences = extractCleanSentences(vttData);

        if (sentences.length < 3) {
            return `# 📋 Notes Unavailable\n\nCould not extract enough content from this video.`;
        }

        // Step 2: Identify key topics and create structure
        const analysis = analyzeContent(sentences);

        // Step 3: Generate formatted notes
        let notes = `# 📋 ${analysis.title}\n\n`;
        notes += `## 📊 Summary\n\n`;
        notes += `This video contains approximately **${sentences.length} key points** across **${Math.ceil(sentences.length / 5)} main topics**.\n\n`;

        // Key Points
        notes += `## 🔑 Key Points\n\n`;
        const keyPoints = extractKeyPoints(sentences);
        keyPoints.forEach((point, i) => {
            notes += `${i + 1}. ${point}\n`;
        });
        notes += `\n`;

        // Detailed Breakdown
        notes += `## 📚 Detailed Breakdown\n\n`;
        const sections = groupIntoSections(sentences);
        sections.forEach((section, i) => {
            notes += `### Section ${i + 1}\n\n`;
            section.forEach(sent => {
                notes += `- ${sent}\n`;
            });
            notes += `\n`;
        });

        // Keywords
        if (analysis.keywords.length > 0) {
            notes += `## 🏷️ Keywords\n\n`;
            notes += analysis.keywords.slice(0, 15).join(' • ') + '\n\n';
        }

        notes += `---\n*✨ Generated using intelligent text processing*`;

        return notes;

    } catch (e) {
        console.error('Note generation error:', e);
        return `# Error\n\nCould not process content: ${e.message}`;
    }
}

function extractCleanSentences(vttData) {
    const lines = vttData.split('\n');
    let allText = [];
    let seenTexts = new Set();

    lines.forEach(line => {
        // Skip timestamps, WEBVTT headers, numbers
        if (line.includes('-->') || line.includes('WEBVTT') || /^\d+$/.test(line.trim())) {
            return;
        }

        let clean = line
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\[.*?\]/g, '') // Remove [Music], [Applause]
            .replace(/♪/g, '') // Remove music symbols
            .replace(/^- /, '') // Remove leading dash
            .trim();

        if (clean.length > 15 && !seenTexts.has(clean.toLowerCase())) {
            allText.push(clean);
            seenTexts.add(clean.toLowerCase());
        }
    });

    // Further deduplication: remove substrings
    let filtered = [];
    allText.forEach((text, i) => {
        let isDuplicate = false;
        for (let j = 0; j < allText.length; j++) {
            if (i !== j && allText[j].includes(text) && allText[j].length > text.length) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) {
            filtered.push(text);
        }
    });

    return filtered;
}

function analyzeContent(sentences) {
    // Extract keywords (words that appear frequently)
    const wordFreq = {};
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'this', 'that', 'it', 'from', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'you', 'your', 'we', 'our', 'i', 'my', 'me']);

    sentences.forEach(sent => {
        const words = sent.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        words.forEach(word => {
            if (!stopWords.has(word)) {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
    });

    // Sort by frequency
    const keywords = Object.entries(wordFreq)
        .filter(([word, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

    // Generate title from most common words
    const title = keywords.length > 0
        ? `Video Notes: ${keywords.slice(0, 3).join(', ')}`
        : 'Video Notes';

    return { title, keywords };
}

function extractKeyPoints(sentences) {
    // Take first sentence from each group of 5-7 sentences
    const keyPoints = [];
    for (let i = 0; i < sentences.length; i += 6) {
        if (sentences[i]) {
            let point = sentences[i];
            // Capitalize first letter
            point = point.charAt(0).toUpperCase() + point.slice(1);
            // Add period if missing
            if (!point.endsWith('.') && !point.endsWith('?') && !point.endsWith('!')) {
                point += '.';
            }
            keyPoints.push(point);
        }
    }
    return keyPoints.slice(0, 10); // Max 10 key points
}

function groupIntoSections(sentences) {
    const sections = [];
    const sectionSize = 5;

    for (let i = 0; i < sentences.length; i += sectionSize) {
        const section = sentences.slice(i, i + sectionSize).map(s => {
            s = s.charAt(0).toUpperCase() + s.slice(1);
            if (!s.endsWith('.') && !s.endsWith('?') && !s.endsWith('!')) {
                s += '.';
            }
            return s;
        });
        if (section.length > 0) {
            sections.push(section);
        }
    }

    return sections;
}

// ENHANCED DESCRIPTION NOTES - Creates proper study guide from timestamps
function generateDescriptionNotes(title, description) {
    const lines = [];

    lines.push('# 📋 ' + title);
    lines.push('');

    if (!description || description.length < 20) {
        lines.push('## ⚠️ Minimal Information');
        lines.push('');
        lines.push('This video has very limited metadata.');
        lines.push('');
        lines.push('**What we know:**');
        lines.push('- Title: ' + title);
        lines.push('');
        lines.push('---');
        lines.push('*Generated from available metadata*');
        return lines.join('\n');
    }

    const descLines = description.split('\n').filter(l => l.trim().length > 5);

    // Extract different content types
    const timestamps = [];
    const urls = [];
    const hashtags = [];
    const content = [];

    descLines.forEach(line => {
        const trimmed = line.trim();

        // Timestamps with labels
        if (/\d{1,2}:\d{2}/.test(trimmed)) {
            timestamps.push(trimmed);
        }
        // URLs
        else if (trimmed.includes('http')) {
            urls.push(trimmed);
        }
        // Hashtags
        else if (trimmed.startsWith('#')) {
            hashtags.push(trimmed);
        }
        // Actual content (filter promotional)
        else if (trimmed.length > 15) {
            const lower = trimmed.toLowerCase();
            if (!lower.includes('coupon') &&
                !lower.includes('discount') &&
                !lower.includes('enroll') &&
                !lower.match(/click here|subscribe|book free/i)) {
                content.push(trimmed);
            }
        }
    });

    // Build comprehensive notes
    lines.push('## 📊 Video Overview');
    lines.push('');
    lines.push('**Title:** ' + title);
    lines.push('');

    // Extract topic from title
    const titleWords = title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'video', 'tutorial'].includes(w));

    if (titleWords.length > 0) {
        const topics = titleWords.slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ');
        lines.push('**Main Topics:** ' + topics);
        lines.push('');
    }

    // Content summary
    if (content.length > 0) {
        lines.push('## 📝 Description');
        lines.push('');
        content.slice(0, 5).forEach((line, i) => {
            lines.push((i + 1) + '. ' + line);
        });
        lines.push('');
    }

    // Timeline/Chapters - FORMATTED PROPERLY
    if (timestamps.length > 0) {
        lines.push('## 📑 Video Structure');
        lines.push('');
        const adjective = Math.floor(timestamps.length / 10) > 0 ? 'comprehensive ' : '';
        lines.push('This ' + adjective + 'video is organized into **' + timestamps.length + ' chapters**:');
        lines.push('');

        timestamps.forEach((ts, i) => {
            // Extract time and topic
            const match = ts.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(.+)/);
            if (match) {
                const time = match[1];
                let topic = match[2].trim();
                // Remove leading numbers/dashes
                topic = topic.replace(/^[\d\.\-\s]+/, '');
                lines.push('**' + (i + 1) + '. ' + time + '** — ' + topic);
            } else {
                lines.push((i + 1) + '. ' + ts);
            }
        });
        lines.push('');

        // Generate study sections from timestamps
        if (timestamps.length > 3) {
            lines.push('## 📚 Learning Path');
            lines.push('');
            lines.push('Based on the video structure, here are the key areas to focus on:');
            lines.push('');

            timestamps.slice(0, 10).forEach((ts, i) => {
                const match = ts.match(/\d{1,2}:\d{2}(?::\d{2})?\s*(.+)/);
                if (match) {
                    let topic = match[1].replace(/^[\d\.\-\s]+/, '').trim();
                    if (topic.length > 5) {
                        lines.push('### ' + (i + 1) + '. ' + topic);
                        lines.push('');
                        const timeMatch = ts.match(/\d{1,2}:\d{2}(?::\d{2})?/);
                        if (timeMatch) {
                            lines.push('*Covered at timestamp: ' + timeMatch[0] + '*');
                            lines.push('');
                        }
                    }
                }
            });
        }
    }

    // Hashtags as topics
    if (hashtags.length > 0) {
        lines.push('## 🏷️ Topics & Tags');
        lines.push('');
        lines.push(hashtags.slice(0, 10).join(' • '));
        lines.push('');
    }

    // Resources
    if (urls.length > 0) {
        lines.push('## 🔗 Related Resources');
        lines.push('');
        urls.slice(0, 5).forEach((url, i) => {
            lines.push((i + 1) + '. ' + url);
        });
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('### 💡 About These Notes');
    lines.push('');
    lines.push('📌 **Source:** Video description and metadata');
    lines.push('');
    lines.push('✅ **Includes:**');
    lines.push('- Video structure (' + timestamps.length + ' chapters)');
    lines.push('- Topic overview');
    if (urls.length > 0) {
        lines.push('- ' + urls.length + ' related resources');
    }
    lines.push('');
    lines.push('⚠️ **Limitations:**');
    lines.push('- No detailed content (video has no captions)');
    lines.push('- Limited to description information');
    lines.push('');
    lines.push('💡 **For detailed notes:** Use videos with auto-generated captions/subtitles');
    lines.push('');
    lines.push('*Generated from video metadata*');

    return lines.join('\n');
}
