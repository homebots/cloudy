import { Http } from './http.js';
import { Log } from './log.js';

const getServiceJsonUrl = (repo, head) => `https://raw.githubusercontent.com/${repo}/${head}/service.json`;
const logger = Log.create('github');

class GithubApi {
  async getServiceFromWebhook(pushWebHook) {
    try {
      const head = pushWebHook.ref.replace(/^refs\/.+\//, '');
      const repository = pushWebHook.repository.full_name;

      if (pushWebHook.repository.private) {
        throw new Error('Private repositories not allowed');
      }

      return {
        repository,
        url: pushWebHook.repository.url,
        cloneUrl: pushWebHook.repository.clone_url,
        configurationUrl: getServiceJsonUrl(repository, head),
        head,
      };
    } catch (error) {
      logger.debug(pushWebHook);
      logger.error(error);
      throw error;
    }
  }

  async exists(repository) {
    const requestOptions = { method: 'HEAD' };
    const response = await Http.fetch('https://github.com/' + repository, requestOptions);

    return response.ok;
  }

  async fetchServiceConfiguration(configurationUrl) {
    const headers = {
      'user-agent': 'homebots/cloudy',
      'pragma': 'no-cache',
      'cache-control': 'no-cache',
    };

    const requestOptions = {
      auth: '86869c12a694a6a6f660:590386f1067213fb177ed690b961471e5c7082f3',
      headers,
    }

    try {
      const configJson = await Http.fetch(configurationUrl, requestOptions);
      const config = JSON.parse(configJson.body.toString('utf8'));
      logger.log(`found service configuration at ${configurationUrl}`, config);

      return config;
    } catch (error) {
      logger.log(`no service configuration found at ${configurationUrl}`);
      return {};
    }
  }
}

export const Github = new GithubApi();