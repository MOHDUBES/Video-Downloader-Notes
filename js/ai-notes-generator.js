const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Configure AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyClV5yBFRtrMuRPcFzuUDqYVLSVzCRQzQk');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Enhanced Fallback Notes (Transcript-Aware)
function generateEnhancedFallbackNotes(title, description, subtitles) {
    const lines = [];

    // Header
    lines.push(`# 📘 Study Notes: ${title}`);
    lines.push('');

    // Executive Summary
    lines.push('## 🚀 Executive Summary');
    lines.push('');
    lines.push(`This document provides a structured breakdown of the video "**${title}**" based on available metadata.`);
    lines.push('');

    // Parse Description for Timestamps/Chapters
    const descLines = description.split('\n').filter(l => l.trim().length > 0);
    const chapters = [];

    descLines.forEach(line => {
        // Match timestamps like 00:00, 1:05, 01:22:33
        const match = line.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:|]?\s*(.+)/);
        if (match) {
            const timeStr = match[1];
            const topic = match[2].trim();
            if (topic.length > 2 && !topic.includes('http')) {
                chapters.push({
                    timeStr,
                    seconds: parseTime(timeStr),
                    topic
                });
            }
        }
    });

    // Parse Subtitles if available
    let transcriptData = [];
    if (subtitles && subtitles.length > 50) {
        transcriptData = parseSubtitles(subtitles);
    }

    // Table of Contents
    if (chapters.length > 0) {
        lines.push('## 📑 Table of Contents');
        chapters.forEach(ch => {
            lines.push(`- **${ch.timeStr}** - [${ch.topic}](#${slugify(ch.topic)})`);
        });
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## 📚 Detailed Course Modules');
        lines.push('');

        // Generate Detailed Sections
        chapters.forEach((ch, index) => {
            const nextCh = chapters[index + 1];
            const endTime = nextCh ? nextCh.seconds : (transcriptData.length > 0 ? transcriptData[transcriptData.length - 1].start : 999999);

            // Extract text for this chapter
            const sectionText = getTranscriptSegment(transcriptData, ch.seconds, endTime);

            lines.push(`### ${index + 1}. ${ch.topic}`);
            lines.push('');
            lines.push(`**⏱️ Timestamp:** \`${ch.timeStr}\``);
            lines.push('');

            if (sectionText && sectionText.length > 50) {
                lines.push('**📝 Transcript / Content:**');
                const paragraphs = splitIntoParagraphs(sectionText);
                paragraphs.forEach(p => {
                    lines.push(`> ${p}`);
                    lines.push('');
                });
            } else {
                // Smart Filler Text since Transcript is unavailable
                lines.push('**📝 Key Concepts Covered:**');
                lines.push(`- In-depth exploration of **${ch.topic}**.`);
                lines.push(`- Core syntax and implementation details relevant to ${ch.topic}.`);
                lines.push(`- Best practices and common interview questions related to this topic.`);
                lines.push('');
                lines.push('**💡 Instructor Insights:**');
                lines.push(`> "Focus on the practical examples of ${ch.topic} shown in this segment. These are critical for your understanding."`);
            }
            lines.push('');
        });

    } else {
        // No chapters found. Use "Smart Metadata Mode"
        lines.push('## 📝 Resources & Links');
        lines.push('The following resources were extracted from the video metadata:');
        lines.push('');

        const linesToProcess = description.split('\n');
        let extractedLinks = [];
        let contextText = [];

        let currentHeader = '';

        linesToProcess.forEach(line => {
            // 1. Clean encoding artifacts ( and other garbage from user screenshot)
            // Remove non-printable ASCII except basic punctuation
            let trimmed = line.trim().replace(/[\uFFFD\u00A0\u200B\u202F\uFEFF]/g, '').replace(/[^\x20-\x7E\n]/g, '');
            if (!trimmed) return;

            // 2. Detect Link pattern
            const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const url = urlMatch[0];

                // Extract potential label from the same line
                let label = trimmed.replace(url, '').trim();

                // Clean common list markers and loose punctuation
                label = label.replace(/^[\d+.\-•*|:>\s]+/, '').replace(/[:-\s]+$/, '');

                // Logic: If this line has no label, but we have a "currentHeader" from previous line, use that.
                if ((!label || label.length < 2) && currentHeader) {
                    label = currentHeader;
                } else if (!label || label.length < 2) {
                    label = 'Resource Link';
                }

                // Clean label style
                label = label.charAt(0).toUpperCase() + label.slice(1);

                // Add to list (Prevent duplicates)
                // New Format: - **Label**: [Link](url) instead of [url](url)
                const linkEntry = `- **${label}**: [Link](${url})`;

                // Only add if unique
                const isDuplicate = extractedLinks.some(l => l.includes(url));
                if (!isDuplicate) {
                    extractedLinks.push(linkEntry);
                }
            }
            // 3. Detect Context Headers (e.g., "Wipro Internship:")
            else if (trimmed.length < 50 && trimmed.endsWith(':')) {
                currentHeader = trimmed.replace(':', '').trim();
            }
            // 4. Normal Text
            else if (trimmed.length > 20 && !trimmed.match(/^\d+$/)) {
                // Determine if this is a header-like line for the NEXT item
                if (trimmed.length < 50 && !trimmed.includes('.')) {
                    currentHeader = trimmed;
                } else {
                    contextText.push(trimmed);
                    // Do NOT reset header if we just pushed context, maybe multiple links follow a description? 
                    // Actually safer to keep it unless it's clearly a new section.
                }
            }
        });

        if (extractedLinks.length > 0) {
            extractedLinks.forEach(link => lines.push(link));
        } else {
            lines.push('*No direct resources found in description.*');
        }

        // Add Context / Summary Section
        if (contextText.length > 0) {
            lines.push('');
            lines.push('## 📖 Context & Details');
            lines.push('');
            // Limit context to avoid "Copy Paste" feel. Take top 10 unique lines.
            const uniqueLines = [...new Set(contextText)];
            uniqueLines.slice(0, 8).forEach(text => {
                lines.push(`- ${text}`);
            });
            if (uniqueLines.length > 8) {
                lines.push(`\n*(...additional metadata omitted for brevity)*`);
            }
        }
    }

    // common footer
    lines.push('');
    lines.push('---');
    if (subtitles && subtitles.length > 100) {
        lines.push('*🚀 Generated by Antigravity v2 beta*');
    } else {
        lines.push('**⚠️ Note:** This video provided no subtitles. These notes are generated solely from the video description.');
    }

    return lines.join('\n');
}

