import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import chaiExclude from 'chai-exclude';
import { constants, promises as fs } from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import { Application } from 'spectron';
import { Settings } from 'src/app/models/settings.model';
import { Helpers } from 'test/lib/helpers';

const electronPath: any = require('electron');

export class Tests {
  public app: Application;
  public helpers: Helpers;

  constructor(private dataFileName: string, private hasSettings = true) {
    this.helpers = new Helpers(this);
    chai.should();
    chai.use(chaiAsPromised);
    chai.use(chaiExclude);
  }

  /**
   * Before and after hooks to run prior to the tests
   */
  public runHooks(
    waitUntilWindowReady = true,
    waitUntilEnvironmentLoaded = true,
    alterSettings = null
  ) {
    // copy data files before starting tests
    before(async () => {
      await this.prepareStorageFolder();
      await this.copyEnvironments();
      await this.copySettings(alterSettings);

      this.app = new Application({
        path: electronPath,
        quitTimeout: 2000,
        waitTimeout : 999999999999999,
        startTimeout: 999999999999999,
        args: [
          '-r',
          path.join(__dirname, './electron-mocks.js'),
          './dist',
          '--tests'
        ],
        webdriverOptions: {
          deprecationWarnings: false
        }
      });

      await this.app.start();
    });

    after(async () => {
      if (this.app && this.app.isRunning()) {
        await this.app.stop();
      }
    });

    if (waitUntilWindowReady) {
      this.waitForWindowReady();
    }

    if (waitUntilEnvironmentLoaded) {
      this.waitForEnvironmentLoaded();
    }
  }

  /**
   * Wait for window to be ready and environments loaded
   */
  public waitForWindowReady() {
    it('Should wait for window to be ready', async () => {
      this.timeout(0);
      await this.app.client.waitUntilWindowLoaded(999999999999999);
    });
  }

  /**
   * Wait for environement to be loaded by checking for active environment menu item
   */
  public waitForEnvironmentLoaded() {
    it('Should load the environment', async () => {
      await this.helpers.assertHasActiveEnvironment();
    });
  }

  /**
   * Empty the storage folder and (re)create it if needed
   */
  private async prepareStorageFolder() {
    try {
      const storagePath = './tmp/storage/';

      await fs.rmdir(storagePath, {
        recursive: true
      });

      await mkdirp(storagePath);
    } catch (err) {}
  }

  /**
   * Copy environments.json file if exists
   */
  private async copyEnvironments() {
    const environmentsFilePath =
      './test/data/' + this.dataFileName + '/environments.json';
    let environmentsFileExists = true;

    try {
      await fs.access(environmentsFilePath, constants.F_OK);
    } catch (error) {
      environmentsFileExists = false;
    }

    try {
      if (environmentsFileExists) {
        await fs.copyFile(
          './test/data/' + this.dataFileName + '/environments.json',
          './tmp/storage/environments.json'
        );
      }
    } catch (err) {}
  }

  /**
   * Copy settings.json file if exists
   */
  private async copySettings(alterSettings: any) {
    const settingsDestFilePath = './tmp/storage/settings.json';
    let settingssFilePath = `./test/data/${this.dataFileName}/settings.json`;
    let settingsFileExists = true;

    try {
      await fs.access(settingssFilePath, constants.F_OK);
    } catch (error) {
      settingsFileExists = false;
    }

    // if no custom file provided for the test, revert to the generic one
    if (!settingsFileExists) {
      settingssFilePath = `./test/data/settings.json`;
    }

    try {
      if (this.hasSettings) {
        await fs.copyFile(settingssFilePath, settingsDestFilePath);

        if (alterSettings) {
          const settingsFile = await fs.readFile(settingsDestFilePath, 'utf-8');
          let settings: Settings = JSON.parse(settingsFile);
          settings = { ...settings, ...alterSettings };
          await fs.writeFile(settingsDestFilePath, JSON.stringify(settings));
        }
      }
    } catch (err) {}
  }
}
