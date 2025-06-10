import { createRequire } from "module";
const require = createRequire(import.meta.url);

require('source-map-support').install();

import Homey from 'homey';

class P1ibApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('P1ib Homey App has been initialized');
  }

}

export default P1ibApp;
