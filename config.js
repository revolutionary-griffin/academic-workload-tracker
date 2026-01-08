// Google API Configuration
// IMPORTANT: Replace these with your own Google API credentials
// Follow these steps to set up:
// 1. Go to https://console.cloud.google.com/
// 2. Create a new project or select an existing one
// 3. Enable Google Sheets API
// 4. Create OAuth 2.0 credentials (Web application)
// 5. Add authorized JavaScript origins (e.g., http://localhost:8000)
// 6. Copy your Client ID here

const CONFIG = {
    // Replace with your Google API Client ID
    CLIENT_ID: '836263652104-073u2sb0lb6ldtilfvorb2phso6od7s3.apps.googleusercontent.com',

    // API Key (optional, but recommended for better quota)
    API_KEY: 'AIzaSyAdc1k4zPWuL5CcSoe2pS_Yb1UkkEovma8',

    // Discovery docs for Google Sheets API
    DISCOVERY_DOCS: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],

    // Authorization scopes
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',

    // Default spreadsheet name
    SPREADSHEET_NAME: 'Academic Work Tracker',

    // Default task categories and tasks
    DEFAULT_CATEGORIES: {
        research: {
            name: 'Research',
            color: '#3b82f6',
            tasks: [
                'Writing',
                'Reading',
                'Grant Writing',
                'Analysis',
                'Supervision',
                'Meetings',
                'Admin',
                'Misc'
            ]
        },
        teaching: {
            name: 'Teaching',
            color: '#10b981',
            tasks: [
                'Delivery',
                'Preparation',
                'Unit Design',
                'Marking',
                'Admin',
                'Meetings',
                'Tutorial Guides',
                'Office Hours'
            ]
        },
        service: {
            name: 'Service',
            color: '#f59e0b',
            tasks: [
                'Meetings',
                'Peer Review',
                'Admin',
                'Training',
                'Public Engagement',
                'Mentoring',
                'Misc',
            ]
        },
        other: {
            name: 'Other',
            color: '#8b5cf6',
            tasks: [
                'Annual Leave',
                'Personal Leave',
                'Public Holiday'
            ]
        }
    }
};
