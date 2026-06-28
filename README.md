# Pulse – Deploy at the Speed of Light

A custom automated deployment platform engineered from the ground up to replicate the magic of platforms like Vercel and Netlify. Deploy your frontend applications globally with zero server maintenance.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![AWS](https://img.shields.io/badge/AWS-Serverless-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com)
[![React](https://img.shields.io/badge/React-Powered-61DAFB?logo=react&logoColor=white)](https://reactjs.org)

## Overview

Traditional deployments often require manual server provisioning, complex CI/CD pipeline setups, and messy configurations. **Pulse** eliminates that complexity entirely—making global edge deployments accessible to anyone with:

- One-click deployment from GitHub
- Blazing-fast setup times
- Zero server maintenance

## Key Features

### Native Cloud Build Engine
Pulse automatically detects your frontend framework directly from your repository:
- **React**
- **Vite**
- **Next.js**
- **Vanilla JavaScript**

Handles dependencies and builds your code seamlessly in the cloud without any manual configuration.

### Instant Edge Routing
A custom serverless router that:
- Provisions live, secure subdomains instantly (e.g., `project.pulse.jo3.org`)
- Handles Single Page Application (SPA) routing out of the box
- Deploys globally with edge caching

### One-Click GitHub Integration
- Authenticate seamlessly via GitHub OAuth
- Import repositories with a single click
- Watch your site provision automatically in seconds
- No manual uploads or server management

## Developer-Focused Tools

### Live Deployment Tracking
Monitor your deployment status in real-time:
- QUEUED to Building to Testing to DEPLOYED
- Live logs and performance metrics
- Instant rollback capabilities

### Secure Infrastructure
- Enterprise-grade cloud security
- Zero public buckets – all assets are private
- SSL/TLS certificates auto-provisioned
- DDoS protection built-in

### Dark-Mode Dashboard
A sleek, intuitive dashboard for managing deployments:
- Real-time deployment status
- Project analytics and insights
- One-click domain management

## Demo Video

[![Pulse Demo Video](https://i1.loom.com/share/33aca823f0d842ed821f7eba0bb3cc64)](https://www.loom.com/share/33aca823f0d842ed821f7eba0bb3cc64)

## Getting Started

### Prerequisites
- GitHub account
- Modern web browser

### Quick Start

1. **Visit Pulse**: https://pulse.jo3.org
2. **Authenticate** with your GitHub account
3. **Select a repository** from your GitHub profile
4. **Configure deployment settings** (optional)
5. **Deploy** – Your site goes live instantly

## Supported Frameworks

| Framework | Status | Build Time |
|-----------|--------|-----------|
| React | Supported | 2-3 min |
| Next.js | Supported | 2-3 min |
| Vite | Supported | 1-2 min |
| Vanilla JS | Supported | 1 min |
| Vue.js | Coming Soon | - |
| Svelte | Coming Soon | - |

## Architecture

### Tech Stack

**Frontend:**
- React with TypeScript
- Tailwind CSS
- Dark mode support

**Backend:**
- AWS Lambda (Serverless Functions)
- AWS S3 (Static Asset Storage)
- AWS CloudFront (Edge Distribution)
- AWS API Gateway (REST APIs)

**Infrastructure:**
- AWS Route 53 (DNS Management)
- AWS ACM (SSL Certificates)
- AWS CloudWatch (Monitoring & Logging)

## Performance

- **Global CDN**: Content delivered from 300+ edge locations worldwide
- **Average Deploy Time**: 2-3 minutes from push to live
- **Uptime**: 99.99% SLA
- **Build Caching**: Smart caching for faster rebuilds

## Configuration

### Custom Domain
Connect your own domain:
1. Update DNS records to point to Pulse nameservers
2. SSL certificate auto-provisions within minutes
3. Your site is live on your custom domain

### Environment Variables
Set environment variables in the Pulse dashboard:
1. Navigate to Project Settings
2. Add your API keys and secrets
3. Redeploy for changes to take effect

## Troubleshooting

**Build Failed?**
- Check build logs in the dashboard
- Verify your `package.json` has correct dependencies
- Ensure framework is correctly detected

**Deployment Slow?**
- Check your internet connection
- Large projects may take longer to build
- Clear browser cache and retry

## Documentation

For detailed documentation, visit: https://docs.pulse.jo3.org

## Contributing

We welcome contributions! Please feel free to submit issues and pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

Have questions or feedback?
- Email- Digant.malviya5@gmail.com
- GitHub Issues: https://github.com/Digant07/Pulse/issues

## Built With

- **AWS Serverless**: Lambda, S3, CloudFront, Codebuild
- **React**: Modern UI framework
- **GitHub API**: Seamless Git integration
- **Tailwind CSS**: Beautiful styling

---

Deploy at the speed of light

[Try Pulse Now](https://pulse.jo3.org)

Made with love by [Digant07](https://github.com/Digant07)
