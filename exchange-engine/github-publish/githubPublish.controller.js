import { publishToGitHub, checkRateLimit, setRateLimit } from './githubPublish.service.js';

export const handleGithubPush = async (req, res) => {
  try {
    const { projectId, project, body } = req;
    const { seoName } = project;
    const { envType } = body;

    if (!projectId || !seoName) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing projectId/seoName',
      });
    }

    const environment = envType.toLowerCase();

    const isLimited = await checkRateLimit(projectId, environment);
    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before pushing again. Try after 2 minutes.',
      });
    }

    await publishToGitHub(projectId, seoName, environment);
    setRateLimit(projectId, environment);

    res.status(200).json({
      success: true,
      message: 'Changes successfully pushed to Github.',
    });
  } catch (err) {
    console.error('Error in controller:', err.message);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
    });
  }
};
