const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── DynamoDB Setup ───────────────────────────────────────────────────────────
const dynamoConfig = { region: process.env.AWS_REGION || 'ap-south-1' };
if (process.env.AWS_ACCESS_KEY_ID) {
  dynamoConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
const dynamoClient = new DynamoDBClient(dynamoConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const PROJECTS_TABLE   = process.env.DYNAMO_PROJECTS_TABLE   || 'pluse-projects';
const DEPLOYMENTS_TABLE = process.env.DYNAMO_DEPLOYMENTS_TABLE || 'pluse-deployments';

// ─── In-Memory SSE Buffers ────────────────────────────────────────────────────
const activeLogs      = {};  // deploymentId → string[]
const activeListeners = {};  // deploymentId → Response[]

// GitHub OAuth config
const CLIENT_ID     = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// ─── Utility ──────────────────────────────────────────────────────────────────
function getUserId(req) {
  return req.headers['x-user-id'] || req.body?.owner || 'anonymous';
}

function broadcastLog(id, line) {
  if (activeListeners[id]) {
    activeListeners[id].forEach(l => l.write(`data: ${JSON.stringify({ log: line })}\n\n`));
  }
}

function broadcastStatus(id, status, extraData = {}) {
  if (activeListeners[id]) {
    activeListeners[id].forEach(l => l.write(`data: ${JSON.stringify({ status, ...extraData })}\n\n`));
  }
}

// ─── DynamoDB Helpers ─────────────────────────────────────────────────────────
async function getProjectsByUser(userId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: PROJECTS_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false
    }));
    return result.Items || [];
  } catch (err) {
    console.error('[DynamoDB] getProjectsByUser error:', err.message);
    return [];
  }
}

async function getProjectById(userId, projectId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: PROJECTS_TABLE,
      Key: { userId, projectId }
    }));
    return result.Item || null;
  } catch (err) {
    console.error('[DynamoDB] getProjectById error:', err.message);
    return null;
  }
}

async function saveProject(projectData) {
  try {
    await docClient.send(new PutCommand({ TableName: PROJECTS_TABLE, Item: projectData }));
  } catch (err) {
    console.error('[DynamoDB] saveProject error:', err.message);
    throw err;
  }
}

async function deleteProject(userId, projectId) {
  try {
    await docClient.send(new DeleteCommand({ TableName: PROJECTS_TABLE, Key: { userId, projectId } }));
  } catch (err) {
    console.error('[DynamoDB] deleteProject error:', err.message);
    throw err;
  }
}

async function getDeploymentsByProject(projectId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: DEPLOYMENTS_TABLE,
      IndexName: 'projectId-index',
      KeyConditionExpression: 'projectId = :pid',
      ExpressionAttributeValues: { ':pid': projectId },
      ScanIndexForward: false
    }));
    return result.Items || [];
  } catch (err) {
    console.error('[DynamoDB] getDeploymentsByProject error:', err.message);
    return [];
  }
}

async function getDeploymentById(deploymentId) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: DEPLOYMENTS_TABLE,
      Key: { deploymentId }
    }));
    return result.Item || null;
  } catch (err) {
    console.error('[DynamoDB] getDeploymentById error:', err.message);
    return null;
  }
}

async function saveDeployment(deploymentData) {
  try {
    await docClient.send(new PutCommand({ TableName: DEPLOYMENTS_TABLE, Item: deploymentData }));
  } catch (err) {
    console.error('[DynamoDB] saveDeployment error:', err.message);
    throw err;
  }
}

async function deleteDeployment(deploymentId) {
  try {
    await docClient.send(new DeleteCommand({ TableName: DEPLOYMENTS_TABLE, Key: { deploymentId } }));
  } catch (err) {
    console.error('[DynamoDB] deleteDeployment error:', err.message);
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'pluse-server' });
});

