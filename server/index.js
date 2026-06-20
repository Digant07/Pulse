const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'database.json');

// Initialize database
function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ projects: [], deployments: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {
    return { projects: [], deployments: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// In-memory active build logs and listeners for Server-Sent Events (SSE)
const activeLogs = {};       // deploymentId -> array of log strings
const activeListeners = {};  // deploymentId -> array of SSE response objects

// GitHub OAuth configuration
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// 1. AUTH ENDPOINTS
app.get('/api/auth/github', (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/?auth_error=` + encodeURIComponent('GitHub OAuth is not configured on the server. Please add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET keys to your .env file in the project root and restart the server, or use Sandbox Mode / Personal Access Token.'));
  }
  const redirectUri = `${BACKEND_URL}/api/auth/callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;
  res.redirect(githubUrl);
});

app.get('/api/auth/callback', async (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/?auth_error=No+code+provided+from+GitHub`);
  }

  try {
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }, {
      headers: {
        Accept: 'application/json',
      }
    });

    const { access_token, error, error_description } = tokenResponse.data;
    if (error) {
      return res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(error_description || error)}`);
    }

    // Fetch user profile info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
        'User-Agent': 'Pluse-Vercel-Clone'
      }
    });

    const user = {
      login: userResponse.data.login,
      name: userResponse.data.name || userResponse.data.login,
      avatar_url: userResponse.data.avatar_url,
      token: access_token
    };

    res.redirect(`${FRONTEND_URL}/?auth_success=true&token=${user.token}&login=${user.login}&name=${encodeURIComponent(user.name)}&avatar=${user.avatar_url}`);
  } catch (err) {
    console.error('OAuth Callback Error:', err.message);
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// 2. GITHUB REPOSITORY ENDPOINTS
app.get('/api/github/repos', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: GitHub access token is required.' });
  }

  if (token === 'mocktoken') {
    return res.json([
      {
        id: 101,
        name: 'pluse-project-demo',
        description: 'Vercel clone live demo project',
        default_branch: 'main',
        updated_at: new Date().toISOString(),
        owner: { login: 'mockuser' }
      },
      {
        id: 102,
        name: 'react-app-example',
        description: 'React + Vite project template',
        default_branch: 'master',
        updated_at: new Date().toISOString(),
        owner: { login: 'mockuser' }
      }
    ]);
  }

  try {
    const response = await axios.get('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Pluse-Vercel-Clone'
      }
    });

    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      description: repo.description || 'No description provided',
      default_branch: repo.default_branch || 'main',
      updated_at: repo.updated_at,
      owner: { login: repo.owner.login }
    }));
    res.json(repos);
  } catch (err) {
    console.error('Error fetching Github repos:', err.message);
    res.status(500).json({ error: 'Failed to fetch repositories: ' + err.message });
  }
});

// Detect framework from package.json
app.get('/api/github/repos/:owner/:repo/framework', async (req, res) => {
  const { owner, repo } = req.params;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: GitHub access token is required.' });
  }

  if (token === 'mocktoken') {
    return res.json({ framework: 'static', detected: true, packageJson: {} });
  }

  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Pluse-Vercel-Clone'
      }
    });

    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const pkg = JSON.parse(content);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    let framework = 'static';
    if (deps['next']) framework = 'next';
    else if (deps['@vue/cli-service'] || deps['vue'] && deps['vite']) framework = 'vue';
    else if (deps['svelte']) framework = 'svelte';
    else if (deps['react'] && deps['vite']) framework = 'vite';
    else if (deps['react']) framework = 'react';

    res.json({ framework, detected: true, packageJson: pkg });
  } catch (err) {
    res.json({ framework: 'static', detected: false, error: err.message });
  }
});

// 3. PROJECT & DEPLOYMENT MANAGEMENT (API GATEWAY)
app.get('/api/projects', (req, res) => {
  const db = readDb();
  res.json(db.projects);
});

