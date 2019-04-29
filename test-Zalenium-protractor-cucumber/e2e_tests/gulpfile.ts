import { protractor } from 'gulp-protractor';
import { argv } from 'yargs';
import { ensureDirSync } from 'fs-extra';
import * as gulp from 'gulp';
import * as rename from 'gulp-rename';
import * as xmldoc from 'xmldoc';
import * as ts from 'gulp-typescript';
import * as path from 'path';
import * as fs from 'fs';
import * as XMLWriter from 'xml-writer';

/**
 * List of currently available suites
 */
const suites: string[] = ['n'];

/**
 * Indicator for a full run of all test cases.
 */
let fullrun: boolean = false;

/**
 * Transpilation of conf/protractor.conf.ts used as the protractor configuration file
 */
let options: {} = { configFile: "conf/protractor.conf.js" };

var y;

/**
 * Creates an object containing only the command line arguments given by the user 
 * without any extra args such as [ 'help', 'version' , '_' ]
 *
 * e.g. {
 *        'a': true
 *        'b': true
 *      }
 */
const arg = (argList => {

    let arg = {}, a, opt, thisOpt, curOpt;
    for (a = 0; a < argList.length; a++) {

      thisOpt = argList[a].trim();
      opt = thisOpt.replace(/^\-+/, '');

      if (opt === thisOpt) {
        if (curOpt) arg[curOpt] = opt;
        curOpt = null;
      }
      else {
          curOpt = opt;
          y=curOpt
          arg[curOpt] = true;
      }

    }

    return arg;

  })(process.argv);

/**
 * Usage: 'gulp test [suites]'
 * Without any options specified then all of the suites in the suites array will be run.
 * Otherwise specified suites will be run. For example 'gulp test -a -d' runs suite-a and suite-d features
 */
gulp.task('test', ['compileConfig'], function () {
    suppress(fullrun);
    message("RUNNING E2E TESTS");
    runSuites(argsToArray());
})

/**
 * Protractor does not support typescript configuration files so we need to transpile our
 * typescript configuration file into javascript so that we can pass it to protractor
 */
gulp.task('compileConfig', function () {
    return gulp.src('conf/protractor.conf.ts')
        .pipe(ts({
            "target": "es6",
            "module": "commonjs"
        }))
        .pipe(gulp.dest('conf/'));
});

/**
 * Compiles list of suite designator argument tags ('-a -c') into an array. If no arguments
 * are passed then the default array, 'suites', is passed instead so that all suites are ran.
 * @return {Array} - Example ['a','c'] of all suites to run
 */
let argsToArray = (): string[] => {
    let local = [];
    for (let i in suites) {
        if (arg[suites[i]]) {
            local.push(suites[i]);
        }
    }

    this.fullrun = (Object.keys(arg).length === 0 || local.length === suites.length ||
                             Object.keys(arg).length == 1 && Object.keys(arg)[0] == 'tags')  ? true : false;


    return this.fullrun === true ? suites : local;
}
/**
 * Runs the next suite in the array. Sets up the options and removes itself from pending
 * suites to run. If suite passes then next suite is run, otherwise suite is rerun.
 * @param suite - array of string suite designations such as ['a','b'] where 'a' would be the current suite.
 */
let runSuites = (suite: string[]): void => {
    //end run if unknown suite is entered
    if(suite.length === 0 && !this.fullrun){
        console.log('\n************* UNKNOWN SUITE ****************\n');
        generateEmptyReport();
        return;
    }

    // set up suite options
    options = setOptions(options, suite[0])
    suite.splice(0, 1);

    // recursive run suite
    runProtractor(options, suite, runNextSuite, argv.r ? rerunSuites : runNextSuite);
}

/**
 * Reruns the previously failed suite. Sets up the options. Whether the rerun suite passes
 * or fails the next suite will be run.
 * @param suite - array of suites to be run
 * @param options - the options to be rerun
 */
let rerunSuites = (suite: string[], options: {}) => {
    //set up rerun options
    message("RERUNNING SUITE " + options['args'][2].toUpperCase());
    options['args'].splice(0, 1);
    options['args'].push('--rerun');

    //recursive run suite
    runProtractor(options, suite, runNextSuite, runNextSuite);
}

/**
 * Function takes in all the necessary data to run a protractor suite and then two functions which will
 * determine its behavior on passing or failing.
 * @param options - JSON with format '{ configFile: "./someConfig", args: ["--current","a","--a"] }'
 * @param suite - array of suites to be run
 * @param onPass - function to be called next if suite passes
 * @param onFail - function to be called next if suite fails
 */
let runProtractor = (options: any, suite: any, onPass: (suite: any) => any,
        onFail: (suite: any, options?: any) => any): void => {
    gulp.src([]).pipe(protractor(options))
        .on('end', function (code) {
            onPass(suite);
            return code;
        })
        .on('error', function (code) {
            onFail(suite, options);
            return code;
        });
}