// ─── 1. AUTH ENDPOINTS ────────────────────────────────────────────────────────
app.get('/api/auth/github', (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const BACKEND_URL  = process.env.BACKEND_URL  || `http://localhost:${PORT}`;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/?auth_error=` + encodeURIComponent('GitHub OAuth is not configured on the server. Please add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to your environment and restart.'));
  }
  const redirectUri = `${BACKEND_URL}/api/auth/callback`;
  const githubUrl   = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;
  res.redirect(githubUrl);
});

app.get('/api/auth/callback', async (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}/?auth_error=No+code+provided+from+GitHub`);

  try {
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }, { headers: { Accept: 'application/json' } });

    const { access_token, error, error_description } = tokenResponse.data;
    if (error) {
      return res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(error_description || error)}`);
    }

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json', 'User-Agent': 'Pluse-App' }
    });

    const { login, name, avatar_url } = userResponse.data;
    res.redirect(`${FRONTEND_URL}/?auth_success=true&token=${access_token}&login=${login}&name=${encodeURIComponent(name || login)}&avatar=${avatar_url}`);
  } catch (err) {
    console.error('OAuth Callback Error:', err.message);
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// ─── 2. GITHUB REPOSITORY ENDPOINTS ──────────────────────────────────────────
app.get('/api/github/repos', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: GitHub access token is required.' });

  if (token === 'mocktoken') {
    return res.json([
      { id: 101, name: 'pluse-project-demo', description: 'Vercel clone live demo project', default_branch: 'main', updated_at: new Date().toISOString(), owner: { login: 'mockuser' } },
      { id: 102, name: 'react-app-example', description: 'React + Vite project template', default_branch: 'master', updated_at: new Date().toISOString(), owner: { login: 'mockuser' } }
    ]);
  }

  try {
    const response = await axios.get('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Pluse-App' }
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
    console.error('Error fetching GitHub repos:', err.message);
    res.status(500).json({ error: 'Failed to fetch repositories: ' + err.message });
  }
});

// Enhanced framework detection — checks config files AND dependencies
app.get('/api/github/repos/:owner/:repo/framework', async (req, res) => {
  const { owner, repo } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });
  if (token === 'mocktoken') return res.json({ framework: 'static', detected: true, confidence: 'low' });

  let pkg = {};
  let rootFiles = [];

  try {
    const pkgResp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Pluse-App' }
    });
    pkg = JSON.parse(Buffer.from(pkgResp.data.content, 'base64').toString('utf8'));
  } catch { /* no package.json — static site */ }

  try {
    const rootResp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Pluse-App' }
    });
    rootFiles = rootResp.data.map(f => f.name);
  } catch { /* can't list root */ }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Detection — config files take precedence over package dependencies
  let framework = 'static';
  let confidence = 'low';

  if (rootFiles.some(f => f.startsWith('astro.config'))) {
    framework = 'astro';         confidence = 'high';
  } else if (rootFiles.some(f => f.startsWith('nuxt.config'))) {
    framework = 'nuxt';          confidence = 'high';
  } else if (rootFiles.some(f => f === 'remix.config.js' || f === 'remix.config.ts' || f === 'remix.config.cjs')) {
    framework = 'remix';         confidence = 'high';
  } else if (rootFiles.some(f => f.startsWith('gatsby-config'))) {
    framework = 'gatsby';        confidence = 'high';
  } else if (rootFiles.includes('angular.json')) {
    framework = 'angular';       confidence = 'high';
  } else if (rootFiles.some(f => f.startsWith('svelte.config'))) {
    framework = 'svelte';        confidence = 'high';
  } else if (rootFiles.some(f => f.startsWith('next.config'))) {
    framework = 'next';          confidence = 'high';
  } else if (deps['next']) {
    framework = 'next';          confidence = 'high';
  } else if (deps['astro']) {
    framework = 'astro';         confidence = 'medium';
  } else if (deps['nuxt'] || deps['nuxt3'] || deps['@nuxt/kit']) {
    framework = 'nuxt';          confidence = 'medium';
  } else if (deps['@remix-run/node'] || deps['@remix-run/react']) {
    framework = 'remix';         confidence = 'medium';
  } else if (deps['gatsby']) {
    framework = 'gatsby';        confidence = 'medium';
  } else if (deps['@angular/core']) {
    framework = 'angular';       confidence = 'medium';
  } else if (deps['@sveltejs/kit']) {
    framework = 'svelte';        confidence = 'high';
  } else if (deps['svelte']) {
    framework = 'svelte';        confidence = 'medium';
  } else if (deps['vite'] && (deps['react'] || deps['vue'] || deps['solid-js'])) {
    framework = 'vite';          confidence = 'high';
  } else if (deps['vite']) {
    framework = 'vite';          confidence = 'medium';
  } else if (deps['react-scripts']) {
    framework = 'react-cra';     confidence = 'high';
  } else if (deps['vue'] && !deps['vite']) {
    framework = 'vue';           confidence = 'medium';
  } else if (deps['react']) {
    framework = 'react-cra';     confidence = 'low';
  } else if (Object.keys(deps).length > 0) {
    framework = 'static';        confidence = 'low';
  }

  res.json({ framework, detected: true, confidence, packageJson: pkg, rootFiles });
});

// ─── 3. PROJECT MANAGEMENT ────────────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
  const userId = getUserId(req);
  if (!userId || userId === 'anonymous') {
    return res.status(401).json({ error: 'User ID required. Include x-user-id header.' });
  }
  const projects = await getProjectsByUser(userId);
  res.json(projects);
});

app.post('/api/projects', async (req, res) => {
  const { name, repository, branch, framework, buildCommand, outputDirectory, env, owner } = req.body;
  const userId = owner || getUserId(req);

  if (!name || !repository) {
    return res.status(400).json({ error: 'Project name and repository are required.' });
  }

  // Duplicate name check (per user)
  const existingProjects = await getProjectsByUser(userId);
  if (existingProjects.find(p => p.name?.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'A project with this name already exists on Pluse.' });
  }

  const projectId   = uuidv4();
  const subDomain   = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const pendingUrl  = `https://${subDomain}.pulse.jo3.org`;  // Real URL set after deploy

  const newProject = {
    userId,             // DynamoDB PK
    projectId,          // DynamoDB SK
    id: projectId,      // Frontend alias
    name,
    repository,
    branch: branch || 'main',
    framework: framework || 'static',
    buildCommand: buildCommand || getDefaultBuildCommand(framework),
    outputDirectory: outputDirectory || getDefaultOutputDir(framework),
    env: env || [],
    url: pendingUrl,
    deployedUrl: null,
    createdAt: new Date().toISOString(),
    owner: userId,
    status: 'QUEUED'
  };

  try {
    await saveProject(newProject);
    const deployment = await triggerDeployment(newProject);
    res.json({ project: newProject, deployment });
  } catch (err) {
    console.error('Failed to create project:', err.message);
    res.status(500).json({ error: 'Failed to create project: ' + err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  const project = await getProjectById(userId, id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const deployments = await getDeploymentsByProject(id);
  res.json({ project, deployments });
});

app.post('/api/projects/:id/redeploy', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  const project = await getProjectById(userId, id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  // Reset project status
  await saveProject({ ...project, status: 'QUEUED' });

  const deployment = await triggerDeployment(project);
  res.json({ deployment });
});

app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const userId = getUserId(req);

  const project = await getProjectById(userId, id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  try {
    await deleteProject(userId, id);

    // Remove all associated deployments
    const deployments = await getDeploymentsByProject(id);
    await Promise.all(deployments.map(dep => deleteDeployment(dep.deploymentId)));

    res.json({ success: true, message: 'Project and all deployments deleted.' });
  } catch (err) {
    console.error('Delete project error:', err.message);
    res.status(500).json({ error: 'Failed to delete project: ' + err.message });
  }
});

// ─── 4. SSE LOG STREAM ────────────────────────────────────────────────────────
app.get('/api/deployments/:id/logs', async (req, res) => {
  const { id } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const deployment = await getDeploymentById(id);
  const logs = activeLogs[id] || [];

  // Replay buffered logs to the new connection
  logs.forEach(log => res.write(`data: ${JSON.stringify({ log })}\n\n`));

  if (deployment) {
    res.write(`data: ${JSON.stringify({ status: deployment.status })}\n\n`);
  }

  if (!activeListeners[id]) activeListeners[id] = [];
  activeListeners[id].push(res);

  req.on('close', () => {
    activeListeners[id] = (activeListeners[id] || []).filter(l => l !== res);
  });
});

// ─── 5. DEPLOYMENT BUILD PIPELINE ────────────────────────────────────────────
async function triggerDeployment(project) {
  const deploymentId = uuidv4();

  const deployment = {
    deploymentId,               // DynamoDB PK
    id: deploymentId,           // Frontend alias
    projectId: project.projectId || project.id,
    userId: project.userId || project.owner,
    status: 'QUEUED',
    url: project.url,
    createdAt: new Date().toISOString(),
  };

  await saveDeployment(deployment);
  activeLogs[deploymentId] = [];

  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'https://5a7qmkoqm5.execute-api.ap-south-1.amazonaws.com//orchestrate';
  const BACKEND_URL     = process.env.BACKEND_URL || `http://localhost:${PORT}`;
  const callbackUrl     = `${BACKEND_URL}/api/deployments/${deploymentId}/callback`;

  console.log(`[Orchestrator] Invoking Lambda for project "${project.name}" (${deploymentId})`);

  const queuedLog = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ⏳ Deployment queued. Waiting for AWS CodeBuild to pick up the job...`;
  activeLogs[deploymentId].push(queuedLog);

  const payload = {
    projectId: project.projectId || project.id,
    deploymentId,
    name: project.name,
    repository: project.repository,
    branch: project.branch,
    framework: project.framework,
    installCmd: getInstallCommand(project.framework),
    buildCommand: project.buildCommand,
    outputDirectory: project.outputDirectory,
    env: project.env,
    url: project.url,
    callbackUrl,
  };

  axios.post(orchestratorUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  }).then(response => {
    console.log(`[Orchestrator] ✅ Lambda triggered. HTTP ${response.status}`);
    const triggeredLog = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] 🚀 Build job dispatched to AWS CodeBuild. Streaming real-time logs below...`;
    activeLogs[deploymentId].push(triggeredLog);
    broadcastLog(deploymentId, triggeredLog);
  }).catch(async err => {
    const errorMsg = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : `No response received: ${err.message}`;

    console.error(`[Orchestrator] ❌ Lambda call failed: ${errorMsg}`);

    const failLog = `[${new Date().toISOString().split('T')[1].slice(0, -1)}] ❌ Failed to trigger build: ${errorMsg}`;
    activeLogs[deploymentId].push(failLog);
    broadcastLog(deploymentId, failLog);
    broadcastStatus(deploymentId, 'FAILED');

    const dep = await getDeploymentById(deploymentId);
    if (dep) await saveDeployment({ ...dep, status: 'FAILED' });
    await saveProject({ ...project, status: 'FAILED' });
  });

  return deployment;
}