app.post('/api/projects', (req, res) => {
  const { name, repository, branch, framework, buildCommand, outputDirectory, env, owner } = req.body;

  if (!name || !repository) {
    return res.status(400).json({ error: 'Project name and repository are required.' });
  }

  const db = readDb();
  
  // Check if project name exists
  const existingProject = db.projects.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existingProject) {
    return res.status(400).json({ error: 'A project with this name already exists on Pluse.' });
  }

  const projectId = uuidv4();
  const subDomain = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const projectUrl = `https://${subDomain}.pluse.dev`;

  const newProject = {
    id: projectId,
    name,
    repository,
    branch: branch || 'main',
    framework,
    buildCommand: buildCommand || getDefaultBuildCommand(framework),
    outputDirectory: outputDirectory || getDefaultOutputDir(framework),
    env: env || [],
    url: projectUrl,
    createdAt: new Date().toISOString(),
    owner: owner || 'mockuser',
    status: 'QUEUED'
  };

  db.projects.push(newProject);
  writeDb(db);

  // Trigger initial deployment
  const deployment = triggerDeployment(newProject);

  res.json({ project: newProject, deployment });
});

app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const project = db.projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  
  const deployments = db.deployments.filter(d => d.projectId === id);
  res.json({ project, deployments });
});

// Redeploy project trigger
app.post('/api/projects/:id/redeploy', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const project = db.projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const deployment = triggerDeployment(project);
  res.json({ deployment });
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  
  const projectIndex = db.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  // Remove the project
  db.projects.splice(projectIndex, 1);

  // Remove all deployments associated with the project
  db.deployments = db.deployments.filter(d => d.projectId !== id);

  writeDb(db);
  res.json({ success: true, message: 'Project and all associated deployments deleted successfully.' });
});

// SSE Log Stream Route
app.get('/api/deployments/:id/logs', (req, res) => {
  const { id } = req.params;
  
  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Find deployment status to send initial status
  const db = readDb();
  const deployment = db.deployments.find(d => d.id === id);

  // Fetch initial logs
  let logs = activeLogs[id];
  if (!logs && deployment) {
    const project = db.projects.find(p => p.id === deployment.projectId);
    if (project && deployment.status === 'READY') {
      // Re-generate completed static logs on the fly if cleared from memory on server restarts
      logs = generateStaticLogs(project);
      activeLogs[id] = logs;
    }
  }

  logs = logs || [];
  logs.forEach(log => {
    res.write(`data: ${JSON.stringify({ log })}\n\n`);
  });

  if (deployment) {
    res.write(`data: ${JSON.stringify({ status: deployment.status })}\n\n`);
  }

  // Register SSE listener
  if (!activeListeners[id]) {
    activeListeners[id] = [];
  }
  activeListeners[id].push(res);

  // Connection close cleanup
  req.on('close', () => {
    activeListeners[id] = activeListeners[id].filter(listener => listener !== res);
  });
});

// 4. DEPLOYMENT BUILD PIPELINE SIMULATOR
function triggerDeployment(project) {
  const db = readDb();
  const deploymentId = uuidv4();
  
  const deployment = {
    id: deploymentId,
    projectId: project.id,
    status: 'QUEUED',
    url: project.url,
    createdAt: new Date().toISOString(),
  };

  db.deployments.push(deployment);
  writeDb(db);

  // Trigger AWS Orchestrator Lambda to initiate CodeBuild
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'https://5a7qmkoqm5.execute-api.ap-south-1.amazonaws.com/prod/orchestrate';
  console.log(`[Orchestrator] Invoking Lambda at ${orchestratorUrl} for project ${project.name}`);
  
  axios.post(orchestratorUrl, {
    projectId: project.id,
    deploymentId: deploymentId,
    name: project.name,
    repository: project.repository,
    branch: project.branch,
    framework: project.framework,
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
    env: project.env,
    url: project.url
  })
  .then(response => {
    console.log(`[Orchestrator] Lambda triggered successfully. Status: ${response.status}`, response.data);
  })
  .catch(err => {
    console.error(`[Orchestrator] Failed to trigger Lambda: ${err.message}`);
  });

  // Launch simulated builder thread in background to keep UI interactive
  runBuildSimulation(project, deployment);

  return deployment;
}

