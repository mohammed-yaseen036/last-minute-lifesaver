# The Last-Minute Life Saver 🚨

An AI-powered, proactive productivity companion that prevents missed deadlines, meetings, and commitments. Unlike traditional passive to-do lists, this system actively assists you in prioritizing, scheduling, and taking immediate action through automated sub-task breakdowns, audio focus environments, voice control, and calendar integrations.

## 🌟 Key Features

1. **AI Task Decomposition & Prioritization**: Powered by **Google Gemini 2.5 Flash**, the system auto-analyzes tasks (e.g. "Fix the landing page bug by 5pm") and classifies them into the correct quadrant of the Eisenhower Matrix (Do, Schedule, Delegate, Eliminate) while breaking them down into small, manageable 10-15 minute blocks.
2. **Panic Mode (Emergency Rescuer)**: Facing a tight deadline? The Panic Mode triggers a visual "cybernetic countdown", synthesizes a custom white-noise/alpha-wave audio backdrop using the Web Audio API, and displays only the immediate micro-task to eliminate procrastination paralysis.
3. **Voice-Activated Quick Capture**: Integrated with the **Web Speech API** for rapid task logging, translating verbal requests (e.g., "Remind me to file taxes by tomorrow afternoon") into structured database entries.
4. **Google Calendar Sync**: Generates a standard RFC 5545 `.ics` file client-side, allowing instant integration into Google Calendar, Outlook, or Apple Calendar with a single click.
5. **Aesthetic Focus Mode**: Features visual countdown rings, glassmorphic layout, micro-animations, and client-side synthesized focus audio cues.

## 🛠️ Technology Stack

*   **Frontend Core**: Semantic HTML5, Vanilla JavaScript (ES6+), CSS3 with a unified cybernetic-glassmorphism dark theme.
*   **AI Integration**: Google Gemini 2.5 Flash API (Client-side directly to `generativelanguage.googleapis.com` using `localStorage` API keys).
*   **Web API Capabilities**: Web Audio API (Synthesized focus sounds), Web Speech API (Speech Recognition), and File Blob generation (ICS calendar export).

## 🚀 Getting Started

Since the application is 100% serverless and client-side, setup is instantaneous:

1. **Clone/Download** the files.
2. Open [index.html](file:///C:/Users/smyas/.gemini/antigravity-ide/scratch/last-minute-lifesaver/index.html) in any modern web browser (Chrome, Edge, or Safari).
3. Click the **Settings Gear** icon in the bottom-right corner and input your **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
4. Start adding tasks by typing or clicking the microphone icon to speak!

## 🌐 Deployment to Google Cloud (Firebase Hosting)

Deploy the app in under 2 minutes:

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Log in and initialize
firebase login
firebase init hosting

# 3. Choose your project, set public directory as '.'
# 4. Deploy!
firebase deploy --only hosting
```