// Helpers
function parseTime(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

function parseSubtitles(rawText) {
    // Simple VTT/SRT parser
    const regex = /(\d{2}:\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[\.,]\d{3})[^\n]*\n([\s\S]*?)(?=\n\n|\n\d|$)/g;
    const items = [];
    let match;

    // Normalize newlines
    const text = rawText.replace(/\r\n/g, '\n');

    while ((match = regex.exec(text)) !== null) {
        const start = parseTime(match[1].replace(',', '.')); // Handle SRT comma
        // Clean text: remove tags like <c.color> or <b>, remove newlines within caption
        let content = match[3]
            .replace(/<[^>]+>/g, '')
            .replace(/align:start position:0%/g, '') // Common VTT artifacts
            .replace(/\n/g, ' ')
            .trim();

        if (content && !items.find(i => i.text === content)) { // Dedup immediate repeats
            items.push({ start, text: content });
        }
    }

    // Fallback if regex fails (some plain text formats)
    if (items.length === 0) {
        return [{ start: 0, text: rawText.substring(0, 5000) }];
    }

    return items;
}

function getTranscriptSegment(data, start, end) {
    return data
        .filter(item => item.start >= start && item.start < end)
        .map(item => item.text)
        .join(' ')
        .replace(/\s+/g, ' '); // Normalize spaces
}

function splitIntoParagraphs(text) {
    // Split efficiently roughly every 300 chars at a sentence boundary
    const paragraphs = [];
    let current = '';
    const sentences = text.match(/[^.!?]+[.!?]+[\])'"]*/g) || [text];

    sentences.forEach(s => {
        current += s + ' ';
        if (current.length > 300) {
            paragraphs.push(current.trim());
            current = '';
        }
    });
    if (current.trim()) paragraphs.push(current.trim());
    return paragraphs;
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// AI-Powered Professional Notes Generator
async function generateAIProfessionalNotes(title, description, subtitles) {
    try {
        const hasSubtitles = subtitles && subtitles.length > 100;

        let cleanedContent = '';
        if (hasSubtitles) {
            cleanedContent = subtitles
                .replace(/<[^>]*>/g, '')
                .replace(/WEBVTT|Kind:.*|Language:.*|\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim()
                .substring(0, 15000);
        }

        const prompt = hasSubtitles ? `
You are an expert educational content creator. Create comprehensive, professional study notes from this video content.

**Video Title:** ${title}
**Video Description:** ${description}
**Video Transcript:** ${cleanedContent}

**Format:**
# Briefing Document: [Main Topic]

## Executive Summary
[3-4 paragraphs covering main themes]

## 1. [First Major Topic]
### 1.1. [Subtopic]
[Detailed explanation with examples]

## Key Takeaways
- [Important points]

## Practical Applications
[How to apply this knowledge]
` : `
You are an expert educational content creator. Create professional study notes from this video based on the metadata.

**Video Title:** ${title}
**Video Description:** ${description}

**CRITICAL INSTRUCTIONS:**
1. Do NOT just copy-paste the description.
2. If the description contains valid information, summarize it.
3. If the description contains links/internships/jobs, organize them into a clean "Resources & Opportunities" table or list.
4. Extrapolate the likely content based on the Title and Context.
5. Create a structured guide.

**Format:**
# Briefing Document: [Topic]

## 🚀 Executive Summary
[Write a professional summary of what this video likely covers based on the title "${title}"]

## 📋 Opportunities & Resources
[Extract every link/job/internship from the description and format as a bulleted list with clear labels]

## 🎓 Learning Roadmap (Inferred)
[Create a likely syllabus/roadmap for this topic]
- **Topic 1**: [Description]
- **Topic 2**: [Description]

## 💡 Key Advice
[General advice for this topic: ${title}]
`;

        console.log('🤖 Attempting AI generation...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        // Make sure we get text
        if (!response.text) throw new Error('Empty AI response');
        const notes = response.text();

        console.log('✅ AI notes generated successfully!');
        return notes;

    } catch (error) {
        console.error('❌ AI generation failed:', error.message);

        // Generate the fallback content (Resources)
        const fallbackContent = generateEnhancedFallbackNotes(title, description, subtitles);

        // Prepend a clear warning about why AI failed
        const warning = [
            '# ⚠️ AI Generation Failed',
            '',
            `**Error Details:** ${error.message}`,
            '',
            '> **Possible Fixes:**',
            '> 1. Check your API Key in `.env`',
            '> 2. Enable "Generative Language API" in Google Cloud Console.',
            '> 3. Ensure your API Key has access to "gemini-1.5-flash".',
            '',
            '---',
            '',
            '### 📂 Extracted Resources (Backup Mode)',
            ''
        ].join('\n');

        // Allow proper rendering of the fallback content by removing its original title if needed, 
        // or just append. fallbackContent has a title "# Study Notes...".
        // Let's replace the first line of fallbackContent if it exists.
        const modifiedFallback = fallbackContent.replace(/^# .*$/m, '');

        return warning + modifiedFallback;
    }
}

module.exports = { generateAIProfessionalNotes, generateEnhancedFallbackNotes };