function runBuildSimulation(project, deployment) {
  const depId = deployment.id;
  activeLogs[depId] = [];
  
  const addLog = (message) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const logLine = `[${timestamp}] ${message}`;
    activeLogs[depId].push(logLine);
    
    // Broadcast log to all SSE listeners
    if (activeListeners[depId]) {
      activeListeners[depId].forEach(listener => {
        listener.write(`data: ${JSON.stringify({ log: logLine })}\n\n`);
      });
    }
  };

  const updateDbStatus = (status) => {
    const db = readDb();
    const dIndex = db.deployments.findIndex(d => d.id === depId);
    if (dIndex !== -1) {
      db.deployments[dIndex].status = status;
    }
    
    // Update parent project status as well
    const pIndex = db.projects.findIndex(p => p.id === project.id);
    if (pIndex !== -1) {
      db.projects[pIndex].status = status;
    }
    
    writeDb(db);

    // Broadcast status to SSE listeners
    if (activeListeners[depId]) {
      activeListeners[depId].forEach(listener => {
        listener.write(`data: ${JSON.stringify({ status })}\n\n`);
      });
    }
  };

  // Compile specific steps based on frameworks
  const steps = [];
  steps.push({ delay: 500, log: '✨ Pluse Build Pipeline initiated...' });
  steps.push({ delay: 600, log: `📦 Pulling source code from Git repository: https://github.com/${project.repository}.git` });
  steps.push({ delay: 700, log: `🔱 Checking out branch: [${project.branch}]` });
  steps.push({ delay: 400, log: `✔ Successfully fetched commit hash: ${Math.random().toString(36).substring(2, 9)} (Latest HEAD)` });
  steps.push({ delay: 800, log: `⚙ Environment configuration loaded. (${project.env.length} secret variables injected)` });
  
  if (project.env && project.env.length > 0) {
    project.env.forEach(e => {
      steps.push({ delay: 100, log: `  ↳ Injected variable: ${e.key}=******` });
    });
  }

  steps.push({ delay: 1000, log: `⚡ Running setup: Installing node modules using npm...` });
  steps.push({ delay: 1200, log: `  ↳ npm WARN config global \`--global\`, \`--local\` are deprecated. Use \`--location=global\` instead.` });
  steps.push({ delay: 1500, log: `  ↳ Installed 482 packages in 3.42s (compiled lockfile resolved successfully)` });
  
  steps.push({ delay: 600, log: `🚀 Initiating compilation stage using framework preset [${project.framework.toUpperCase()}]` });
  steps.push({ delay: 800, log: `  ↳ Running script: "${project.buildCommand}"` });

  // Framework logs
  if (project.framework === 'next') {
    steps.push({ delay: 1000, log: `    ▲ Next.js 14.2.3` });
    steps.push({ delay: 800, log: `    - Creating an optimized production build ...` });
    steps.push({ delay: 1200, log: `    - Compiled client and server components successfully` });
    steps.push({ delay: 900, log: `    - Linting and checking validity of types ...` });
    steps.push({ delay: 800, log: `    - Collecting page data ...` });
    steps.push({ delay: 1100, log: `    - Generating static pages (5/5) ...` });
    steps.push({ delay: 600, log: `    - Finalizing page optimization ...` });
    steps.push({ delay: 400, log: `\n    Route (app)                              Size     First Load JS` });
    steps.push({ delay: 100, log: `    ┌ Accessing server-side resources       0 B      0 B` });
    steps.push({ delay: 100, log: `    └ /                                      5.12 kB  87.2 kB` });
    steps.push({ delay: 100, log: `    + First Load JS shared by all            82.1 kB` });
  } else if (project.framework === 'vite' || project.framework === 'react') {
    steps.push({ delay: 900, log: `    vite v5.2.11 building for production...` });
    steps.push({ delay: 1000, log: `    transforming...` });
    steps.push({ delay: 700, log: `    ✓ 381 modules transformed.` });
    steps.push({ delay: 800, log: `    rendering chunks...` });
    steps.push({ delay: 400, log: `    computing bundle sizes...` });
    steps.push({ delay: 200, log: `    ${project.outputDirectory}/assets/index-D7hG9a7b.css   12.40 kB │ gzip:  3.12 kB` });
    steps.push({ delay: 200, log: `    ${project.outputDirectory}/assets/index-B5xR2g8h.js   128.51 kB │ gzip: 42.10 kB` });
    steps.push({ delay: 300, log: `    ✓ built in 2.12s` });
  } else if (project.framework === 'vue') {
    steps.push({ delay: 1000, log: `    vue-cli-service build --mode production` });
    steps.push({ delay: 800, log: `    Building for production...` });
    steps.push({ delay: 1200, log: `    Building bundle for production...` });
    steps.push({ delay: 700, log: `    DONE  Build complete. The ${project.outputDirectory} directory is ready to be deployed.` });
  } else if (project.framework === 'svelte') {
    steps.push({ delay: 1000, log: `    svelte-kit build` });
    steps.push({ delay: 800, log: `    vite v5.2.11 building for production...` });
    steps.push({ delay: 900, log: `    svelte-kit adapter compilation...` });
    steps.push({ delay: 600, log: `    ✔ Created production bundle in ${project.outputDirectory}` });
  } else {
    // Static
    steps.push({ delay: 500, log: `    Processing static deployment files...` });
    steps.push({ delay: 500, log: `    Directory layout validated. Found: index.html, assets/` });
  }

  steps.push({ delay: 1000, log: `\n🌐 [API Gateway Router] Routing setup initiated...` });
  steps.push({ delay: 800, log: `  ↳ Provisioning ingress proxy rule: HTTP redirection target -> ${project.url}` });
  steps.push({ delay: 700, log: `  ↳ Uploading compiled builds into Pluse Edge Server Cache...` });
  steps.push({ delay: 600, log: `  ↳ Provisioning Let's Encrypt SSL Certificates for SSL negotiation...` });
  steps.push({ delay: 800, log: `  ↳ Active CDN propagation: US-East, EU-Central, AP-South...` });
  steps.push({ delay: 700, log: `✔ Global DNS setup complete. Routing active.` });
  steps.push({ delay: 500, log: `\n🎉 Deployment succeeded. App is online!` });

  // Sequenced runner
  let totalDelay = 0;
  
  setTimeout(() => {
    updateDbStatus('BUILDING');
  }, 100);

  steps.forEach((step, index) => {
    totalDelay += step.delay;
    setTimeout(() => {
      addLog(step.log);
      
      if (step.log.includes('Routing setup initiated')) {
        updateDbStatus('DEPLOYING');
      }

      if (index === steps.length - 1) {
        updateDbStatus('READY');
      }
    }, totalDelay);
  });
}

