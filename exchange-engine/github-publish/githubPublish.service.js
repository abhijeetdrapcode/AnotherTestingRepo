import { common_set_method, redis_get_method } from 'drapcode-redis';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import simpleGit from 'simple-git';
import fetch from 'node-fetch';

import {
  createReadMeFile,
  createSetupScriptFile,
  createDumpScriptFile,
  createDeployDockerScript,
  createDockerFile,
  createDockerReadme,
  createSetupWithDockerScript,
  sampleEnvContent,
  surfaceStopScript,
  engineStopScript,
  surfaceStartScript,
  engineStartScript,
} from './githubPublish.scriptFiles';

dotenv.config();

const BUILD_FOLDER = process.env.BUILD_FOLDER || '';
const REPO_PATH = process.env.REPO_PATH || '';
const APP_PATH = process.env.APP_PATH || '';
const PROJECT_CONFIG = process.env.BUILD_FOLDER || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const USERNAME = process.env.NAME || '';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

function checkRequiredVars() {
  const requiredVars = {
    BUILD_FOLDER,
    REPO_PATH,
    APP_PATH,
    PROJECT_CONFIG,
    GITHUB_TOKEN,
    USERNAME,
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      throw new Error(`Missing Environment variable: ${key}`);
    }
  }
}

let octokit;
const initializeOctokit = async () => {
  if (!octokit) {
    const { Octokit } = await import('@octokit/rest');
    octokit = new Octokit({ auth: GITHUB_TOKEN, request: { fetch } });
  }
};

const getStateFilePath = (projectId) => path.join(REPO_PATH, `.${projectId}_publish_state.json`);

const updateState = async (projectId, step, status = 'in_progress', metadata = {}) => {
  const stateFile = getStateFilePath(projectId);
  const state = {
    step,
    status,
    timestamp: new Date().toISOString(),
    projectId,
    metadata,
  };

  await fs.writeJson(stateFile, state, { spaces: 2 });
};

const getState = async (projectId) => {
  const stateFile = getStateFilePath(projectId);
  try {
    return await fs.readJson(stateFile);
  } catch (error) {
    return null;
  }
};

const clearState = async (projectId) => {
  const stateFile = getStateFilePath(projectId);
  try {
    await fs.remove(stateFile);
  } catch (error) {
    console.warn(`Warning: Failed to clear state: ${error.message}`);
  }
};

const shouldCopy = (src) => {
  const lower = path.basename(src).toLowerCase();
  const exclusions = [
    'node_modules',
    '.git',
    '.env',
    'readme.md',
    '.ds_store',
    'thumbs.db',
    '.cache',
    '.min.js',
    '.min.css',
    '.log',
  ];

  return !exclusions.some(
    (pattern) => src.includes(pattern) || lower === pattern || lower.endsWith('.log'),
  );
};

const findProjectFolderById = async (basePath, projectId) => {
  try {
    const entries = await fs.readdir(basePath);
    const matches = entries.filter(
      (folder) => folder.startsWith('project_') && folder.endsWith(projectId),
    );

    if (matches.length === 0) {
      throw new Error(`No project folder found with ID: ${projectId} in ${basePath}`);
    }

    if (matches.length > 1) {
      console.warn(`Multiple project folders found for ID ${projectId}, using first match`);
    }

    return matches[0];
  } catch (error) {
    throw new Error(`Error finding project folder: ${error.message}`);
  }
};

