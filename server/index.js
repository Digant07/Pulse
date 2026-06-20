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

// 4. DEPLOYMENT BUILD PIPELINE
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

  // Initialize empty log buffer for this deployment
  activeLogs[deploymentId] = [];

  // Trigger AWS Orchestrator Lambda to initiate CodeBuild
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'https://5a7qmkoqm5.execute-api.ap-south-1.amazonaws.com/prod/orchestrate';
  const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;
  const callbackUrl = `${BACKEND_URL}/api/deployments/${deploymentId}/callback`;

  console.log(`[Orchestrator] Invoking Lambda at ${orchestratorUrl} for project ${project.name}`);
  console.log(`[Orchestrator] Callback URL: ${callbackUrl}`);

  const payload = {
    projectId: project.id,
    deploymentId: deploymentId,
    name: project.name,
    repository: project.repository,
    branch: project.branch,
    framework: project.framework,
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
    env: project.env,
    url: project.url,
    callbackUrl: callbackUrl   // Lambda uses this to POST real status/logs back
  };

  // Emit an initial "queued" log so the UI is not blank
  const queuedLog = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ⏳ Deployment queued. Waiting for AWS CodeBuild to pick up the job...`;
  activeLogs[deploymentId].push(queuedLog);

  axios.post(orchestratorUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  })
    .then(response => {
      console.log(`[Orchestrator] ✅ Lambda triggered successfully. HTTP ${response.status}`, JSON.stringify(response.data));

      // Add a log confirming Lambda was triggered
      const triggeredLog = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] 🚀 Build job dispatched to AWS CodeBuild. Streaming real-time logs below...`;
      activeLogs[deploymentId].push(triggeredLog);
      if (activeListeners[deploymentId]) {
        activeListeners[deploymentId].forEach(listener => {
          listener.write(`data: ${JSON.stringify({ log: triggeredLog })}

`);
        });
      }
    })
    .catch(err => {
      let errorMsg = '';
      if (err.response) {
        errorMsg = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
        console.error(`[Orchestrator] ❌ Lambda call failed. ${errorMsg}`);
      } else if (err.request) {
        errorMsg = `No response (timeout or network issue): ${err.message}`;
        console.error(`[Orchestrator] ❌ ${errorMsg}`);
      } else {
        errorMsg = err.message;
        console.error(`[Orchestrator] ❌ Error setting up Lambda request: ${errorMsg}`);
      }

      // Update status to FAILED and notify SSE listeners
      const failLog = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ❌ Failed to trigger build: ${errorMsg}`;
      activeLogs[deploymentId].push(failLog);
      if (activeListeners[deploymentId]) {
        activeListeners[deploymentId].forEach(listener => {
          listener.write(`data: ${JSON.stringify({ log: failLog })}

`);
          listener.write(`data: ${JSON.stringify({ status: 'FAILED' })}

`);
        });
      }

      // Persist FAILED status to DB
      const failDb = readDb();
      const dIdx = failDb.deployments.findIndex(d => d.id === deploymentId);
      if (dIdx !== -1) failDb.deployments[dIdx].status = 'FAILED';
      const pIdx = failDb.projects.findIndex(p => p.id === project.id);
      if (pIdx !== -1) failDb.projects[pIdx].status = 'FAILED';
      writeDb(failDb);
    });

  return deployment;
}

// 5. REAL-TIME CALLBACK ENDPOINT — called by Lambda/CodeBuild to push real logs & status
// Expected POST body: { status?: string, log?: string, logs?: string[] }
app.post('/api/deployments/:id/callback', (req, res) => {
  const { id } = req.params;
  const { status, log, logs } = req.body;

  console.log(`[Callback] Received update for deployment ${id}: status=${status}, logs=${logs ? logs.length : log ? 1 : 0} lines`);

  if (!activeLogs[id]) {
    activeLogs[id] = [];
  }

  // Accept a single log line OR an array of log lines
  const logLines = logs || (log ? [log] : []);

  logLines.forEach(line => {
    activeLogs[id].push(line);
    if (activeListeners[id]) {
      activeListeners[id].forEach(listener => {
        listener.write(`data: ${JSON.stringify({ log: line })}

`);
      });
    }
  });

  // Update status in DB and broadcast to SSE listeners
  if (status) {
    const db = readDb();
    const dIdx = db.deployments.findIndex(d => d.id === id);
    if (dIdx !== -1) {
      db.deployments[dIdx].status = status;
      // Also update parent project status
      const pIdx = db.projects.findIndex(p => p.id === db.deployments[dIdx].projectId);
      if (pIdx !== -1) db.projects[pIdx].status = status;
    }
    writeDb(db);

    if (activeListeners[id]) {
      activeListeners[id].forEach(listener => {
        listener.write(`data: ${JSON.stringify({ status })}

`);
      });
    }

    // Close SSE connections when build is done
    if (status === 'READY' || status === 'FAILED') {
      if (activeListeners[id]) {
        activeListeners[id].forEach(listener => listener.end());
        delete activeListeners[id];
      }
    }
  }

  res.json({ ok: true });
});


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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Pluse Gateway and Server running on port ${PORT}`);
  console.log(`   FRONTEND_URL  : ${process.env.FRONTEND_URL || '(not set, defaulting to localhost:5173)'}`);
  console.log(`   BACKEND_URL   : ${process.env.BACKEND_URL || '(not set, defaulting to localhost:' + PORT + ')'}`);
  console.log(`   ORCHESTRATOR  : ${process.env.ORCHESTRATOR_URL || '(not set, using hardcoded fallback)'}`);
  console.log(`   GITHUB_CLIENT : ${process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID.substring(0,6) + '...' : '(not set)'}`);
});