// ─── 6. CALLBACK ENDPOINT (called by Lambda/CodeBuild) ────────────────────────
// Body: { status?, log?, logs?: string[], deployedUrl? }
app.post('/api/deployments/:id/callback', async (req, res) => {
  const { id } = req.params;
  const { status, log, logs, deployedUrl } = req.body;

  console.log(`[Callback] Deployment ${id}: status=${status}, lines=${logs?.length ?? (log ? 1 : 0)}, deployedUrl=${deployedUrl || 'none'}`);

  if (!activeLogs[id]) activeLogs[id] = [];

  const logLines = logs || (log ? [log] : []);
  logLines.forEach(line => {
    activeLogs[id].push(line);
    broadcastLog(id, line);
  });

  if (status) {
    const dep = await getDeploymentById(id);
    if (dep) {
      const updatedDep = { ...dep, status };
      if (deployedUrl) updatedDep.url = deployedUrl;
      await saveDeployment(updatedDep);

      // Update parent project status + real deployed URL
      const proj = await getProjectById(dep.userId, dep.projectId);
      if (proj) {
        const updatedProj = { ...proj, status };
        if (deployedUrl) {
          updatedProj.url = deployedUrl;
          updatedProj.deployedUrl = deployedUrl;
        }
        await saveProject(updatedProj);
      }
    }

    broadcastStatus(id, status, deployedUrl ? { url: deployedUrl } : {});

    // Close SSE connections once build is terminal
    if (status === 'READY' || status === 'FAILED') {
      if (activeListeners[id]) {
        activeListeners[id].forEach(l => l.end());
        delete activeListeners[id];
      }
    }
  }

  res.json({ ok: true });
});