function getDefaultBuildCommand(framework) {
  switch (framework) {
    case 'next': return 'next build';
    case 'vite':
    case 'react': return 'npm run build';
    case 'vue': return 'npm run build';
    case 'svelte': return 'npm run build';
    default: return 'echo "Static build: No compilation required"';
  }
}

function getDefaultOutputDir(framework) {
  switch (framework) {
    case 'next': return '.next';
    case 'vite':
    case 'react': return 'dist';
    case 'vue': return 'dist';
    case 'svelte': return '.svelte-kit';
    default: return '.';
  }
}

function generateStaticLogs(project) {
  const steps = [];
  const baseTime = new Date(project.createdAt || new Date());
  
  const formatTime = (date) => {
    return date.toISOString().split('T')[1].slice(0, -1);
  };

  let logTime = new Date(baseTime.getTime());
  const addLog = (message, secondsOffset) => {
    logTime = new Date(logTime.getTime() + secondsOffset * 1000);
    steps.push(`[${formatTime(logTime)}] ${message}`);
  };

  addLog('✨ Pluse Build Pipeline initiated...', 0.5);
  addLog(`📦 Pulling source code from Git repository: https://github.com/${project.repository}.git`, 0.6);
  addLog(`🔱 Checking out branch: [${project.branch}]`, 0.7);
  addLog(`✔ Successfully fetched commit hash: ${Math.random().toString(36).substring(2, 9).toUpperCase()} (Latest HEAD)`, 0.4);
  addLog(`⚙ Environment configuration loaded. (${project.env.length} secret variables injected)`, 0.8);
  
  if (project.env && project.env.length > 0) {
    project.env.forEach(e => {
      addLog(`  ↳ Injected variable: ${e.key}=******`, 0.1);
    });
  }

  addLog(`⚡ Running setup: Installing node modules using npm...`, 1.0);
  addLog(`  ↳ npm WARN config global \`--global\`, \`--local\` are deprecated. Use \`--location=global\` instead.`, 1.2);
  addLog(`  ↳ Installed 482 packages in 3.42s (compiled lockfile resolved successfully)`, 1.5);
  addLog(`🚀 Initiating compilation stage using framework preset [${project.framework.toUpperCase()}]`, 0.6);
  addLog(`  ↳ Running script: "${project.buildCommand}"`, 0.8);

  if (project.framework === 'next') {
    addLog(`    ▲ Next.js 14.2.3`, 1.0);
    addLog(`    - Creating an optimized production build ...`, 0.8);
    addLog(`    - Compiled client and server components successfully`, 1.2);
    addLog(`    - Linting and checking validity of types ...`, 0.9);
    addLog(`    - Collecting page data ...`, 0.8);
    addLog(`    - Generating static pages (5/5) ...`, 1.1);
    addLog(`    - Finalizing page optimization ...`, 0.6);
    addLog(`\n    Route (app)                              Size     First Load JS`, 0.4);
    addLog(`    ┌ Accessing server-side resources       0 B      0 B`, 0.1);
    addLog(`    └ /                                      5.12 kB  87.2 kB`, 0.1);
    addLog(`    + First Load JS shared by all            82.1 kB`, 0.1);
  } else if (project.framework === 'vite' || project.framework === 'react') {
    addLog(`    vite v5.2.11 building for production...`, 0.9);
    addLog(`    transforming...`, 1.0);
    addLog(`    ✓ 381 modules transformed.`, 0.7);
    addLog(`    rendering chunks...`, 0.8);
    addLog(`    computing bundle sizes...`, 0.4);
    addLog(`    ${project.outputDirectory}/assets/index-D7hG9a7b.css   12.40 kB │ gzip:  3.12 kB`, 0.2);
    addLog(`    ${project.outputDirectory}/assets/index-B5xR2g8h.js   128.51 kB │ gzip: 42.10 kB`, 0.2);
    addLog(`    ✓ built in 2.12s`, 0.3);
  } else if (project.framework === 'vue') {
    addLog(`    vue-cli-service build --mode production`, 1.0);
    addLog(`    Building for production...`, 0.8);
    addLog(`    Building bundle for production...`, 1.2);
    addLog(`    DONE  Build complete. The ${project.outputDirectory} directory is ready to be deployed.`, 0.7);
  } else if (project.framework === 'svelte') {
    addLog(`    svelte-kit build`, 1.0);
    addLog(`    vite v5.2.11 building for production...`, 0.8);
    addLog(`    svelte-kit adapter compilation...`, 0.9);
    addLog(`    ✔ Created production bundle in ${project.outputDirectory}`, 0.6);
  } else {
    addLog(`    Processing static deployment files...`, 0.5);
    addLog(`    Directory layout validated. Found: index.html, assets/`, 0.5);
  }

  addLog(`\n🌐 [API Gateway Router] Routing setup initiated...`, 1.0);
  addLog(`  ↳ Provisioning ingress proxy rule: HTTP redirection target -> ${project.url}`, 0.8);
  addLog(`  ↳ Uploading compiled builds into Pluse Edge Server Cache...`, 0.7);
  addLog(`  ↳ Provisioning Let's Encrypt SSL Certificates for SSL negotiation...`, 0.6);
  addLog(`  ↳ Active CDN propagation: US-East, EU-Central, AP-South...`, 0.8);
  addLog(`✔ Global DNS setup complete. Routing active.`, 0.7);
  addLog(`\n🎉 Deployment succeeded. App is online!`, 0.5);

  return steps;
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Pluse Gateway and Server running on http://localhost:${PORT}`);
});
