import { browser, by, element,logger } from '../utils';
import { HookScenarioResult, Status } from 'cucumber';
import { WriteStream, ensureDirSync, createWriteStream } from 'fs-extra';
import * as path from 'path';
const glob = require('glob');
const fs = require('fs-extra');

let debugFileName: string;
let rerunTestCase: HookScenarioResult;
let featureFileData: any = [];

const OUTPUT_DIR = "../out/tests/e2e";

const { After, AfterAll, Before, setDefaultTimeout } = require("cucumber");

interface World {
    'attach': ((arg1: string | Buffer, arg2: string) => void);
};

setDefaultTimeout(360000);

Before(function (testCase: HookScenarioResult) {
    /**
     * outputting feature file location and scenario name for each run
     */
    console.log("\n");
    logger.info("*** Test Case: " + testCase.sourceLocation.uri + " ***");
    logger.info("*** Scenario: " + testCase.pickle.name + " ***");

    /**
     * create directory to store screenshots
     */
    let featureTagName: string = testCase.pickle.tags[0].name.replace('@', '');
    debugFileName = OUTPUT_DIR + "/debug."+Date.now()+ "." +featureTagName+".log";
    browser.params.folderName = OUTPUT_DIR + "/screenshots/" + featureTagName + "/";
    browser.params.apiDirectory = "../out/tests/e2e/api/" + featureTagName + "/";
    browser.params.testCase = /^(.*?).feature/.exec(path.basename(testCase.sourceLocation.uri))[1];
    browser.params.testTimerStart = Date.now();
});

After(async function (testCase: HookScenarioResult): Promise<void> {
    const world = this;
    let testCaseStatusResult = testCase.result.status;
    let testTime = (Date.now() - browser.params.testTimerStart)/1000;

    rerunTestCase = testCase;
    featureFileData.push(testCase);

    /**
     * Outputting test case results at the end of each scenario
     */
    console.log("\n");
    await logger.info("*** Test case status result: " + testCaseStatusResult + " ***");
    await logger.info("*** Final URL: " + await browser.getCurrentUrl() + " ***");
    await logger.info("*** Time: " + testTime + " ***");

    console.log("\n");
    await browser.manage().logs().get('browser').then(async function(browserLog) {
        let history = {};
        for(let log of browserLog) {
            if(typeof history[log.message] === 'undefined') {
                await logger.debug("browser: " + log.timestamp + " " + log.level.name_ + " " + log.message);
                history[log.message] = "";
            }
        }
    });

    if (testCaseStatusResult === Status.FAILED) {
        await saveFailedScenarioScreenshot(<World>world, testCase);
        await savePageHTML(testCase);
    }
});

AfterAll(async function () {

    if( rerunTestCase === undefined ){
        logger.warn('WARNING: cucumber.conf.ts - no test case details gathered from feature file skipping AfterAll hook.');
        return;
    }

    let testCase = rerunTestCase;

    /**
     * Stores failed test cases for rerun suite
     */
    if (getTestCaseResult() === Status.PASSED) {

        let features = {};
        ensureDirSync('.tmp/rerun/');
        features = require("../.tmp/rerun/rerun.json");
        for (let i = 0; i < features["features"].length; i++) {
            let test: string = features["features"][i].split("../")[1];
            if (testCase.sourceLocation.uri.indexOf(test) !== -1) {
                logger.debug("Removing " + test + " from reruns...");
                features["features"].splice(i, 1);
            }
        }
        var json = JSON.stringify(features);
        //var fs = require('fs');
        ensureDirSync('.tmp/rerun/');
        fs.writeFile('.tmp/rerun/rerun.json', json, 'utf8');
    }

    /**
     * Attaches feature file name to debug file
     */
    if (fs.existsSync(OUTPUT_DIR + '/debug.log')){
        fs.rename(OUTPUT_DIR + '/debug.log', debugFileName, function(err){
            if ( err ) console.log('ERROR: ' + err);
        })
    }

});

async function saveFailedScenarioScreenshot(world: World, testCase: HookScenarioResult) {
    await browser.executeScript("document.body.style.zoom='60%'");
    const screenshot: string = await browser.takeScreenshot().then( async (png) => {
        await browser.executeScript("document.body.style.zoom='100%'");
        return png;
    });
    const featureName: string = /^(.*?).feature/.exec(path.basename(testCase.sourceLocation.uri))[1];
    const scenarioName: string = testCase.pickle.name.replace(" : ", " ").replace(" ", "-");
    const fileName: string = `${Date.now()}.feature-${featureName}.scenario-${scenarioName}.png`;

    await saveScreenshot(screenshot, fileName);

    world.attach(screenshot, 'image/png');

    logger.warn(fileName);

    return Promise.resolve();
};

async function saveScreenshot(screenshot: string, fileName: string) {
    const screenshotPath: string = path.resolve(process.cwd(), OUTPUT_DIR + '/screenshots/failures');
    const filepath: string = path.resolve(screenshotPath, fileName);

    let stream: WriteStream;

    ensureDirSync(screenshotPath);
    return await new Promise ( (resolve, reject) =>{
        stream = createWriteStream(filepath);
        stream.write(new Buffer(screenshot, 'base64'));
        stream.end();
        stream.on('finish' , () => { resolve(true); });
        stream.on("error", reject);
    });
};

/**
 * Saves the html of the page where the test script failed
 */
async function savePageHTML(testCase: HookScenarioResult) {
    let page = element(by.css("html"));

    const featureName = /^(.*?).feature/.exec(path.basename(testCase.sourceLocation.uri))[1];
    const scenarioName = testCase.pickle.name.replace(" : ", " ").replace(" ", "-");
    const fileName = `failure-html.${Date.now()}.feature-${featureName}.scenario-${scenarioName}-failed.html`;

    const htmlPath = path.resolve(process.cwd(), OUTPUT_DIR);
    const filepath = path.resolve(htmlPath, fileName);

    ensureDirSync(htmlPath);
    fs.writeFileSync(filepath, await page.getAttribute('innerHTML'));
};


/**
 * Returns a boolean result of the e2e test case
 */
function getTestCaseResult(): string {
    let testCaseResult: string = Status.PASSED;
    for (let i = 0; i < featureFileData.length; i++) {
        if (featureFileData[i].result.status === Status.FAILED){
            testCaseResult = Status.FAILED;
            break;
        }
    }
    return testCaseResult;
}
