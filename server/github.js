import { Http } from './http.js';
import { Log } from './log.js';

const logger = Log.create('github');

class GithubApi {
  getServiceJsonUrl(repository, head) {
    return `https://raw.githubusercontent.com/${repository}/${head}/service.json`;
  }

  getRepositoryUrl(repository) {
    return `https://github.com/${repository}`;
  }

  getCloneUrl(repository) {
    return this.getRepositoryUrl(repository) + '.git';
  }

  getServiceFromWebhook(pushWebHook) {
    try {
      const head = pushWebHook.ref ? pushWebHook.ref.replace(/^refs\/.+\//, '') : 'master';
      const repository = pushWebHook.repository.full_name;

      if (pushWebHook.repository.private) {
        throw new Error('Private repositories not allowed');
      }

      return this.getServiceFromRepository(repository, head);
    } catch (error) {
      logger.debug(pushWebHook);
      logger.error(error);
      throw error;
    }
  }

  getServiceFromRepository(repository, head = 'master') {
    return {
      repository,
      head,
      url: this.getRepositoryUrl(repository),
      configurationUrl: this.getServiceJsonUrl(repository, head),
    }
  }

  async exists(repository) {
    const requestOptions = { method: 'HEAD' };
    const response = await Http.fetch(this.getRepositoryUrl(repository), requestOptions);

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

export const GitHub = new GithubApi();