const hasNewFiles = async (srcDir, destDir) => {
  try {
    if (!(await fs.pathExists(srcDir))) return false;
    if (!(await fs.pathExists(destDir))) return true;

    const stack = [''];

    while (stack.length > 0) {
      const relative = stack.pop();
      const currentSrc = path.join(srcDir, relative);

      let entries;
      try {
        entries = await fs.readdir(currentSrc);
      } catch (error) {
        continue;
      }

      for (const entry of entries) {
        const relPath = path.join(relative, entry);
        const srcPath = path.join(srcDir, relPath);

        if (!shouldCopy(srcPath)) continue;

        const destPath = path.join(destDir, relPath);

        try {
          const statSrc = await fs.stat(srcPath);

          if (statSrc.isDirectory()) {
            stack.push(relPath);
            continue;
          }

          const statDest = await fs.stat(destPath).catch(() => null);
          if (!statDest || statSrc.size !== statDest.size || statSrc.mtimeMs > statDest.mtimeMs) {
            return true;
          }
        } catch (error) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    throw new Error(`Error checking for new files: ${error.message}`);
  }
};

const executeWithRetry = async (
  operation,
  maxRetries = MAX_RETRIES,
  operationName = 'GitHub operation',
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`${operationName} attempt ${attempt}/${maxRetries} failed: ${error.message}`);

      if (error.status === 429) {
        const retryAfter = parseInt(error.response?.headers?.['retry-after']) || 60;
        console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (error.status >= 500 && error.status < 600 && attempt < maxRetries) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`Server error. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (attempt === maxRetries) {
        throw new Error(`${operationName} failed after ${maxRetries} attempts: ${error.message}`);
      }

      throw error;
    }
  }
};

const createRepoIfNotExists = async (repoName) => {
  await initializeOctokit();

  return executeWithRetry(
    async () => {
      try {
        await octokit.repos.get({ owner: USERNAME, repo: repoName });
        console.log(`Repository ${repoName} already exists`);
        return false;
      } catch (error) {
        if (error.status === 404) {
          console.log(`Creating repository: ${repoName}`);
          await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: true,
            description: 'Repository generated using github publish',
          });
          console.log(`Repository ${repoName} created successfully`);
          return true;
        }
        throw error;
      }
    },
    MAX_RETRIES,
    'Create repository',
  );
};

const ensureSampleEnv = async (type, targetDir, project) => {
  try {
    const sampleEnvPath = path.join(targetDir, '.env.sample');

    if (!(await fs.pathExists(sampleEnvPath))) {
      const content = sampleEnvContent(type, project, project);
      await fs.writeFile(sampleEnvPath, content.trimStart());
      console.log(`Created .env.sample in ${type}`);
    }
  } catch (error) {
    throw new Error(`Error creating .env.sample in ${type}: ${error.message}`);
  }
};

const copyFiles = async (projectFolderName, targetFolder, projectID, seoName) => {
  try {
    await fs.ensureDir(targetFolder);

    const viewsSource = path.join(BUILD_FOLDER, 'views');
    const viewsTarget = path.join(targetFolder, 'views');
    const matchingViewFolder = path.join(viewsSource, projectID);

    if (await fs.pathExists(matchingViewFolder)) {
      console.log(`Copying views for project ${projectID}...`);
      await fs.copy(matchingViewFolder, path.join(viewsTarget, projectID), {
        filter: shouldCopy,
        overwrite: true,
      });
    } else {
      console.warn(`No views folder found for project ${projectID}`);
    }

    const projectMeta = {
      seoName,
      domainName: 'your-domain.com',
      apiDomainName: 'api.your-domain.com',
    };

    for (const dir of ['exchange-engine', 'exchange-surface']) {
      const source = path.join(APP_PATH, dir);
      const target = path.join(targetFolder, dir);

      if (!(await fs.pathExists(source))) {
        console.warn(`Source directory ${dir} does not exist, skipping...`);
        continue;
      }

      const shouldUpdate = await hasNewFiles(source, target);

      if (shouldUpdate) {
        console.log(`Copying ${dir}...`);
        await fs.copy(source, target, {
          filter: shouldCopy,
          overwrite: true,
        });
      } else {
        console.log(`No changes in ${dir}, skipping copy`);
      }

      await ensureSampleEnv(dir, target, projectMeta);
    }

    await copyProjectConfig(targetFolder, projectID, seoName, projectFolderName);

    await createDeploymentScripts(targetFolder);
  } catch (error) {
    throw new Error(`Error copying files: ${error.message}`);
  }
};

const copyProjectConfig = async (targetFolder, projectID, seoName, projectFolderName) => {
  const projectsSource = path.join(PROJECT_CONFIG, 'projects');
  const projectsTarget = path.join(targetFolder, 'projects');

  if (await fs.pathExists(projectsSource)) {
    await fs.ensureDir(projectsTarget);
    const projectFiles = await fs.readdir(projectsSource);
    let copiedCount = 0;

    for (const file of projectFiles) {
      if (file.endsWith('.json') && (file.includes(projectID) || file.includes(seoName))) {
        const src = path.join(projectsSource, file);
        const dest = path.join(projectsTarget, file);

        console.log(`Copying project config: ${file}`);
        await fs.copyFile(src, dest);
        copiedCount++;
      }
    }

    if (copiedCount === 0) {
      console.warn(`No matching project JSON files found for ${projectID}/${seoName}`);
    } else {
      console.log(`Copied ${copiedCount} project config files`);
    }
  }

  const projectConfigSource = path.join(PROJECT_CONFIG, projectFolderName);
  const projectConfigTarget = path.join(targetFolder, projectFolderName);

  if (await fs.pathExists(projectConfigSource)) {
    console.log(`Copying project config folder: ${projectFolderName}`);
    await fs.copy(projectConfigSource, projectConfigTarget, {
      filter: shouldCopy,
      overwrite: true,
    });
  }
};

const createDeploymentScripts = async (targetFolder) => {
  console.log('Creating deployment scripts...');

  const project = {
    domainName: 'your-domain.com',
    apiDomainName: 'api.your-domain.com',
  };

  const scriptFunctions = [
    { name: 'README', fn: () => createReadMeFile(targetFolder, project) },
    { name: 'setup script', fn: () => createSetupScriptFile(targetFolder) },
    { name: 'dump script', fn: () => createDumpScriptFile(targetFolder) },
    { name: 'docker deploy', fn: () => createDeployDockerScript(targetFolder) },
    { name: 'dockerfile', fn: () => createDockerFile(targetFolder) },
    { name: 'docker readme', fn: () => createDockerReadme(targetFolder) },
    { name: 'setup with docker', fn: () => createSetupWithDockerScript(targetFolder) },
  ];

  const pm2Scripts = [
    { name: 'start-engine.sh', content: engineStartScript },
    { name: 'start-surface.sh', content: surfaceStartScript },
    { name: 'stop-engine.sh', content: engineStopScript },
    { name: 'stop-surface.sh', content: surfaceStopScript },
  ];

  let successCount = 0;

  for (const script of scriptFunctions) {
    try {
      await script.fn();
      successCount++;
    } catch (error) {
      console.warn(`Failed to create ${script.name}: ${error.message}`);
    }
  }

  const scriptsDir = path.join(targetFolder);
  await fs.ensureDir(scriptsDir);

  for (const script of pm2Scripts) {
    try {
      await fs.writeFile(path.join(scriptsDir, script.name), script.content);
      await fs.chmod(path.join(scriptsDir, script.name), 0o755);
      successCount++;
      console.log(`Created script: ${script.name}`);
    } catch (error) {
      console.warn(`Failed to create ${script.name}: ${error.message}`);
    }
  }

  console.log(`Created ${successCount}/${scriptFunctions.length + pm2Scripts.length} script files`);
};

const setupGit = async (repoName, targetFolder, branchName) => {
  try {
    await fs.ensureDir(targetFolder);
    const git = simpleGit(targetFolder);

    if (!(await git.checkIsRepo())) {
      console.log('Initializing git repository...');
      await git.init();
    }

    const repoUrl = `https://${USERNAME}:${GITHUB_TOKEN}@github.com/${USERNAME}/${repoName}.git`;
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin');

    if (!origin) {
      await git.addRemote('origin', repoUrl);
    } else if (origin.refs.fetch !== repoUrl) {
      await git.removeRemote('origin');
      await git.addRemote('origin', repoUrl);
    }

    await git.fetch();

    const statusBeforeBranch = await git.status();
    if (statusBeforeBranch.files.length > 0) {
      console.log('Auto committing uncommitted changes before switching branches...');
      await git.add('.');
      await git.commit(`Auto-commit before switching to ${branchName}`);
    }

    const branches = await git.branch(['-a']);
    const remoteBranchExists = branches.all.includes(`remotes/origin/${branchName}`);
    const localBranchExists = branches.all.includes(branchName);

    if (!localBranchExists) {
      if (remoteBranchExists) {
        await git.checkout(['-b', branchName, `origin/${branchName}`]);
      } else {
        await git.checkoutLocalBranch(branchName);
      }
    } else {
      await git.checkout(branchName);
    }

    return true;
  } catch (error) {
    if (error.message.includes('Authentication failed')) {
      throw new Error('GitHub authentication failed. Check token permissions.');
    }
    throw new Error(`Git setup error: ${error.message}`);
  }
};

const commitAndPushChanges = async (repoName, targetFolder, branchName) => {
  try {
    const git = simpleGit(targetFolder);

    const status = await git.status();
    if (status.files.length === 0) {
      console.log('No new changes to commit');

      await executeWithRetry(
        async () => {
          await git.push(['--set-upstream', 'origin', branchName]);
        },
        2,
        'Git push (no changes)',
      );

      return false;
    }

    await git.add('.');
    // const projectName = repoName;
    // const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
    const timestamp = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
    const formattedTimestamp = timestamp.replace(',', '').replace(/\//g, '-');
    const formattedRepoName = repoName.replace(/^project_/, '');
    await git.commit(`Published in ${formattedRepoName} at ${formattedTimestamp}`);

    await executeWithRetry(
      async () => {
        await git.push(['--set-upstream', 'origin', branchName]);
      },
      2,
      'Git push',
    );

    console.log(`Successfully pushed to ${branchName}`);
    return true;
  } catch (error) {
    throw new Error(`Git push error: ${error.message}`);
  }
};

const performCleanup = async (projectId, repoName, targetFolder) => {
  console.log('Starting cleanup process...');
  const errors = [];
  console.log('This is the projectID: ', projectId);
  console.log('This is the repoName: ', repoName);

  try {
    if (await fs.pathExists(targetFolder)) {
      console.log('Cleanup: Removing local files...');
      try {
        await fs.remove(targetFolder);
        console.log(`Removed target folder: ${targetFolder}`);
      } catch (error) {
        errors.push(`Failed to remove target folder: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`Cleanup process error: ${error.message}`);
  }

  if (errors.length > 0) {
    console.error('Cleanup completed with errors:', errors.join('; '));
    return false;
  }

  console.log('Cleanup completed successfully');
  return true;
};

export const publishToGitHub = async (projectID, seoName, environment = 'preview') => {
  if (!projectID?.trim() || !seoName?.trim()) {
    throw new Error('Invalid parameters: projectID and seoName must be non-empty strings');
  }
  checkRequiredVars();
  let createdNewRepo = false;
  let currentStep = 'initialization';
  try {
    console.log(`Starting publish process for project ${projectID} (${seoName})`);
    const branchName = environment === 'production' ? 'main' : environment;
    const repoName = `project_${seoName}`;
    const targetFolder = path.join(REPO_PATH, repoName);

    const projectFolderName = await findProjectFolderById(PROJECT_CONFIG, projectID);

    console.log(`Configuration:
- Project ID: ${projectID}
- SEO Name: ${seoName}
- Repository: ${repoName}
- Branch: ${branchName}
- Project Folder: ${projectFolderName}`);

    currentStep = 'creating_repo';
    await updateState(projectID, currentStep);
    createdNewRepo = await createRepoIfNotExists(repoName);

    currentStep = 'setting_up_git';
    await updateState(projectID, currentStep);
    await setupGit(repoName, targetFolder, branchName);

    currentStep = 'copying_files';
    await updateState(projectID, currentStep);
    await copyFiles(projectFolderName, targetFolder, projectID, seoName);

    currentStep = 'pushing_code';
    await updateState(projectID, currentStep);
    const hasChanges = await commitAndPushChanges(repoName, targetFolder, branchName);

    currentStep = 'completed';
    await updateState(projectID, currentStep, 'success', {
      repoName,
      branchName,
      environment,
      hasChanges,
    });

    console.log(`Successfully published ${repoName} to GitHub on branch ${branchName}`);

    await clearState(projectID);

    return {
      success: true,
      repoName,
      branchName,
      environment,
      hasChanges,
      url: `https://github.com/${USERNAME}/${repoName}/tree/${branchName}`,
    };
  } catch (error) {
    console.error(
      `Publish failed for project ${projectID} at step ${currentStep}: ${error.message}`,
    );

    await updateState(projectID, currentStep, 'error', {
      errorMessage: error.message,
      errorStep: currentStep,
      timestamp: new Date().toISOString(),
      stack: error.stack?.substring(0, 1000),
    });

    const targetFolder = path.join(REPO_PATH, `project_${seoName}`);
    await performCleanup(projectID, `project_${seoName}`, targetFolder, createdNewRepo);

    throw new Error(`GitHub publish failed at ${currentStep}: ${error.message}`);
  }
};

const GITHUB_RATE_LIMIT_TTL = 2 * 60;

export const checkRateLimit = async (projectId, environment) => {
  try {
    const key = `exchange/github_publish/${projectId}/${environment}`;
    const existing = await redis_get_method(key);
    return !!existing;
  } catch (error) {
    console.warn('Rate limit check failed:', error.message);
    return false;
  }
};

export const setRateLimit = (projectId, environment) => {
  try {
    const key = `exchange/github_publish/${projectId}/${environment}`;
    common_set_method(key, true, GITHUB_RATE_LIMIT_TTL);
  } catch (error) {
    console.warn('Failed to set rate limit:', error.message);
  }
};

export const getPublishStatus = async (projectId) => {
  const state = await getState(projectId);
  return {
    projectId,
    currentState: state,
    isProcessing: state?.status === 'in_progress',
  };
};

export const cleanupOldStates = async (maxAge = 24 * 60 * 60 * 1000) => {
  try {
    const files = await fs.readdir(REPO_PATH);
    const stateFiles = files.filter((file) => file.endsWith('_publish_state.json'));

    let cleaned = 0;
    for (const file of stateFiles) {
      const filePath = path.join(REPO_PATH, file);
      const stats = await fs.stat(filePath);

      if (Date.now() - stats.mtimeMs > maxAge) {
        await fs.remove(filePath);
        cleaned++;
        console.log(`Cleaned up old state file: ${file}`);
      }
    }

    console.log(`Cleaned up ${cleaned} old state files`);
    return cleaned;
  } catch (error) {
    console.error(`Error cleaning up old states: ${error.message}`);
    return 0;
  }
};
