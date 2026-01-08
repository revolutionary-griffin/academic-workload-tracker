# Academic Work Tracker

A web-based academic workload tracker that connects directly to Google Sheets. Track your research, teaching, service, and other activities with automatic synchronization to your personal Google Sheet.

## Features

- **Google Sheets Integration**: All data stored in your personal Google Sheet - you maintain full control
- **Daily/Weekly/Monthly Views**: Track your work at different time scales
- **Four Main Categories**: Research, Teaching, Service, and Other (fully customizable)
- **Statistics Dashboard**: Visual charts and graphs showing your workload distribution
- **Workload Allocation Tracking**: Set target percentages and compare with actual time spent
- **Smart Reminders**: Get notified when you haven't recorded your work for several days
- **Fully Customizable**: Add/remove tasks and categories as needed
- **Automatic Updates**: As the website owner updates the code, changes roll out automatically to all users

## Setup Instructions

### 1. Google Cloud Console Setup

First, you need to create Google API credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Click "Enable APIs and Services"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen:
     - Choose "External" user type
     - Fill in app name: "Academic Work Tracker"
     - Add your email
     - Save and continue through the steps
   - Back in credentials, select "Web application" as application type
   - Add authorized JavaScript origins:
     - For local testing: `http://localhost:8000` or `http://localhost:3000`
     - For production: Your website domain (e.g., `https://yourwebsite.com`)
   - Click "Create"
   - Copy your Client ID

5. (Optional but recommended) Create an API Key:
   - Click "Create Credentials" > "API Key"
   - Copy the API key

### 2. Configure the Application

1. Open `config.js` in a text editor
2. Replace `YOUR_CLIENT_ID_HERE` with your Google Client ID
3. Replace `YOUR_API_KEY_HERE` with your API Key (if you created one)
4. Save the file

### 3. Run the Application

You need to serve the files over HTTP (not file://) for Google authentication to work.

**Option A: Using Python (if installed)**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Option B: Using Node.js (if installed)**
```bash
# Install http-server globally
npm install -g http-server

# Run server
http-server -p 8000
```

**Option C: Using VS Code Live Server**
- Install "Live Server" extension in VS Code
- Right-click on `index.html`
- Select "Open with Live Server"

### 4. First Time Use

1. Open your browser and navigate to `http://localhost:8000` (or your server address)
2. Click "Sign in with Google"
3. Grant the necessary permissions
4. The app will automatically create a new Google Sheet for you
5. You can access your Google Sheet directly from Google Sheets anytime

## Usage Guide

### Daily Tracking

1. Navigate to the "Daily Tracker" tab
2. Select the date you want to record
3. Enter hours spent on each task
4. Click "Save to Google Sheets" to sync your data

### View Modes

- **Day View**: Enter hours for a single day
- **Week View**: See and edit an entire week at once
- **Month View**: Summary view of the month (read-only)

### Statistics

1. Go to the "Statistics" tab
2. Select a time period (week, month, quarter, year, or custom)
3. View charts showing:
   - Total hours by category
   - Category breakdown (pie chart)
   - Daily trend over time
   - Summary statistics

### Workload Allocation

1. Go to the "Workload Allocation" tab
2. Set your target percentages for each category
3. View comparison with your actual time allocation (last 30 days)
4. Click "Save Allocation" to store your targets

### Settings

Customize the tracker to fit your needs:

- **Task Categories**: Add or remove tasks within each category
- **Reminders**: Enable/disable reminders and set threshold days
- **Google Sheet**: Create a new sheet or connect to an existing one

## Data Storage

- **Google Sheets**: Your primary data storage (you have full control)
- **Local Browser Storage**: Temporary cache for offline work (syncs when you save)

## Customization

### Adding New Categories

Currently, the app supports four main categories. To add more, you'll need to modify the code in `config.js` and update the corresponding CSS colors in `styles.css`.

### Changing Task Names

You can customize task names directly in the Settings tab without modifying code.

## Deployment for Multiple Users

To deploy this for multiple users:

1. Host the files on a web server (GitHub Pages, Netlify, Vercel, etc.)
2. Update the "Authorized JavaScript origins" in Google Cloud Console with your domain
3. Share the URL with users
4. Each user will sign in with their own Google account
5. Each user gets their own separate Google Sheet
6. When you update the website code, all users automatically get the updates

### Example: Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files (index.html, styles.css, app.js, config.js)
3. Go to repository Settings > Pages
4. Select source branch and save
5. Your site will be available at `https://yourusername.github.io/repository-name`
6. Update the Google Cloud Console with this URL

## Privacy & Security

- **No Backend Server**: All authentication happens directly between the user and Google
- **User Data Privacy**: You (the app owner) have NO access to users' data
- **User Control**: Users can revoke access anytime from their Google Account settings
- **Data Ownership**: Each user owns their Google Sheet completely

## Troubleshooting

### "Error: Please check your API configuration"
- Verify your Client ID is correct in `config.js`
- Make sure you're accessing via HTTP (not file://)
- Check that the URL matches your authorized origins in Google Cloud Console

### "Could not load your spreadsheet"
- The sheet may have been deleted
- Click "Create New Sheet" in Settings

### Data not saving
- Make sure you're signed in
- Check your internet connection
- Try clicking "Save to Google Sheets" again

### Reminder not showing
- Check that reminders are enabled in Settings
- You need at least one day of recorded data
- The reminder threshold may not be reached yet

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design works on all devices

## License

This project is open source and free to use for academic purposes.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Verify your Google API setup
3. Check browser console for error messages

## Updates

To update the tracker with new features:
1. Update the files on your web server
2. Users automatically get the new version on next page load
3. Their data remains safe in their Google Sheets

---

**Version**: 1.0.0
**Last Updated**: January 2026