// ─── Framework Defaults ───────────────────────────────────────────────────────
function getDefaultBuildCommand(framework) {
  switch (framework) {
    case 'next':      return 'npm run build';
    case 'vite':      return 'npm run build';
    case 'react-cra': return 'npm run build';
    case 'vue':       return 'npm run build';
    case 'svelte':    return 'npm run build';
    case 'angular':   return 'npm run build';
    case 'astro':     return 'npm run build';
    case 'nuxt':      return 'npm run build';
    case 'gatsby':    return 'npm run build';
    case 'remix':     return 'npm run build';
    default:          return 'echo "Static build: No compilation required"';
  }
}

function getDefaultOutputDir(framework) {
  switch (framework) {
    case 'next':      return '.next';
    case 'vite':      return 'dist';
    case 'react-cra': return 'build';
    case 'vue':       return 'dist';
    case 'svelte':    return 'build';
    case 'angular':   return 'dist';
    case 'astro':     return 'dist';
    case 'nuxt':      return '.output/public';
    case 'gatsby':    return 'public';
    case 'remix':     return 'public';
    default:          return '.';
  }
}

function getInstallCommand(framework) {
  switch (framework) {
    case 'static':    return 'echo "No install required for static site"';
    default:          return 'npm install';
  }
}

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Pluse Server running on port ${PORT}`);
  console.log(`   FRONTEND_URL    : ${process.env.FRONTEND_URL || '(not set — defaulting to localhost:5173)'}`);
  console.log(`   BACKEND_URL     : ${process.env.BACKEND_URL  || '(not set — defaulting to localhost:' + PORT + ')'}`);
  console.log(`   ORCHESTRATOR    : ${process.env.ORCHESTRATOR_URL || '(not set)'}`);
  console.log(`   AWS_REGION      : ${process.env.AWS_REGION   || 'ap-south-1'}`);
  console.log(`   PROJECTS TABLE  : ${PROJECTS_TABLE}`);
  console.log(`   DEPLOYMENTS TBL : ${DEPLOYMENTS_TABLE}`);
  console.log(`   GITHUB_CLIENT   : ${process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID.substring(0,8) + '...' : '(not set)'}`);
  console.log('');
});
