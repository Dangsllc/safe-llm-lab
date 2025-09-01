
Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

This project can be deployed to any static hosting service:

1. **Build the project**: `npm run build`
2. **Deploy the `dist` folder** to your hosting provider
3. **Configure environment variables** for production API keys (server-side only)

### Deployment Options
- **Netlify**: Connect your repository for automatic deployments
- **Vercel**: Import project and configure build settings
- **AWS S3 + CloudFront**: Static hosting with CDN
- **GitHub Pages**: Free hosting for open source projects

### Custom Domain Setup

Most hosting providers support custom domains:
1. Configure DNS records to point to your hosting provider
2. Add domain in your hosting provider's dashboard
3. Enable HTTPS/SSL certificates for security