/**
 * If there are more suites to run than this calls run suite. Otherwise it finishes by generating reports
 * @param suite - array of suites to be run
 */
let runNextSuite = (suite: string[]): void => {
    if (suite.length == 0) {
        generateReport();
    } else {
        runSuites(suite);
    }
}

/**
 * Adds a suite to the default options in the format required by protractor
 * @param options - default options specify the configFile location
 * @param suite - suite to be added to protractor options
 * @return {} - returns options formatted for protractor
 */
let setOptions = (options, suite: string): {} => {
    options['args'] = ["--current", suite, "--" + suite];

    if(argv.dev)
        options['args'].push('--dev');
    if(this.fullrun)
        options['args'].push("--fullrun");
    if (typeof argv[y] === 'string') {
        options['args'].push('--features');
        options['args'].push(argv[y]);
        argv.features = argv[y];
    }
    if(typeof argv.qtest === 'string'){
        options['args'].push('--qtest');
        options['args'].push('--build');
        options['args'].push(argv.qtest);
    }
    if(typeof argv.tags === 'string'){
        options['args'].push('--tags');
        options['args'].push(argv.tags );
    }

    message(" RUNNING SUITE " + suite.toUpperCase());
    return options;
}

/**
 * Generates Jenkins reporting xml file. Takes the default json result file output by
 * cucumber and converts it into xml that is consumable by Jenkins.
 */
function generateReport(): void {
    gulp.src('../out/tests/e2e/results/report/merged-output.json')
        .pipe(rename('e2e-results.json'))
        .pipe(cucumberXmlReport({ strict: true }))
        .pipe(gulp.dest('../out/tests/e2e'));
}

/**
 * creates an xml file that is readable on jenkins
 */
function generateEmptyReport(): void {
    let xw = new XMLWriter;

    /* create the out directory */
    ensureDirSync(path.resolve('../out/tests/e2e/'));

    /* create the objects for the xml file */
    xw.startDocument().startElement('testsuites').startElement('testsuite');
    xw.writeAttribute('name','unknown').writeAttribute('tests','0').writeAttribute('failures','0').writeAttribute('skipped','0');
    xw.endDocument();

    /* create the empty xml report */
    fs.writeFileSync('../out/tests/e2e/e2e-results.xml', xw.toString());
}

/**
 * Converts a cucumber json file to junit xml.
 */
function cucumberXmlReport(opts) {
    var gutil = require('gulp-util'),
        through = require('through2'),
        cucumberJunit = require('cucumber-junit');
    return through.obj(function (file, enc, cb) {
        suppress(enc);
        var suffix = file.path.match(/merged-output.json/);
        if (suffix) {
            opts.prefix = suffix[1] + ';';
        }
        var xml = changeTimeFormat(cucumberJunit(purgeReruns(file.contents), opts));
        file.contents = new Buffer(xml);
        file.path = gutil.replaceExtension(file.path, '.xml');
        cb(null, file);
    });
}

/**
 * Fixes the xml output to comply with junit/jenkins standards.
 * Removes timestamps values.
 * @param xml - junit xml result of cucumber json conversion
 */
function changeTimeFormat(xml) {
    var document = new xmldoc.XmlDocument(xml);
    for (let suite of document.childrenNamed("testsuite")) {
        for (let ele of suite.childrenNamed("testcase")) {
            ele.attr.time = "0";
        }
    }
    return document.toString();
}

/**
 * In the case that a failed test reran successfully, this function will replace the 
 * failed entry with the successful one
 * @param jsonString - test run result data
 */
function purgeReruns(jsonString) {
    let json = JSON.parse(jsonString);
    for (let i = 0; i < json.length; i++) {
        let ida: string = json[i].name;
        for (let j = i + 1; j < json.length; j++) {
            let idb: string = json[j].name;
            if (ida == idb && !passed(json[i]) && passed(json[j])) {
                console.log("/////////////////////// PURGING RERUNS SUCCESSFUL ///////////////////////")
                json.splice(i, 1);
                break;
            }
        }
    }
    return JSON.stringify(json);
}

/**
 * Returns booean value indicating if a test case passed or failed
 * @param json - json representation of test result entry
 */
function passed(json) {
    for(let scenario of json["elements"]){
        for (let x of scenario.steps) {
            if (x.result.status.indexOf("failed") !== -1) {
                return false;
            }
        }
    }
    return true;
}

function message(text: string): void {
    console.log("==================================================================================");
    console.log("");
    console.log("                              " + text);
    console.log("");
    console.log("==================================================================================");
}

/**
 * Apparently this is the recommended way of suppressing cli errors with tslint
 * @param obj any object that is throwing an unused error in tslint
 */
function suppress(obj: any): void {
    !!false && eval(obj);
}