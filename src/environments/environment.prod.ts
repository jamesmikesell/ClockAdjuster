import { version } from './version';

export const environment = {
  production: true,
  version: version
};

document.write('<script src="assets/service-worker-registration.js"></script>');
