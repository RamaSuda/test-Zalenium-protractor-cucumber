import { Config, browser } from 'protractor';
import { ensureDirSync } from 'fs-extra';
import { argv as args } from 'yargs';
import * as moment from 'moment';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as proc from 'child_process';
const RERUN_MAX = 5;

export let config: Config = {

    framework: 'custom',
    frameworkPath: require.resolve('protractor-cucumber-framework'),
    seleniumAddress: 'http://localhost:4444/wd/hub/',
    baseUrl:'https://angular.io/',
    allScriptsTimeout: 80000,
    disableChecks: true,
    specs: getFeatures(),

    cucumberOpts: {
        compiler: 'ts:ts-node/register',
        require: [
            path.resolve(process.cwd(), './conf/cucumber.conf.ts'),
            path.resolve(process.cwd(), './step_definitions/**/*.steps.ts')
        ],
        format: 'json:../out/tests/e2e/results/results.json',
        tags: args.tags !== undefined ? args.tags : ''
    },

    multiCapabilities: [{
        browserName: 'chrome',
        name: 'Zalenium - Protractor - chrome',
        shardTestFiles: true,
        maxInstances: 1,
        deviceProperties: {
            device: 'MacBook Pro 13',
            platform: {
                name: 'OSX', version: '10.13.1'
            }
        }
    }],

    plugins: [{
        package: 'protractor-multiple-cucumber-html-reporter-plugin',
        options: {
            reportName: '</p><img class="pull-left" src="' + " " + '" alt="' + " " + '" height="50"><p class="navbar-text">' + " " + ' Test Report ' + moment().format('MM-DD-YYYY h:mm a') + '</p><p>',
            automaticallyGenerateReport: true,
            openReportInBrowser: false,
            metadataKey: 'deviceProperties',
            saveCollectedJSON: true,
            disableLog: true,
            customData: {
                title: 'Results files',
                data: [
                    {label: '<a href="../../screenshots/screenshots.html">Screenshots</a>', value: ' - regular and failure screenshots '},
                    {label: '<a href="../../index.html">Debug files</a>', value: ' - debug logs and failure html files'}
                ]
            }
        }
    }],

    beforeLaunch: async () => {

        if (args.n) {
            clearTmpDirs();
            loadRerunFeaturesList()
        }
        return null;
    },
    params: {
        csrfToken: "",
        featureFileData: [],
        folderName: "",
        apiDirectory: "",
        timerStart: Date.now(),
        timerEnd: Date.now(),
        testTimerStart: 0,
        timeout: 70000,
        shortTimeout: 20000,
        year: "",
        qTestScreenshots: [],
        updateQTest:args.qtest != undefined ? args.qtest : false,

        printProperties: function (myObject) {
            if (typeof (myObject) === 'object') {
                var propValue;
                for (var propName in myObject) {
                    propValue = myObject[propName];
                    console.log(propName, propValue);
                }
            } else {
                console.log("Could not print properties, param is of type " + typeof (myObject) + " not object");
            }
        }
    },


    /**
     * Add screenshot, debug logs, and failure html results to E2E_Tests_Report
     */
    afterLaunch: async () => {
        interface CustomReportData {
            title: string,
            path: string,
            command: (path: string) => string,
            writePath: (path: string) => string
        }

        interface CustomReportHTML {
            header: (text: string) => string,
            link: (text: string) => string,
            footer: string
        }

        let screenshots: CustomReportData = {
            title: 'Screenshots',
            path: '../out/tests/e2e/screenshots',
            command: (path: string) => 'find '+path+' -name "*.png"',
            writePath: (path: string) => path+'/screenshots.html'
        };

        let debug: CustomReportData = {
            title: 'Debug files',
            path: '../out/tests/e2e',
            command: (path: string) => "find "+path+" -maxdepth 1 -name '*.*'",
            writePath: (path: string) => path+'/index.html'
        }

        let html: CustomReportHTML = {
            header: (text: string) => "<!DOCTYPE html><html><body><h1>"+text+"</h1><p>",
            link: (entry: string) => '<a href="./'+entry+'">'+entry+'</a><br>',
            footer: "</body></html>"
        }

        return await new Promise((res,rej) => {
            suppress(rej);
            type resp = (value?: {} | PromiseLike<{}>) => void;

            let writeData = (datas: CustomReportData[], html: CustomReportHTML, res: resp ) => {
                let data = datas[0];
                datas.splice(0, 1);
                proc.exec(data.command(data.path), (err, stdout, stderr) => {
                    suppress(err);
                    suppress(stderr);
                    let all = stdout.split('\n');
                    let page = html.header(data.title);
                    for(let entry of all) {
                        entry = entry.replace(data.path, "");
                        page += html.link(entry);
                    }
                    page += html.footer;
                    fs.writeFile(data.writePath(data.path), page, (err) => {
                        if(datas.length > 0) {
                            writeData(datas, html, res);
                        } else {
                            res();
                        }
                    })
                });
            }

            writeData([screenshots, debug], html, res);
        })

    }

};

function getFeatures() {
    if (args.rerun) {
        const features = require("../.tmp/rerun/rerun.json");
        if(features["features"].length <= RERUN_MAX) {
            return features["features"];
        } else {
            console.log("*** Reached rerun limit of " + RERUN_MAX + "("+features["features"].length+"), skipping reruns ... ***");
            return {};
        }
    }

    if (args.features !== undefined) {
        return args.features.split(',').map(feature => `${process.cwd()}/features/suite-${args.current}/**/${feature}.feature`);
    }

    return [`${process.cwd()}/features/suite-${args.current}/**/*.feature`];
}

function clearTmpDirs() {
    if (!process.env.HOST) {
        fs.removeSync('./.tmp');
        fs.removeSync('../out');
    }
}

function loadRerunFeaturesList() {
    proc.exec('find features/suite-' + args.current + ' "*.feature"', (err, stdout, stderr) => {
        suppress(err);
        suppress(stderr);
        let specified = {};
        let tests;
        if (args.features) {
            args.features.split(",").forEach(k => specified[k] = true);
            tests = stdout.split("\n").filter(k => k.indexOf(".feature") !== -1)
                .filter(k => specified[/[\w.-]*.feature$/.exec(k).toString().split(".feature")[0]] == true)
                .map(k => "../" + k);
        } else {
            tests = stdout.split("\n").filter(k => k.indexOf(".feature") !== -1)
                .map(k => "../" + k);
        }
        let features = {};
        features["features"] = tests;
        var json = JSON.stringify(features);
        var fs = require('fs');
        ensureDirSync('.tmp/rerun/');
        fs.writeFile('.tmp/rerun/rerun.json', json, 'utf8', () => {});
    });
}

function suppress(obj: any): void {
    !!false && eval(obj);
}



